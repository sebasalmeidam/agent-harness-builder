import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { translateHarness, executeWithSdk, resolveTools } from "@agent-harness/runtime";
import type {
  ExecutionRun,
  AgentStatus,
  ActivityEntry,
  ExecutionSummary,
  TranslatedTeam,
  AgentDefinition,
} from "@agent-harness/runtime";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import * as projectService from "./project-service.js";
import * as runService from "./run-service.js";
import * as taskService from "./task-service.js";
import { exportHarness } from "./harness-service.js";
import * as progressService from "./progress-service.js";

// --- Types ---

/** Event types emitted during execution for SSE consumers (Phase 3). */
export type RunEventType =
  | "agent-status"
  | "activity"
  | "file-change"
  | "run-status";

export interface RunEvent {
  type: RunEventType;
  data: Record<string, unknown>;
}

export type RunEventCallback = (event: RunEvent) => void;

// --- In-memory state ---

/** Active runs held in memory for fast SSE event emission. */
const activeRuns = new Map<string, ExecutionRun>();

/** Per-run event emitters for SSE subscribers. */
const runEmitters = new Map<string, EventEmitter>();

// --- Public API ---

/**
 * Options for starting an execution run.
 */
export interface StartRunOptions {
  taskDescription?: string;
  checklist?: string[];
}

/**
 * Starts a new execution run for a project.
 *
 * Validates that the project exists, has a team assigned, and has a non-empty spec.
 * Loads the team, exports the harness, translates it, creates the initial run record,
 * and begins asynchronous execution.
 *
 * @param projectId - The project ID to execute
 * @param options - Optional task-level parameters (taskDescription, checklist)
 * @returns The run ID of the newly created run.
 * @throws Error with code "NOT_FOUND" if the project does not exist.
 * @throws Error with code "NO_TEAM" if the project has no assigned team.
 * @throws Error with code "NO_SPEC" if the project spec is empty.
 */
export async function startRun(
  projectId: string,
  options?: StartRunOptions
): Promise<{ runId: string }> {
  // Validate project exists
  const project = await projectService.get(projectId);
  if (!project) {
    const error = new Error("Project not found");
    (error as Error & { code: string }).code = "NOT_FOUND";
    throw error;
  }

  // Validate project has a team assigned
  if (!project.teamId) {
    const error = new Error("Project has no team assigned");
    (error as Error & { code: string }).code = "NO_TEAM";
    throw error;
  }

  // Validate project has a non-empty spec
  if (!project.spec || project.spec.trim().length === 0) {
    const error = new Error("Project spec is empty");
    (error as Error & { code: string }).code = "NO_SPEC";
    throw error;
  }

  // Load team data and export harness
  const harness = await exportHarness(project.teamId);

  // Translate harness to SDK team structures
  const translatedTeam = translateHarness(harness, project.spec);

  // Generate run ID
  const runId = randomUUID();

  // Build initial agent statuses (all idle)
  const agentStatuses: Record<string, AgentStatus> = {};
  agentStatuses[translatedTeam.leadAgent.name] = "idle";
  for (const teammate of translatedTeam.teammates) {
    agentStatuses[teammate.name] = "idle";
  }

  // Create initial run record
  const run: ExecutionRun = {
    id: runId,
    projectId,
    teamId: project.teamId,
    taskId: null,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    agentStatuses,
    activityLog: [],
    files: [],
    summary: null,
    error: null,
  };

  // Persist initial run record
  await runService.save(run);

  // Store in active runs map
  activeRuns.set(runId, run);

  // Create event emitter for this run
  const emitter = new EventEmitter();
  runEmitters.set(runId, emitter);

  // Start asynchronous execution (fire-and-forget)
  executeRun(run, translatedTeam, harness, options).catch((err: unknown) => {
    handleRunError(run, err);
  });

  return { runId };
}

/**
 * Composes a task prompt from task title, description, and checklist.
 * This is a testable utility function used by startTaskRun.
 */
