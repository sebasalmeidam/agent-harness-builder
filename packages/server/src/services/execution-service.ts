import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { translateHarness } from "@agent-harness/runtime";
import type {
  ExecutionRun,
  AgentStatus,
  ActivityEntry,
  ExecutionSummary,
  TranslatedTeam,
} from "@agent-harness/runtime";
import * as projectService from "./project-service.js";
import * as runService from "./run-service.js";
import { exportHarness } from "./harness-service.js";

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
 * Starts a new execution run for a project.
 *
 * Validates that the project exists, has a team assigned, and has a non-empty spec.
 * Loads the team, exports the harness, translates it, creates the initial run record,
 * and begins asynchronous execution.
 *
 * @returns The run ID of the newly created run.
 * @throws Error with code "NOT_FOUND" if the project does not exist.
 * @throws Error with code "NO_TEAM" if the project has no assigned team.
 * @throws Error with code "NO_SPEC" if the project spec is empty.
 */
export async function startRun(
  projectId: string
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
  executeRun(run, translatedTeam, harness.agents).catch((err: unknown) => {
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
 * Completes a run with the given status and summary.
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

  // Persist final run record
  await runService.save(run);

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
  harnessAgents: Array<{ id: string; name: string; emoji: string }>
): Promise<void> {
  const startTime = Date.now();
  let iterations = 0;
  let errorCount = 0;

  // Helper to find emoji for an agent by name
  function getAgentEmoji(agentName: string): string {
    const agent = harnessAgents.find((a) => a.name === agentName);
    return agent?.emoji ?? "";
  }

  // Helper to find agent ID by name
  function getAgentId(agentName: string): string {
    const agent = harnessAgents.find((a) => a.name === agentName);
    return agent?.id ?? agentName;
  }

  try {
    // --- Attempt real SDK execution ---
    // Try to import and use the Claude Agent SDK.
    // If it fails (not installed, wrong API, etc.), fall back to simulation.
    const sdkResult = await tryRealSdkExecution(run, translatedTeam, harnessAgents);
    if (sdkResult.executed) {
      return; // SDK handled everything
    }

    // --- Simulated execution (SDK not available) ---

    // Step 1: Lead agent starts working
    const leadName = translatedTeam.leadAgent.name;
    const leadEmoji = getAgentEmoji(leadName);
    const leadId = getAgentId(leadName);

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
      const teammateEmoji = getAgentEmoji(teammateName);
      const teammateId = getAgentId(teammateName);

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
 * This function is structured as a try/catch around a dynamic import so that
 * the service does not require the SDK to be installed for testing or
 * development without an API key.
 */
async function tryRealSdkExecution(
  _run: ExecutionRun,
  _translatedTeam: TranslatedTeam,
  _harnessAgents: Array<{ id: string; name: string; emoji: string }>
): Promise<{ executed: boolean }> {
  // Gate real SDK execution on API key presence.
  // When the key is not set, return { executed: false } so the caller
  // falls back to simulation. This keeps simulation running freely
  // without requiring any credentials.
  if (!process.env["ANTHROPIC_API_KEY"]) {
    return { executed: false };
  }

  try {
    // Dynamic import of the Claude Agent SDK
    // The SDK package (@anthropic-ai/claude-code) provides a programmatic API
    // for creating and running agent teams.
    //
    // When the SDK is properly installed and the ANTHROPIC_API_KEY is set,
    // this section would:
    // 1. Create agents from translatedTeam configuration
    // 2. Set up the lead agent with teammates
    // 3. Start the team execution with the project spec
    // 4. Listen to streaming events for agent status changes
    // 5. Map SDK events to our state machine (idle/working/done/blocked)
    // 6. Capture file changes from tool_use events
    //
    // For now, we return { executed: false } to use the simulation path,
    // since the Claude Agent SDK's programmatic Agent Teams API is not
    // yet stable for this use case.
    return { executed: false };
  } catch {
    // SDK not available or import failed -- fall back to simulation
    return { executed: false };
  }
}

// --- Testing utilities ---

/**
 * Clears all active runs and emitters. Only for use in tests.
 */
export function _clearActiveRuns(): void {
  activeRuns.clear();
  runEmitters.clear();
}
