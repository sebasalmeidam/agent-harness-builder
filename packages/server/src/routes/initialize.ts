import { Router } from "express";
import * as projectService from "../services/project-service.js";
import * as taskService from "../services/task-service.js";
import * as initializeService from "../services/initialize-service.js";

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

// POST /api/projects/:id/initialize - Initialize project with AI suggestions
router.post("/", async (req, res) => {
  try {
    const projectId = getParam(req.params, "id");

    // Verify project exists
    const project = await projectService.get(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Verify project has 0 tasks
    const taskCount = await taskService.count(projectId);
    if (taskCount > 0) {
      res.status(400).json({ error: "Project already has tasks" });
      return;
    }

    // Analyze directory
    const directoryContext = await initializeService.analyzeDirectory(
      project.path
    );

    // Generate suggestions
    let suggestions: initializeService.TaskSuggestion[];
    try {
      suggestions = await initializeService.generateSuggestions(
        project.description,
        directoryContext
      );
    } catch (err) {
      if (err instanceof Error) {
        const errorWithCode = err as Error & { code?: string };
        if (errorWithCode.code === "NO_API_KEY") {
          res.status(400).json({ error: "ANTHROPIC_API_KEY not configured" });
          return;
        }
        if (errorWithCode.code === "TIMEOUT") {
          res.status(504).json({ error: "Request timeout" });
          return;
        }
        if (errorWithCode.code === "PARSE_ERROR") {
          res.status(500).json({ error: "Failed to parse AI response" });
          return;
        }
      }
      throw err;
    }

    res.json({ suggestions });
  } catch (err) {
    console.error("Failed to initialize project:", err);
    res.status(500).json({ error: "Failed to initialize project" });
  }
});

export { router as initializeRouter };