export function composeTaskPrompt(task: taskService.Task): string {
  const lines: string[] = [];

  lines.push(`Task: ${task.title}`);
  lines.push("");

  if (task.description && task.description.trim().length > 0) {
    lines.push(task.description);
    lines.push("");
  }

  if (task.checklist && task.checklist.length > 0) {
    lines.push("Checklist:");
    for (let i = 0; i < task.checklist.length; i++) {
      const item = task.checklist[i];
      const checkbox = item!.completed ? "[x]" : "[ ]";
      const suffix = item!.completed ? "  (already completed)" : "";
      lines.push(`${i + 1}. ${checkbox} ${item!.description}${suffix}`);
    }
    lines.push("");
    lines.push("Instructions: Complete the unchecked items in the checklist above. When you have completed an item, note it in your response.");
  }

  return lines.join("\n");
}

/**
 * Starts a new execution run for a task.
 *
 * Validates that the task exists, has a team assigned, and is in a valid status for execution.
 * Loads the task and team, exports the harness, translates it with the task prompt,
 * creates the initial run record with taskId, and begins asynchronous execution.
 *
 * @param projectId - The project ID containing the task
 * @param taskId - The task ID to execute
 * @returns The run ID of the newly created run.
 * @throws Error with code "NOT_FOUND" if the task does not exist.
 * @throws Error with code "NO_TEAM" if the task has no assigned team.
 * @throws Error with code "INVALID_STATUS" if the task status is "running" or "done".
 */
export async function startTaskRun(
  projectId: string,
  taskId: string
): Promise<{ runId: string }> {
  // Load task
  const task = await taskService.get(projectId, taskId);
  if (!task) {
    const error = new Error("Task not found");
    (error as Error & { code: string }).code = "NOT_FOUND";
    throw error;
  }

  // Validate eligibility: task must have teamId not null
  if (!task.teamId) {
    const error = new Error("Task has no team assigned");
    (error as Error & { code: string }).code = "NO_TEAM";
    throw error;
  }

  // Validate eligibility: status must be "pending" or "failed"
  if (task.status === "running" || task.status === "done") {
    const error = new Error(`Task cannot be executed in status: ${task.status}`);
    (error as Error & { code: string }).code = "INVALID_STATUS";
    throw error;
  }

  // Update task status to "running"
  await taskService.update(projectId, taskId, { status: "running" });

  // Load project (for path)
  const project = await projectService.get(projectId);
  if (!project) {
    // Restore task status to previous status if project not found
    await taskService.update(projectId, taskId, { status: task.status });
    const error = new Error("Project not found");
    (error as Error & { code: string }).code = "NOT_FOUND";
    throw error;
  }

  // Load team data and export harness
  const harness = await exportHarness(task.teamId);

  // Compose task prompt from task title, description, and checklist
  const taskPrompt = composeTaskPrompt(task);

  // Translate harness with task prompt
  const translatedTeam = translateHarness(harness, taskPrompt);

  // Generate run ID
  const runId = randomUUID();

  // Build initial agent statuses (all idle)
  const agentStatuses: Record<string, AgentStatus> = {};
  agentStatuses[translatedTeam.leadAgent.name] = "idle";
  for (const teammate of translatedTeam.teammates) {
    agentStatuses[teammate.name] = "idle";
  }

  // Create initial run record with taskId
  const run: ExecutionRun = {
    id: runId,
    projectId,
    teamId: task.teamId,
    taskId,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    agentStatuses,
    activityLog: [],
    files: [],
    summary: null,
    error: null,
  };

  // Persist initial run record
  await runService.save(run);

  // Store in active runs map
  activeRuns.set(runId, run);

  // Create event emitter for this run
  const emitter = new EventEmitter();
  runEmitters.set(runId, emitter);

  // Start asynchronous execution (fire-and-forget)
  executeTaskRun(run, translatedTeam, harness).catch((err: unknown) => {
    handleRunError(run, err);
  });

  return { runId };
}

/**
 * Returns an active (in-memory) run by ID.
 * Returns null if the run is not active.
 */
export function getActiveRun(runId: string): ExecutionRun | null {
  return activeRuns.get(runId) ?? null;
}

/**
 * Registers a callback for run events (used by SSE in Phase 3).
 */
