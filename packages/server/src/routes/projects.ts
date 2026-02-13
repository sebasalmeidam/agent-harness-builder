import { Router } from "express";
import * as projectService from "../services/project-service.js";

const router = Router();

// GET /api/projects - List all projects
router.get("/", async (_req, res) => {
  try {
    const projects = await projectService.list();
    res.json(projects);
  } catch (err) {
    console.error("Failed to list projects:", err);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// POST /api/projects - Create a new project
router.post("/", async (req, res) => {
  const { name, description, gitUrl, emoji } = req.body as {
    name?: string;
    description?: string;
    gitUrl?: string;
    emoji?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  try {
    const { project, cloneResult } = await projectService.create({
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      gitUrl: typeof gitUrl === "string" ? gitUrl : undefined,
      emoji: typeof emoji === "string" ? emoji : undefined,
    });

    const response: Record<string, unknown> = { ...project };
    if (cloneResult && !cloneResult.success) {
      response["cloneWarning"] = cloneResult.error ?? "Clone failed";
    }

    res.status(201).json(response);
  } catch (err) {
    if (
      err instanceof Error &&
      (err as Error & { code: string }).code === "DUPLICATE"
    ) {
      res
        .status(409)
        .json({ error: "A project with this name already exists" });
      return;
    }
    console.error("Failed to create project:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// GET /api/projects/:id - Get a single project
router.get("/:id", async (req, res) => {
  try {
    const project = await projectService.get(req.params["id"]!);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  } catch (err) {
    console.error("Failed to get project:", err);
    res.status(500).json({ error: "Failed to get project" });
  }
});

// PUT /api/projects/:id - Update a project (spec, teamId, etc.)
router.put("/:id", async (req, res) => {
  const updates = req.body;

  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Request body is required" });
    return;
  }

  try {
    const updated = await projectService.update(req.params["id"]!, updates);
    if (!updated) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("Failed to update project:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// PATCH /api/projects/:id - Partial update of a project
router.patch("/:id", async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Request body is required" });
    return;
  }

  // Validate individual field types when present
  const errors: string[] = [];

  if ("name" in body) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      errors.push("name must be a non-empty string");
    }
  }

  if ("description" in body) {
    if (typeof body.description !== "string") {
      errors.push("description must be a string");
    }
  }

  if ("spec" in body) {
    if (typeof body.spec !== "string") {
      errors.push("spec must be a string");
    }
  }

  if ("teamId" in body) {
    if (body.teamId !== null && typeof body.teamId !== "string") {
      errors.push("teamId must be a string or null");
    }
  }

  if ("emoji" in body) {
    if (typeof body.emoji !== "string") {
      errors.push("emoji must be a string");
    }
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join("; ") });
    return;
  }

  // Extract only allowed fields, strip non-updatable fields
  const allowedFields = ["name", "description", "spec", "teamId", "emoji"] as const;
  const validUpdates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      validUpdates[field] = body[field];
    }
  }

  if (Object.keys(validUpdates).length === 0) {
    res.status(400).json({ error: "Request body must contain at least one updatable field (name, description, spec, teamId, emoji)" });
    return;
  }

  try {
    const updated = await projectService.update(req.params["id"]!, validUpdates);
    if (!updated) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("Failed to update project:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id - Delete a project
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await projectService.remove(req.params["id"]!);
    if (!deleted) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete project:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export { router as projectsRouter };
