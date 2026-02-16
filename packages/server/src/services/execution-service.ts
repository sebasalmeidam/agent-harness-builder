import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { translateHarness, translateHarnessWithOrchestrator, executeWithSdk, resolveTools } from "@agent-harness/runtime";
import type {
  ExecutionRun,
  AgentStatus,
  ActivityEntry,
  ExecutionSummary,
  TranslatedTeam,
} from "@agent-harness/runtime";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import * as projectService from "./project-service.js";
import * as runService from "./run-service.js";
import * as taskService from "./task-service.js";
import * as teamService from "./team-service.js";
import { exportHarness } from "./harness-service.js";
import * as progressService from "./progress-service.js";
import * as configService from "./config-service.js";
import Anthropic from "@anthropic-ai/sdk";
import { composeExecutionPrompt } from "./prompt-composer.js";

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
  // Use orchestrator mode when team has multiple agents
  const translatedTeam = harness.agents.length > 1
    ? translateHarnessWithOrchestrator(harness, project.spec)
    : translateHarness(harness, project.spec);

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

  // Load project (for path and description)
  const project = await projectService.get(projectId);
  if (!project) {
    // Restore task status to previous status if project not found
    await taskService.update(projectId, taskId, { status: task.status });
    const error = new Error("Project not found");
    (error as Error & { code: string }).code = "NOT_FOUND";
    throw error;
  }

  // Load team data (for processWorkflow if available)
  const team = await teamService.get(task.teamId);

  // Load harness for SDK translation
  const harness = await exportHarness(task.teamId);

  // Compose rich execution prompt with project context, team process, and task
  // Inject attachments list into project for prompt composition
  if (project.path) {
    try {
      const { readdir } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const attachDir = join(project.path, "attachments");
      const files = await readdir(attachDir).catch(() => [] as string[]);
      if (files.length > 0) {
        (project as typeof project & { _attachments?: string[] })._attachments = files;
      }
    } catch { /* no attachments */ }
  }

  const executionPrompt = composeExecutionPrompt(project, task, team);

  // Translate harness with execution prompt
  // Use orchestrator mode when team has multiple agents
  const translatedTeam = harness.agents.length > 1
    ? translateHarnessWithOrchestrator(harness, executionPrompt)
    : translateHarness(harness, executionPrompt);

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
  const taskOptions: StartRunOptions = {
    taskDescription: task.description || task.title,
    checklist: task.checklist?.map((item) => item.description) ?? [],
  };
  executeTaskRun(run, translatedTeam, harness, taskOptions).catch((err: unknown) => {
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

/** Map of run IDs to their abort controllers for cancellation. */
const runAbortControllers = new Map<string, AbortController>();

/**
 * Cancels an active execution run.
 * Returns true if the run was found and cancelled, false otherwise.
 */
export async function cancelRun(
  projectId: string,
  runId: string
): Promise<boolean> {
  const run = activeRuns.get(runId);
  if (!run || run.projectId !== projectId || run.status !== "running") {
    return false;
  }

  // Abort the SDK execution if there's an abort controller
  const abortController = runAbortControllers.get(runId);
  if (abortController) {
    abortController.abort();
    runAbortControllers.delete(runId);
  }

  // Add cancellation activity entry
  addActivityEntry(run, {
    timestamp: new Date().toISOString(),
    agentId: "system",
    agentEmoji: "",
    agentName: "System",
    message: "Execution cancelled by user",
    type: "error",
  });

  // Complete the run as failed with cancellation message
  const startTime = new Date(run.startedAt).getTime();
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const summary: ExecutionSummary = {
    filesChanged: run.files.length,
    totalTime,
    iterations: run.activityLog.length,
    errors: run.activityLog.filter((e) => e.type === "error").length,
  };

  await completeRun(run, "failed", summary, "Execution cancelled by user");

  return true;
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

  // Periodically update checklist during execution (every 10 entries)
  if (run.taskId && run.activityLog.length % 10 === 0) {
    updateChecklistDuringExecution(run).catch(() => {});
  }
}

/**
 * Updates the task checklist mid-execution based on activity log so far.
 */
async function updateChecklistDuringExecution(run: ExecutionRun): Promise<void> {
  if (!run.taskId) return;
  const task = await taskService.get(run.projectId, run.taskId);
  if (!task) return;

  const updatedChecklist = updateChecklistFromResults(task, run.activityLog);
  const changed = updatedChecklist.some((item, i) =>
    item.completed !== task.checklist[i]?.completed
  );

  if (changed) {
    await taskService.update(run.projectId, run.taskId, {
      checklist: updatedChecklist,
    });
  }
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
 * Uses multiple heuristics:
 * 1. Explicit checklist markers (✓, [x], ✅) with item description
 * 2. Completion patterns with item keywords
 * 3. File creation/modification patterns for relevant items
 * 4. Direct mention of item number completion
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
    .join("\n");

  // Also track which files were changed
  const filesChanged = new Set<string>();
  for (const entry of activityLog) {
    const msg = entry.message.toLowerCase();
    // Extract file paths from "Using tool: Write" or similar messages
    const writeMatch = msg.match(/(?:write|edit|create|wrote|created).*?(?:file[:\s]+)?([a-z0-9_\-./]+\.[a-z]+)/i);
    if (writeMatch) {
      filesChanged.add(writeMatch[1]!.toLowerCase());
    }
  }

  // Completion patterns - expanded list
  const completionPatterns = [
    "completed",
    "finished",
    "done",
    "success",
    "implemented",
    "added",
    "created",
    "updated",
    "wrote",
    "fixed",
    "configured",
    "installed",
    "set up",
    "setup",
    "verified",
    "tested",
    "passed",
    "working",
    "✓",
    "✅",
    "[x]",
    "complete",
  ];

  // Patterns that indicate explicit checklist completion
  const explicitChecklistPatterns = [
    /checklist\s+item\s+(\d+)\s*(?:is\s+)?(?:done|completed|finished)/gi,
    /item\s+(\d+)\s*:?\s*(?:done|completed|finished)/gi,
    /completed\s+(?:checklist\s+)?item\s+(\d+)/gi,
    /\[x\]\s+\d+\./gi,
    /✓\s+\d+\./gi,
  ];

  // Update checklist items based on activity log content
  return task.checklist.map((item, index) => {
    if (item.completed) {
      // Already completed, no need to update
      return item;
    }

    const itemNum = index + 1;
    const descLower = item.description.toLowerCase();

    // Check for explicit checklist item completion mentions
    for (const pattern of explicitChecklistPatterns) {
      const matches = activityText.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && parseInt(match[1], 10) === itemNum) {
          return { ...item, completed: true };
        }
      }
    }

    // Check if activity explicitly mentions completing this item by description
    if (activityText.includes(`completed: ${descLower}`) ||
        activityText.includes(`done: ${descLower}`) ||
        activityText.includes(`✓ ${descLower}`) ||
        activityText.includes(`[x] ${descLower}`)) {
      return { ...item, completed: true };
    }

    // Extract keywords from checklist item description (words > 2 chars)
    const keywords = descLower
      .split(/\s+/)
      .filter((word) => word.length > 2 && /^[a-z]+$/.test(word))
      .filter((word) => !["the", "and", "for", "with", "from", "that", "this"].includes(word));

    // Check if file names in the checklist item were created/modified
    const fileExtensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html"];
    for (const ext of fileExtensions) {
      const filePattern = new RegExp(`([a-z0-9_\\-]+${ext.replace(".", "\\.")})`, "gi");
      const fileMatches = descLower.match(filePattern);
      if (fileMatches) {
        for (const file of fileMatches) {
          if (filesChanged.has(file.toLowerCase())) {
            return { ...item, completed: true };
          }
        }
      }
    }

    // Count how many item keywords appear in activity text
    const keywordMatches = keywords.filter((kw) =>
      activityText.includes(kw),
    ).length;

    // Count how many completion patterns appear in activity text
    const completionMatches = completionPatterns.filter((pattern) =>
      activityText.includes(pattern),
    ).length;

    // More lenient matching: 
    // - If 50%+ of keywords match AND at least 1 completion pattern
    // - Or if very specific keywords match (e.g., function names, file names)
    const keywordRatio = keywords.length > 0 ? keywordMatches / keywords.length : 0;
    const shouldComplete = (keywordRatio >= 0.5 && completionMatches >= 1) ||
                          (keywordMatches >= 3 && completionMatches >= 1);

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
/**
 * Generates a concise result summary using the user's default model.
 * Saves it to the run record.
 */
async function generateResultSummary(run: ExecutionRun): Promise<void> {
  const apiKey = await configService.getApiKey();
  if (!apiKey) return;

  const model = await configService.getDefaultModel();

  // Build a condensed version of the activity log (last 30 entries, truncated)
  const recentLog = run.activityLog
    .slice(-30)
    .map((e) => `[${e.agentName}] ${e.message.slice(0, 300)}`)
    .join("\n");

  const filesChanged = run.files.length > 0
    ? `\nFiles created/modified:\n${run.files.map((f) => `- ${f}`).join("\n")}`
    : "";

  const prompt = `You are summarizing the results of an automated task execution for a developer.

Activity log:
${recentLog}
${filesChanged}

Write a concise summary in 2-3 lines:
1. What was built/done
2. Key files to look at
3. How to test or run it (if applicable)

Be specific and actionable. No fluff.`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n");

    if (text) {
      run.resultSummary = text;
      await runService.save(run);
    }
  } catch (err) {
    console.error("Result summary generation failed:", err);
  }
}

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

  // Track checklist completion for summary
  let checklistCompleted = 0;
  let checklistTotal = 0;

  // Update task status and checklist if this run is associated with a task
  if (run.taskId) {
    const taskStatus = status === "completed" ? "done" : "failed";

    // Always try to update checklist based on activity log (completed, failed, or cancelled)
    const task = await taskService.get(run.projectId, run.taskId);
    if (task) {
      const updatedChecklist = updateChecklistFromResults(
        task,
        run.activityLog,
      );
      checklistTotal = updatedChecklist.length;
      checklistCompleted = updatedChecklist.filter(item => item.completed).length;
      await taskService.update(run.projectId, run.taskId, {
        status: taskStatus,
        checklist: updatedChecklist,
      });
    } else {
      await taskService.update(run.projectId, run.taskId, {
        status: taskStatus,
      });
    }
  }

  // Persist final run record
  await runService.save(run);

  // Update progress file with structured summary
  await progressService.appendProgressSummary(
    run.projectId,
    run.id,
    {
      status,
      completedAt: run.completedAt!,
      durationSeconds: summary.totalTime,
      filesChanged: summary.filesChanged,
      checklistCompleted,
      checklistTotal,
      costUsd: run.costUsd,
      error: errorMessage,
    }
  );

  // Emit run status event with extended summary
  emitRunEvent(run, {
    type: "run-status",
    data: {
      status,
      error: errorMessage,
      summary: {
        ...summary,
        checklistCompleted,
        checklistTotal,
        costUsd: run.costUsd ?? null,
      } as unknown as Record<string, unknown>,
    },
  });

  // Generate result summary asynchronously (don't block completion)
  if (status === "completed") {
    generateResultSummary(run).catch((err) => {
      console.error("Failed to generate result summary:", err);
    });
  }

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
  harness: { agents: Array<{ id: string; name: string; emoji: string; skills?: string[] }> },
  options?: StartRunOptions
): Promise<void> {
  await executeRun(run, translatedTeam, harness, options);
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
  const apiKey = await configService.getApiKey();
  if (!apiKey) {
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
    // Use project's configured path as working directory.
    // Falls back to internal data dir if no path is set.
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const dataDir = process.env["HARNESS_DATA_DIR"] ?? join(homedir(), ".agent-harness");
    const internalProjectDir = join(dataDir, "projects", project.id);

    let cwd = project.path || internalProjectDir;

    // Ensure the cwd exists
    try {
      const fs = await import("node:fs/promises");
      await fs.mkdir(cwd, { recursive: true });
    } catch {
      // If we can't create it, fall back to internal dir
      cwd = internalProjectDir;
      const fs = await import("node:fs/promises");
      await fs.mkdir(cwd, { recursive: true }).catch(() => {});
    }

    // Build prompt from task description + checklist, or fall back to project spec
    let prompt: string;
    if (options?.taskDescription) {
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
      prompt = project.spec || "";
    }

    // --- Sequential Multi-Agent Execution ---
    // Instead of relying on SDK subagent delegation (which has limited tool execution),
    // the harness orchestrates by running each agent as a separate SDK query() call.
    // This ensures each agent gets full tool access and proper execution turns.
    // The workflow order is: lead agent first, then teammates in sequence.

    const hasTeammates = translatedTeam.teammates.length > 0;

    // Build the ordered list of agents to execute
    interface AgentExecution {
      name: string;
      id: string;
      emoji: string;
      systemPrompt: string;
      model: string;
      skills: string[];
      isLead: boolean;
    }

    const agentQueue: AgentExecution[] = [];

    if (hasTeammates) {
      // Multi-agent: execute each agent sequentially
      // First agent gets the original prompt, subsequent agents get context from previous results
      for (const teammate of translatedTeam.teammates) {
        const hAgent = harnessAgents.find((a) => a.name === teammate.name);
        agentQueue.push({
          name: teammate.name,
          id: hAgent?.id || teammate.name,
          emoji: hAgent?.emoji || "🤖",
          systemPrompt: teammate.systemPrompt,
          model: teammate.model || leadAgent.model,
          skills: hAgent?.skills ?? [],
          isLead: false,
        });
      }
    } else {
      // Single agent: execute the lead directly
      const hAgent = harnessAgents.find((a) => a.id === leadId);
      agentQueue.push({
        name: leadName,
        id: leadId,
        emoji: leadEmoji,
        systemPrompt: leadAgent.systemPrompt,
        model: leadAgent.model,
        skills: hAgent?.skills ?? [],
        isLead: true,
      });
    }

    let iterationCount = 0;
    let errorCount = 0;
    let previousAgentResult = "";

    for (let agentIdx = 0; agentIdx < agentQueue.length; agentIdx++) {
      const currentAgent = agentQueue[agentIdx];
      const agentTools = resolveTools(currentAgent.skills, false);

      // Build agent-specific prompt
      let agentPrompt: string;
      if (agentIdx === 0) {
        // First agent gets the original task prompt
        agentPrompt = prompt;
      } else {
        // Subsequent agents get context from previous agent's work
        agentPrompt = `${prompt}\n\n## Context from Previous Agent\nThe previous team member completed their part. Their summary:\n${previousAgentResult}\n\nNow it's your turn. Continue the work based on the files and outputs already created. Review and build upon what was done.`;
      }

      // Update agent status to working
      updateAgentStatus(run, currentAgent.name, "working", currentAgent.emoji);

      // Add handoff activity entry
      if (agentIdx === 0 && hasTeammates) {
        addActivityEntry(run, {
          timestamp: new Date().toISOString(),
          agentId: "system",
          agentEmoji: "🎯",
          agentName: "Harness",
          message: `Starting workflow: ${agentQueue.map(a => a.name).join(" → ")}`,
          type: "action",
        });
      }
      if (agentIdx > 0) {
        addActivityEntry(run, {
          timestamp: new Date().toISOString(),
          agentId: "system",
          agentEmoji: "🎯",
          agentName: "Harness",
          message: `Handing off to ${currentAgent.name}`,
          type: "handoff",
        });
      }
      await runService.save(run);

      // Execute this agent's SDK query
      const sdkGenerator = executeWithSdk({
        systemPrompt: currentAgent.systemPrompt,
        model: currentAgent.model,
        cwd,
        prompt: agentPrompt,
        tools: agentTools,
        maxBudgetUsd: 3.0,
        apiKey,
      });

      let agentResult = "";

      try {
        for await (const message of sdkGenerator) {
          iterationCount++;

          if (message.type === "assistant") {
            await handleAssistantMessage(run, message, currentAgent.id, currentAgent.name, currentAgent.emoji);
          } else if (message.type === "user") {
            await handleUserMessage(run, message, currentAgent.id, currentAgent.name, currentAgent.emoji);
          } else if (message.type === "result") {
            // Store cost
            if (message.total_cost_usd) {
              run.costUsd = (run.costUsd || 0) + message.total_cost_usd;
            }

            if (message.subtype === "success") {
              agentResult = message.result || "Work completed successfully";

              addActivityEntry(run, {
                timestamp: new Date().toISOString(),
                agentId: currentAgent.id,
                agentEmoji: currentAgent.emoji,
                agentName: currentAgent.name,
                message: agentResult,
                type: "complete",
              });

              updateAgentStatus(run, currentAgent.name, "done", currentAgent.emoji);
              await runService.save(run);
            } else {
              // Agent failed
              errorCount++;
              const errorMessage = message.errors && message.errors.length > 0
                ? message.errors.join("; ")
                : `Agent failed: ${message.subtype}`;

              addActivityEntry(run, {
                timestamp: new Date().toISOString(),
                agentId: currentAgent.id,
                agentEmoji: currentAgent.emoji,
                agentName: currentAgent.name,
                message: errorMessage,
                type: "error",
              });

              updateAgentStatus(run, currentAgent.name, "blocked", currentAgent.emoji);
              await runService.save(run);

              // Don't continue to next agent if this one failed
              const totalTime = Math.round((Date.now() - startTime) / 1000);
              const summary: ExecutionSummary = {
                filesChanged: run.files.length,
                totalTime,
                iterations: iterationCount,
                errors: errorCount,
              };
              await completeRun(run, "failed", summary, errorMessage);
              return { executed: true };
            }

            // Break out of message loop for this agent (move to next agent)
            break;
          }

          // Persist intermediate state periodically
          if (iterationCount % 10 === 0) {
            await runService.save(run);
          }
        }
      } catch (err: unknown) {
        // Agent-level SDK error
        errorCount++;
        const errorMessage = classifyAndFormatSdkError(err);

        addActivityEntry(run, {
          timestamp: new Date().toISOString(),
          agentId: currentAgent.id,
          agentEmoji: currentAgent.emoji,
          agentName: currentAgent.name,
          message: errorMessage,
          type: "error",
        });

        updateAgentStatus(run, currentAgent.name, "blocked", currentAgent.emoji);

        const totalTime = Math.round((Date.now() - startTime) / 1000);
        const summary: ExecutionSummary = {
          filesChanged: run.files.length,
          totalTime,
          iterations: iterationCount,
          errors: errorCount,
        };
        await completeRun(run, "failed", summary, errorMessage);
        return { executed: true };
      }

      // Store result for next agent's context
      previousAgentResult = agentResult;
    }

    // All agents completed successfully
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const summary: ExecutionSummary = {
      filesChanged: run.files.length,
      totalTime,
      iterations: iterationCount,
      errors: errorCount,
    };
    await completeRun(run, "completed", summary, null);
    return { executed: true };

  } catch (err: unknown) {
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

      // Detect subagent delegation via Task or Agent tool
      // The Claude Agent SDK uses the "Agent" tool with subagent_type field
      if (toolName === "Task" || toolName === "Agent") {
        const delegatedAgent = typeof toolInput["agent"] === "string"
          ? toolInput["agent"]
          : typeof toolInput["subagent_type"] === "string"
            ? detectAgentFromDescription(toolInput["subagent_type"], run)
            : typeof toolInput["name"] === "string"
              ? detectAgentFromDescription(toolInput["name"], run)
              : typeof toolInput["description"] === "string"
                ? detectAgentFromDescription(toolInput["description"], run)
                : typeof toolInput["prompt"] === "string"
                  ? detectAgentFromDescription(toolInput["prompt"], run)
                  : null;

        if (delegatedAgent) {
          // Store the active delegation for matching with tool_result
          if (!(run as ExecutionRun & { _activeDelegations?: Map<string, string> })._activeDelegations) {
            (run as ExecutionRun & { _activeDelegations?: Map<string, string> })._activeDelegations = new Map();
          }
          (run as ExecutionRun & { _activeDelegations?: Map<string, string> })._activeDelegations!.set(block.id, delegatedAgent);

          // Find emoji for this agent
          const delegatedEmoji = Object.keys(run.agentStatuses).includes(delegatedAgent)
            ? "" : "";

          // Mark delegated agent as working
          updateAgentStatus(run, delegatedAgent, "working", delegatedEmoji);

          // Add handoff activity entry
          addActivityEntry(run, {
            timestamp: new Date().toISOString(),
            agentId,
            agentEmoji,
            agentName,
            message: `Delegating work to ${delegatedAgent}`,
            type: "handoff",
          });

          await runService.save(run);
          return;
        }
      }

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
        // Check if this is a Task tool result (agent completed delegation)
        const delegations = (run as ExecutionRun & { _activeDelegations?: Map<string, string> })._activeDelegations;
        const delegatedAgent = delegations?.get(block.tool_use_id);
        if (delegatedAgent) {
          // Mark delegated agent as done
          updateAgentStatus(run, delegatedAgent, "done", "");

          // Add completion activity for the delegated agent
          addActivityEntry(run, {
            timestamp: new Date().toISOString(),
            agentId: delegatedAgent,
            agentEmoji: "",
            agentName: delegatedAgent,
            message: "Work completed",
            type: "complete",
          });

          // Remove this delegation
          delegations!.delete(block.tool_use_id);

          await runService.save(run);
          continue;
        }

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
 * Attempts to detect which agent is being delegated to from the Task description.
 * Matches against known agent names in the run's agentStatuses.
 */
function detectAgentFromDescription(description: string, run: ExecutionRun): string | null {
  const agentNames = Object.keys(run.agentStatuses).filter((name) => name !== "Orchestrator");
  const descLower = description.toLowerCase();

  for (const name of agentNames) {
    if (descLower.includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
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

/**
 * Returns a promise that resolves when a run completes (or rejects on timeout).
 * Listens for the "run-status" event on the run's emitter.
 */
export function waitForRunCompletion(
  runId: string,
  timeoutMs = 600_000
): Promise<{ status: "completed" | "failed"; error: string | null }> {
  return new Promise((resolve, reject) => {
    const emitter = runEmitters.get(runId);
    if (!emitter) {
      // Check if run already completed
      const run = activeRuns.get(runId);
      if (run && run.status !== "running") {
        resolve({ status: run.status as "completed" | "failed", error: run.error });
        return;
      }
      reject(new Error("Run not found"));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Run timed out"));
    }, timeoutMs);

    function handler(event: RunEvent) {
      if (event.type === "run-status") {
        cleanup();
        resolve({
          status: event.data["status"] as "completed" | "failed",
          error: (event.data["error"] as string) ?? null,
        });
      }
    }

    function cleanup() {
      clearTimeout(timer);
      emitter!.off("event", handler);
    }

    emitter.on("event", handler);
  });
}

// --- Testing utilities ---

/**
 * Clears all active runs and emitters. Only for use in tests.
 */
export function _clearActiveRuns(): void {
  activeRuns.clear();
  runEmitters.clear();
}