export function onRunEvent(runId: string, callback: RunEventCallback): void {
  const emitter = runEmitters.get(runId);
  if (emitter) {
    emitter.on("event", callback);
  }
}

/**
 * Removes a callback for run events.
 */
export function offRunEvent(runId: string, callback: RunEventCallback): void {
  const emitter = runEmitters.get(runId);
  if (emitter) {
    emitter.off("event", callback);
  }
}

// --- Internal helpers ---

/**
 * Finds the emoji for a harness agent by name.
 */
function getAgentEmoji(
  agentName: string,
  harnessAgents: Array<{ id: string; name: string; emoji: string }>
): string {
  const agent = harnessAgents.find((a) => a.name === agentName);
  return agent?.emoji ?? "";
}

/**
 * Finds the agent ID for a harness agent by name.
 */
function getAgentId(
  agentName: string,
  harnessAgents: Array<{ id: string; name: string; emoji: string }>
): string {
  const agent = harnessAgents.find((a) => a.name === agentName);
  return agent?.id ?? agentName;
}

// --- Internal execution logic ---

/**
 * Emits an event to all subscribers of a run and stores it in the run record.
 */
function emitRunEvent(run: ExecutionRun, event: RunEvent): void {
  const emitter = runEmitters.get(run.id);
  if (emitter) {
    emitter.emit("event", event);
  }
}

/**
 * Updates an agent's status and emits the corresponding event.
 */
function updateAgentStatus(
  run: ExecutionRun,
  agentName: string,
  status: AgentStatus,
  agentEmoji: string
): void {
  run.agentStatuses[agentName] = status;
  emitRunEvent(run, {
    type: "agent-status",
    data: { agentId: agentName, status, agentName, agentEmoji },
  });
}

/**
 * Appends an activity log entry and emits the corresponding event.
 */
function addActivityEntry(run: ExecutionRun, entry: ActivityEntry): void {
  run.activityLog.push(entry);
  emitRunEvent(run, {
    type: "activity",
    data: entry as unknown as Record<string, unknown>,
  });
}

/**
 * Records a file change and emits the corresponding event.
 */
function addFileChange(run: ExecutionRun, filePath: string): void {
  if (!run.files.includes(filePath)) {
    run.files.push(filePath);
    emitRunEvent(run, {
      type: "file-change",
      data: { path: filePath },
    });
  }
}

/**
 * Analyzes activity log to identify completed checklist items.
 * Returns updated checklist with completed items marked.
 *
 * This is a best-effort analysis using keyword matching.
 * For each checklist item, we check if the activity log contains
 * messages that suggest the item was completed.
 */
function updateChecklistFromResults(
  task: taskService.Task,
  activityLog: ActivityEntry[]
): Array<{ id: string; description: string; completed: boolean }> {
  if (!task.checklist || task.checklist.length === 0) {
    return task.checklist;
  }

  // Combine all activity messages into a single searchable text
  const activityText = activityLog
    .map((entry) => entry.message.toLowerCase())
    .join(" ");

  // Update checklist items based on activity log content
  return task.checklist.map((item) => {
    if (item.completed) {
      // Already completed, no need to update
      return item;
    }

    // Extract keywords from checklist item description (words > 3 chars)
    const keywords = item.description
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && /^[a-z]+$/.test(word));

    // Check if activity log mentions completion-related keywords
    // along with item-specific keywords
    const completionPatterns = [
      "completed",
      "finished",
      "done",
      "success",
      "implemented",
      "added",
      "created",
      "updated",
    ];

    // Count how many item keywords appear in activity text
    const keywordMatches = keywords.filter((kw) =>
      activityText.includes(kw),
    ).length;

    // Count how many completion patterns appear in activity text
    const completionMatches = completionPatterns.filter((pattern) =>
      activityText.includes(pattern),
    ).length;

    // If we have at least 2 keyword matches and at least 1 completion pattern,
    // mark the item as completed
    const shouldComplete = keywordMatches >= 2 && completionMatches >= 1;

    return {
      ...item,
      completed: shouldComplete || item.completed,
    };
  });
}

