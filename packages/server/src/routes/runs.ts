import { Router } from "express";
import * as executionService from "../services/execution-service.js";
import * as runService from "../services/run-service.js";
import * as projectService from "../services/project-service.js";

const router = Router({ mergeParams: true });

/**
 * Safely extracts a route parameter as a string.
 * Express 5 with mergeParams types params as string | string[].
 */
function getParam(
  params: Record<string, string | string[]>,
  key: string
): string {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

// POST /api/projects/:id/runs - Trigger a new execution run
router.post("/", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const { runId } = await executionService.startRun(projectId);

    // Fetch the initial run record to return status and startedAt
    const run = executionService.getActiveRun(runId);
    res.status(201).json({
      id: runId,
      status: run?.status ?? "running",
      startedAt: run?.startedAt ?? new Date().toISOString(),
    });
  } catch (err) {
    const error = err as Error & { code?: string };

    if (error.code === "NOT_FOUND") {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (error.code === "NO_TEAM") {
      res.status(400).json({ error: "Project has no team assigned" });
      return;
    }
    if (error.code === "NO_SPEC") {
      res.status(400).json({ error: "Project spec is empty" });
      return;
    }
    console.error("Failed to trigger run:", err);
    res.status(500).json({ error: "Failed to trigger execution run" });
  }
});

// GET /api/projects/:id/runs - List execution runs for a project
router.get("/", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");

    // Verify project exists
    const project = await projectService.get(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const runs = await runService.list(projectId);
    res.json(runs);
  } catch (err) {
    console.error("Failed to list runs:", err);
    res.status(500).json({ error: "Failed to list runs" });
  }
});

// GET /api/projects/:id/runs/:runId - Get a single run's full data
router.get("/:runId", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const runId = getParam(req.params, "runId");

    // Check active runs first (in-progress runs have the latest state in memory)
    const activeRun = executionService.getActiveRun(runId);
    if (activeRun && activeRun.projectId === projectId) {
      res.json(activeRun);
      return;
    }

    // Fall back to persisted run data
    const run = await runService.get(projectId, runId);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.json(run);
  } catch (err) {
    console.error("Failed to get run:", err);
    res.status(500).json({ error: "Failed to get run" });
  }
});

// GET /api/projects/:id/runs/:runId/events - SSE stream for real-time events
router.get("/:runId/events", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const runId = getParam(req.params, "runId");

    // Check if the run exists (active or persisted)
    const activeRun = executionService.getActiveRun(runId);
    let run =
      activeRun && activeRun.projectId === projectId ? activeRun : null;

    if (!run) {
      const persistedRun = await runService.get(projectId, runId);
      if (!persistedRun) {
        res.status(404).json({ error: "Run not found" });
        return;
      }
      run = persistedRun;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send initial connected event with current state snapshot
    const connectedData = {
      status: run.status,
      agentStatuses: run.agentStatuses,
      activityLog: run.activityLog,
      files: run.files,
      summary: run.summary,
      error: run.error,
    };
    res.write(`event: connected\ndata: ${JSON.stringify(connectedData)}\n\n`);

    // If the run is already completed or failed, close the connection
    if (run.status === "completed" || run.status === "failed") {
      res.end();
      return;
    }

    // Subscribe to live events for active runs
    const callback: executionService.RunEventCallback = (event) => {
      res.write(
        `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
      );

      // Close connection after run-status event (run completed or failed)
      if (event.type === "run-status") {
        res.end();
      }
    };

    executionService.onRunEvent(runId, callback);

    // Handle client disconnect
    req.on("close", () => {
      executionService.offRunEvent(runId, callback);
    });
  } catch (err) {
    console.error("Failed to establish SSE connection:", err);
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to establish SSE connection" });
    }
  }
});

export { router as runsRouter };
