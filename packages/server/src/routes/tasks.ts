import { Router } from "express";
import * as taskService from "../services/task-service.js";
import * as projectService from "../services/project-service.js";
import * as executionService from "../services/execution-service.js";

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

export { router as tasksRouter };