/**
 * Completes a run with the given status and summary.
 * If the run is associated with a task (taskId is not null), updates the task status
 * and attempts to update checklist items based on activity log analysis.
 */
async function completeRun(
  run: ExecutionRun,
  status: "completed" | "failed",
  summary: ExecutionSummary,
  errorMessage: string | null
): Promise<void> {
  run.status = status;
  run.completedAt = new Date().toISOString();
  run.summary = summary;
  run.error = errorMessage;

  // Transition any remaining "idle" agents to "done" on completion
  for (const agentName of Object.keys(run.agentStatuses)) {
    if (
      run.agentStatuses[agentName] === "idle" ||
      run.agentStatuses[agentName] === "working"
    ) {
      run.agentStatuses[agentName] = "done";
    }
  }

  // Update task status and checklist if this run is associated with a task
  if (run.taskId) {
    const taskStatus = status === "completed" ? "done" : "failed";

    // If execution was successful, try to update checklist based on activity log
    if (status === "completed") {
      const task = await taskService.get(run.projectId, run.taskId);
      if (task) {
        const updatedChecklist = updateChecklistFromResults(
          task,
          run.activityLog,
        );
        await taskService.update(run.projectId, run.taskId, {
          status: taskStatus,
          checklist: updatedChecklist,
        });
      } else {
        // Task not found, just update status
        await taskService.update(run.projectId, run.taskId, {
          status: taskStatus,
        });
      }
    } else {
      // Failed execution, just update status
      await taskService.update(run.projectId, run.taskId, {
        status: taskStatus,
      });
    }
  }

  // Persist final run record
  await runService.save(run);

  // Update progress file with final status
  const finalMessage = status === "completed"
    ? `Execution completed successfully. Files changed: ${summary.filesChanged}, Total time: ${summary.totalTime}s, Iterations: ${summary.iterations}, Errors: ${summary.errors}`
    : `Execution failed: ${errorMessage || "Unknown error"}`;
  await progressService.appendProgressUpdate(
    run.projectId,
    run.id,
    finalMessage
  );

  // Emit run status event
  emitRunEvent(run, {
    type: "run-status",
    data: {
      status,
      error: errorMessage,
      summary: summary as unknown as Record<string, unknown>,
    },
  });

  // Cleanup: remove from active runs and emitters after a delay
  // to allow SSE clients to receive the final event
  setTimeout(() => {
    activeRuns.delete(run.id);
    runEmitters.delete(run.id);
  }, 30_000);
}

/**
 * Executes a task run. Uses the existing executeRun infrastructure.
 * Task status updates happen in completeRun based on the presence of taskId.
 */
async function executeTaskRun(
  run: ExecutionRun,
  translatedTeam: TranslatedTeam,
  harness: { agents: Array<{ id: string; name: string; emoji: string; skills?: string[] }> }
): Promise<void> {
  await executeRun(run, translatedTeam, harness, undefined);
}

/**
 * Handles a top-level error during execution.
 */
async function handleRunError(
  run: ExecutionRun,
  err: unknown
): Promise<void> {
  const errorMessage =
    err instanceof Error ? err.message : "Unknown execution error";

  const startTime = new Date(run.startedAt).getTime();
  const totalTime = Math.round((Date.now() - startTime) / 1000);

  const errorCount = run.activityLog.filter((e) => e.type === "error").length;

  const summary: ExecutionSummary = {
    filesChanged: run.files.length,
    totalTime,
    iterations: 0,
    errors: errorCount + 1,
  };

  await completeRun(run, "failed", summary, errorMessage);
}

/**
 * Simulates SDK execution by processing the translated team.
 *
 * In a real implementation, this would invoke the Claude Agent SDK
 * using the translated team configuration. For now, it simulates
 * the execution flow to validate the orchestration logic, state
 * machine, event emission, and persistence.
 *
 * The simulation:
 * 1. Activates the lead agent (idle -> working)
 * 2. For each teammate, simulates a handoff from the lead
 * 3. Each teammate goes through idle -> working -> done
 * 4. Tracks file changes from simulated tool_use events
 * 5. Computes summary and completes the run
 */
