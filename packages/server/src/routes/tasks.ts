import { Router } from "express";
import * as taskService from "../services/task-service.js";
import * as projectService from "../services/project-service.js";
import * as teamService from "../services/team-service.js";
import * as executionService from "../services/execution-service.js";
import * as runService from "../services/run-service.js";
import { previewExecutionPrompt } from "../services/prompt-composer.js";

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

// GET /api/projects/:id/tasks - List all tasks for a project
router.get("/", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");

    // Verify project exists
    const project = await projectService.get(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const tasks = await taskService.list(projectId);
    res.json(tasks);
  } catch (err) {
    console.error("Failed to list tasks:", err);
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

// POST /api/projects/:id/tasks - Create a new task
router.post("/", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");

    // Verify project exists
    const project = await projectService.get(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const { title, description, checklist } = req.body as {
      title?: string;
      description?: string;
      checklist?: taskService.ChecklistItem[];
    };

    // Validate title
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "Task title is required" });
      return;
    }

    const task = await taskService.create(projectId, {
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      checklist: Array.isArray(checklist) ? checklist : [],
    });

    res.status(201).json(task);
  } catch (err) {
    console.error("Failed to create task:", err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// GET /api/projects/:id/tasks/:taskId - Get a single task
router.get("/:taskId", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const taskId = getParam(req.params, "taskId");

    const task = await taskService.get(projectId, taskId);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(task);
  } catch (err) {
    console.error("Failed to get task:", err);
    res.status(500).json({ error: "Failed to get task" });
  }
});

// PUT /api/projects/:id/tasks/:taskId - Update a task
router.put("/:taskId", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const taskId = getParam(req.params, "taskId");

    const body = req.body;

    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Request body is required" });
      return;
    }

    // Strip status -- managed by execution engine (ADR-021), not via PUT
    const { status: _status, ...updates } = body as Record<string, unknown>;

    const updatedTask = await taskService.update(projectId, taskId, updates);
    if (!updatedTask) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(updatedTask);
  } catch (err) {
    console.error("Failed to update task:", err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// POST /api/projects/:id/tasks/run-all - Execute all pending tasks sequentially
router.post("/run-all", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");

    // Get all tasks in order
    const tasks = await taskService.list(projectId);
    const pendingTasks = tasks.filter(
      (t) => t.status === "pending" || t.status === "failed"
    );

    // Validate all pending tasks have teams
    const unassigned = pendingTasks.filter((t) => !t.teamId);
    if (unassigned.length > 0) {
      res.status(400).json({
        error: "All tasks must have a team assigned",
        unassignedTasks: unassigned.map((t) => ({ id: t.id, title: t.title })),
      });
      return;
    }

    if (pendingTasks.length === 0) {
      res.status(400).json({ error: "No pending tasks to execute" });
      return;
    }

    // Return immediately with the task queue, then execute in background
    const taskQueue = pendingTasks.map((t) => ({ id: t.id, title: t.title }));
    res.json({ queued: taskQueue.length, tasks: taskQueue });

    // Execute sequentially in background
    (async () => {
      for (const task of pendingTasks) {
        try {
          const { runId } = await executionService.startTaskRun(projectId, task.id);
          const result = await executionService.waitForRunCompletion(runId);
          if (result.status === "failed") {
            // Stop on failure
            console.log(`Run-all stopped: task "${task.title}" failed: ${result.error}`);
            break;
          }
        } catch (err) {
          console.error(`Run-all error on task "${task.title}":`, err);
          break;
        }
      }
    })();
  } catch (err) {
    console.error("Failed to start run-all:", err);
    res.status(500).json({ error: "Failed to start run-all" });
  }
});

// PATCH /api/projects/:id/tasks/reorder - Reorder tasks
router.patch("/reorder", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");

    const { taskIds } = req.body as { taskIds?: string[] };
    if (!Array.isArray(taskIds)) {
      res.status(400).json({ error: "taskIds array is required" });
      return;
    }

    const tasks = await taskService.reorder(projectId, taskIds);
    res.json(tasks);
  } catch (err) {
    console.error("Failed to reorder tasks:", err);
    res.status(500).json({ error: "Failed to reorder tasks" });
  }
});

// DELETE /api/projects/:id/tasks/:taskId - Delete a task
router.delete("/:taskId", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const taskId = getParam(req.params, "taskId");

    const deleted = await taskService.remove(projectId, taskId);
    if (!deleted) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete task:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// POST /api/projects/:id/tasks/:taskId/execute - Execute a task
router.post("/:taskId/execute", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const taskId = getParam(req.params, "taskId");

    const { runId } = await executionService.startTaskRun(projectId, taskId);
    res.json({ runId });
  } catch (err) {
    if (err instanceof Error) {
      const errorWithCode = err as Error & { code?: string };

      if (errorWithCode.code === "NOT_FOUND") {
        res.status(404).json({ error: err.message });
        return;
      }

      if (errorWithCode.code === "NO_TEAM" || errorWithCode.code === "INVALID_STATUS") {
        res.status(400).json({ error: err.message });
        return;
      }
    }

    console.error("Failed to execute task:", err);
    res.status(500).json({ error: "Failed to execute task" });
  }
});

// GET /api/projects/:id/tasks/:taskId/runs - List execution runs for a task
router.get("/:taskId/runs", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const taskId = getParam(req.params, "taskId");

    // Verify task exists
    const task = await taskService.get(projectId, taskId);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Get all runs for the project, then filter by taskId
    const allRuns = await runService.list(projectId);
    
    // Read full run data to filter by taskId
    const taskRuns = [];
    for (const runSummary of allRuns) {
      const fullRun = await runService.get(projectId, runSummary.id);
      if (fullRun && fullRun.taskId === taskId) {
        taskRuns.push({
          id: fullRun.id,
          status: fullRun.status,
          startedAt: fullRun.startedAt,
          completedAt: fullRun.completedAt,
          costUsd: fullRun.costUsd ?? null,
          error: fullRun.error,
        });
      }
    }

    res.json(taskRuns);
  } catch (err) {
    console.error("Failed to list task runs:", err);
    res.status(500).json({ error: "Failed to list task runs" });
  }
});

// GET /api/projects/:id/tasks/:taskId/prompt - Get execution prompt preview
router.get("/:taskId/prompt", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");
    const taskId = getParam(req.params, "taskId");

    // Load task
    const task = await taskService.get(projectId, taskId);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Load project
    const project = await projectService.get(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Load team if assigned
    let team = null;
    if (task.teamId) {
      team = await teamService.get(task.teamId);
    }

    // Generate prompt preview
    const prompt = previewExecutionPrompt(project, task, team);

    res.json({ prompt });
  } catch (err) {
    console.error("Failed to get prompt preview:", err);
    res.status(500).json({ error: "Failed to get prompt preview" });
  }
});

export { router as tasksRouter };