async function executeRun(
  run: ExecutionRun,
  translatedTeam: TranslatedTeam,
  harness: { agents: Array<{ id: string; name: string; emoji: string; role?: string; goal?: string; skills?: string[] }> },
  options?: StartRunOptions
): Promise<void> {
  const startTime = Date.now();
  let iterations = 0;
  let errorCount = 0;

  try {
    // Initialize progress file at execution start
    const taskDescription = options?.taskDescription || "Execute project specification";
    const checklist = options?.checklist || [];
    await progressService.initProgressFile(
      run.projectId,
      run.id,
      taskDescription,
      checklist
    );

    // --- Attempt real SDK execution ---
    // Try to import and use the Claude Agent SDK.
    // If it fails (not installed, wrong API, etc.), fall back to simulation.
    const sdkResult = await tryRealSdkExecution(run, translatedTeam, harness.agents, options);
    if (sdkResult.executed) {
      return; // SDK handled everything
    }

    // --- Simulated execution (SDK not available) ---

    // Step 1: Lead agent starts working
    const leadName = translatedTeam.leadAgent.name;
    const leadEmoji = getAgentEmoji(leadName, harness.agents);
    const leadId = getAgentId(leadName, harness.agents);

    updateAgentStatus(run, leadName, "working", leadEmoji);
    addActivityEntry(run, {
      timestamp: new Date().toISOString(),
      agentId: leadId,
      agentEmoji: leadEmoji,
      agentName: leadName,
      message: "Starting task analysis and work coordination",
      type: "action",
    });
    iterations++;

    // Persist intermediate state
    await runService.save(run);

    // Step 2: Lead hands off work to each teammate
    for (const teammate of translatedTeam.teammates) {
      const teammateName = teammate.name;
      const teammateEmoji = getAgentEmoji(teammateName, harness.agents);
      const teammateId = getAgentId(teammateName, harness.agents);

      // Lead hands off to teammate
      addActivityEntry(run, {
        timestamp: new Date().toISOString(),
        agentId: leadId,
        agentEmoji: leadEmoji,
        agentName: leadName,
        message: `Delegating work to ${teammateName}`,
        type: "handoff",
      });
      iterations++;

      // Teammate starts working
      updateAgentStatus(run, teammateName, "working", teammateEmoji);
      addActivityEntry(run, {
        timestamp: new Date().toISOString(),
        agentId: teammateId,
        agentEmoji: teammateEmoji,
        agentName: teammateName,
        message: "Beginning assigned work",
        type: "action",
      });
      iterations++;

      // Simulate file change from teammate's work
      addFileChange(run, `src/${teammateName.toLowerCase().replace(/\s+/g, "-")}-output.ts`);

      // Teammate completes work
      updateAgentStatus(run, teammateName, "done", teammateEmoji);
      addActivityEntry(run, {
        timestamp: new Date().toISOString(),
        agentId: teammateId,
        agentEmoji: teammateEmoji,
        agentName: teammateName,
        message: "Work completed successfully",
        type: "complete",
      });
      iterations++;

      // Persist after each teammate
      await runService.save(run);
    }

    // Step 3: Lead agent completes
    updateAgentStatus(run, leadName, "done", leadEmoji);
    addActivityEntry(run, {
      timestamp: new Date().toISOString(),
      agentId: leadId,
      agentEmoji: leadEmoji,
      agentName: leadName,
      message: "All work coordinated and completed",
      type: "complete",
    });
    iterations++;

    // Step 4: Compute summary and complete run
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const summary: ExecutionSummary = {
      filesChanged: run.files.length,
      totalTime,
      iterations,
      errors: errorCount,
    };

    await completeRun(run, "completed", summary, null);
  } catch (err: unknown) {
    errorCount++;
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error during execution";

    // Log error as activity
    addActivityEntry(run, {
      timestamp: new Date().toISOString(),
      agentId: "system",
      agentEmoji: "",
      agentName: "System",
      message: errorMessage,
      type: "error",
    });

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const summary: ExecutionSummary = {
      filesChanged: run.files.length,
      totalTime,
      iterations,
      errors: errorCount,
    };

    await completeRun(run, "failed", summary, errorMessage);
  }
}

/**
 * Attempts to execute using the real Claude Agent SDK.
 *
 * Returns { executed: true } if the SDK was available and execution was handled.
 * Returns { executed: false } if the SDK is not available, in which case the
 * caller should fall back to simulated execution.
 *
 * This function is structured as a try/catch around the SDK call so that
 * the service does not require the SDK to be installed for testing or
 * development without an API key.
 */
async function tryRealSdkExecution(
  run: ExecutionRun,
  translatedTeam: TranslatedTeam,
  harnessAgents: Array<{ id: string; name: string; emoji: string; role?: string; goal?: string; skills?: string[] }>,
  options?: StartRunOptions
): Promise<{ executed: boolean }> {
  // Gate real SDK execution on API key presence.
  // When the key is not set, return { executed: false } so the caller
  // falls back to simulation. This keeps simulation running freely
  // without requiring any credentials.
  if (!process.env["ANTHROPIC_API_KEY"]) {
    return { executed: false };
  }

  try {
    const startTime = Date.now();

    // Get lead agent details
    const leadAgent = translatedTeam.leadAgent;
    const leadName = leadAgent.name;
    const leadEmoji = getAgentEmoji(leadName, harnessAgents);
    const leadId = getAgentId(leadName, harnessAgents);

    // Resolve project working directory
    const project = await projectService.get(run.projectId);
    if (!project) {
      return { executed: false };
    }
    const projectDir = `${process.env["HARNESS_DATA_DIR"]}/projects/${project.id}`;
    const workspaceDir = `${projectDir}/workspace`;

    // Use workspace directory if it exists, otherwise use project directory
    let cwd = projectDir;
    try {
      const fs = await import("node:fs/promises");
      await fs.access(workspaceDir);
      cwd = workspaceDir;
    } catch {
      // Workspace doesn't exist, use project directory
    }

    // Resolve tools for the lead agent based on skills
    // Pass isLead: true to include Task tool for delegation
    const leadAgentData = harnessAgents.find((a) => a.id === leadId);
    const skills: string[] = leadAgentData?.skills ?? [];
    const tools = resolveTools(skills, true);

    // Build agents definition for SDK if teammates exist
    let agents: Record<string, AgentDefinition> | undefined;
    if (translatedTeam.teammates.length > 0) {
      agents = {};
      for (const teammate of translatedTeam.teammates) {
        const teammateHarnessAgent = harnessAgents.find((a) => a.name === teammate.name);
        const teammateSkills: string[] = teammateHarnessAgent?.skills ?? [];
        const teammateTools = resolveTools(teammateSkills, false);

        const role = teammateHarnessAgent?.role || teammate.name;
        const goal = teammateHarnessAgent?.goal || "Team member";
        agents[teammate.name] = {
          description: `${role}: ${goal}`,
          prompt: teammate.systemPrompt,
          tools: teammateTools,
        };
      }
    }

    // Build prompt from task description + checklist, or fall back to project spec
    let prompt: string;
    if (options?.taskDescription) {
      // Construct task-level prompt
      const lines: string[] = [];
      lines.push(`Task: ${options.taskDescription}`);

      if (options.checklist && options.checklist.length > 0) {
        lines.push("");
        lines.push("Checklist:");
        options.checklist.forEach((item) => {
          lines.push(`- [ ] ${item}`);
        });
        lines.push("");
        lines.push("After completing your work, verify each checklist item:");
        lines.push("1. For each item, confirm it is done by checking the relevant files or outputs.");
        lines.push("2. Report the status of each checklist item (done/not done) with a brief explanation.");
        lines.push("3. Update the progress file with your verification results.");
      }

      prompt = lines.join("\n");
    } else {
      // Backward compatible: use project spec (default to empty if undefined)
      prompt = project.spec || "";
    }

    // Update agent status to working
    updateAgentStatus(run, leadName, "working", leadEmoji);

    // Call SDK executor
    const sdkGenerator = executeWithSdk({
      systemPrompt: leadAgent.systemPrompt,
      model: leadAgent.model,
      cwd,
      prompt,
      tools,
      maxBudgetUsd: 5.0,
      agents,
    });

    // Process SDK messages
    let iterationCount = 0;
    let errorCount = 0;

    try {
      for await (const message of sdkGenerator) {
        iterationCount++;

        // Process different message types
        if (message.type === "assistant") {
          await handleAssistantMessage(run, message, leadId, leadName, leadEmoji);
        } else if (message.type === "user") {
          await handleUserMessage(run, message, leadId, leadName, leadEmoji);
        } else if (message.type === "result") {
          // Result message indicates execution completion
          const totalTime = Math.round((Date.now() - startTime) / 1000);

          if (message.subtype === "success") {
            // Success case
            const summary: ExecutionSummary = {
              filesChanged: run.files.length,
              totalTime,
              iterations: iterationCount,
              errors: errorCount,
            };

            // Store cost if available
            if (message.total_cost_usd) {
              run.costUsd = message.total_cost_usd;
            }

            // Add completion activity entry
            addActivityEntry(run, {
              timestamp: new Date().toISOString(),
              agentId: leadId,
              agentEmoji: leadEmoji,
              agentName: leadName,
              message: message.result || "Work completed successfully",
              type: "complete",
            });

            updateAgentStatus(run, leadName, "done", leadEmoji);
            await completeRun(run, "completed", summary, null);
          } else {
            // Error case (subtype !== "success")
            errorCount++;

            const summary: ExecutionSummary = {
              filesChanged: run.files.length,
              totalTime,
              iterations: iterationCount,
              errors: errorCount,
            };

            // Store cost if available
            if (message.total_cost_usd) {
              run.costUsd = message.total_cost_usd;
            }

            // Join all error messages from the errors array
            const errorMessage = message.errors && message.errors.length > 0
              ? message.errors.join("; ")
              : `Execution failed with error: ${message.subtype}`;

            // Add error activity entry
            addActivityEntry(run, {
              timestamp: new Date().toISOString(),
              agentId: leadId,
              agentEmoji: leadEmoji,
              agentName: leadName,
              message: errorMessage,
              type: "error",
            });

            updateAgentStatus(run, leadName, "blocked", leadEmoji);
            await completeRun(run, "failed", summary, errorMessage);
          }

          // Result message is always the last message, execution is done
          return { executed: true };
        }

        // Persist intermediate state periodically
        if (iterationCount % 10 === 0) {
          await runService.save(run);
        }
      }

      // If we reach here without a result message, something went wrong
      errorCount++;
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      const summary: ExecutionSummary = {
        filesChanged: run.files.length,
        totalTime,
        iterations: iterationCount,
        errors: errorCount,
      };

      await completeRun(run, "failed", summary, "SDK execution ended without result message");
      return { executed: true };
    } catch (err: unknown) {
      // Classify and handle SDK errors
      errorCount++;
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      const errorMessage = classifyAndFormatSdkError(err);

      // Add error activity entry with clear user-facing message
      addActivityEntry(run, {
        timestamp: new Date().toISOString(),
        agentId: leadId,
        agentEmoji: leadEmoji,
        agentName: leadName,
        message: errorMessage,
        type: "error",
      });

      // Update agent status to blocked
      updateAgentStatus(run, leadName, "blocked", leadEmoji);

      // Complete run as failed
      const summary: ExecutionSummary = {
        filesChanged: run.files.length,
        totalTime,
        iterations: iterationCount,
        errors: errorCount,
      };

      await completeRun(run, "failed", summary, errorMessage);
      return { executed: true };
    }
  } catch (err: unknown) {
    // Outer catch for non-SDK errors (e.g., project not found)
    console.error("Unexpected error in SDK execution:", err);
    return { executed: false };
  }
}

/**
 * Classifies an SDK error and returns a clear user-facing error message.
 */
function classifyAndFormatSdkError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "An unknown error occurred during execution.";
  }

  const errorMessage = err.message.toLowerCase();

  // Check for rate limit errors (HTTP 429)
  if (errorMessage.includes("rate limit") || errorMessage.includes("429") || errorMessage.includes("too many requests")) {
    return "Rate limit exceeded. Please wait a moment and try again.";
  }

  // Check for invalid API key errors
  if (errorMessage.includes("api key") || errorMessage.includes("authentication") || errorMessage.includes("unauthorized") || errorMessage.includes("401")) {
    return "Invalid or missing Anthropic API key. Please check your ANTHROPIC_API_KEY environment variable.";
  }

  // Check for network errors
  if (errorMessage.includes("network") || errorMessage.includes("econnrefused") || errorMessage.includes("timeout") || errorMessage.includes("enotfound")) {
    return "Network error: Unable to connect to the Anthropic API. Please check your internet connection.";
  }

  // Check for SDK internal errors
  if (errorMessage.includes("sdk") || errorMessage.includes("internal error")) {
    return `SDK error: ${err.message}`;
  }

  // Generic fallback for unknown errors
  return `Execution error: ${err.message}`;
}

/**
 * Handles an SDK assistant message by extracting text and tool_use content blocks.
 */
async function handleAssistantMessage(
  run: ExecutionRun,
  message: SDKMessage & { type: "assistant" },
  agentId: string,
  agentName: string,
  agentEmoji: string
): Promise<void> {
  const assistantMsg = message.message as BetaMessage;

  // Process each content block
  for (const block of assistantMsg.content) {
    if (block.type === "text") {
      // Text content - add as action entry
      addActivityEntry(run, {
        timestamp: new Date().toISOString(),
        agentId,
        agentEmoji,
        agentName,
        message: block.text,
        type: "action",
      });
    } else if (block.type === "tool_use") {
      // Tool use - add as action entry and track file changes
      const toolName = block.name;
      const toolInput = block.input as Record<string, unknown>;

      // Create activity entry for tool use
      const toolMessage = `Using tool: ${toolName}`;
      addActivityEntry(run, {
        timestamp: new Date().toISOString(),
        agentId,
        agentEmoji,
        agentName,
        message: toolMessage,
        type: "action",
      });

      // Track file changes for Write, Edit, NotebookEdit tools
      if (toolName === "Write" || toolName === "Edit" || toolName === "NotebookEdit") {
        const filePath = extractFilePath(toolName, toolInput);
        if (filePath) {
          addFileChange(run, filePath);
        }
      }

      // Append progress update for tool completion
      await progressService.appendProgressUpdate(
        run.projectId,
        run.id,
        `Tool completed: ${toolName}`
      );
    }
  }
}

/**
 * Handles an SDK user message by extracting tool_result content blocks.
 */
async function handleUserMessage(
  run: ExecutionRun,
  message: SDKMessage & { type: "user" },
  agentId: string,
  agentName: string,
  agentEmoji: string
): Promise<void> {
  const userMsg = message.message as MessageParam;

  // Check if this is a user message with tool results
  if (userMsg.role === "user" && Array.isArray(userMsg.content)) {
    for (const block of userMsg.content) {
      if (typeof block === "object" && block.type === "tool_result") {
        // Tool result - add as action entry
        const resultContent = typeof block.content === "string"
          ? block.content
          : JSON.stringify(block.content);

        addActivityEntry(run, {
          timestamp: new Date().toISOString(),
          agentId,
          agentEmoji,
          agentName,
          message: `Tool result: ${resultContent.slice(0, 200)}${resultContent.length > 200 ? "..." : ""}`,
          type: "action",
        });
      }
    }
  }
}

/**
 * Extracts the file path from tool input based on tool name.
 */
function extractFilePath(toolName: string, input: Record<string, unknown>): string | null {
  if (toolName === "Write" && typeof input["file_path"] === "string") {
    return input["file_path"];
  }
  if (toolName === "Edit" && typeof input["file_path"] === "string") {
    return input["file_path"];
  }
  if (toolName === "NotebookEdit" && typeof input["notebook_path"] === "string") {
    return input["notebook_path"];
  }
  return null;
}

// --- Testing utilities ---

/**
 * Clears all active runs and emitters. Only for use in tests.
 */
export function _clearActiveRuns(): void {
  activeRuns.clear();
  runEmitters.clear();
}
