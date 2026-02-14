import { Router } from "express";
import * as skillService from "../services/skill-service.js";

const router = Router();

// GET /api/skills - List all skills
router.get("/", async (_req, res) => {
  try {
    const skills = await skillService.list();
    res.json(skills);
  } catch (err) {
    console.error("Failed to list skills:", err);
    res.status(500).json({ error: "Failed to list skills" });
  }
});

// POST /api/skills - Create a new skill
router.post("/", async (req, res) => {
  const { name, description, instructions } = req.body as {
    name?: string;
    description?: string;
    instructions?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Skill name is required" });
    return;
  }

  if (!description || typeof description !== "string") {
    res.status(400).json({ error: "Skill description is required" });
    return;
  }

  if (!instructions || typeof instructions !== "string") {
    res.status(400).json({ error: "Skill instructions are required" });
    return;
  }

  try {
    const skill = await skillService.create({
      name: name.trim(),
      description: description.trim(),
      instructions: instructions,
    });
    res.status(201).json(skill);
  } catch (err) {
    if (err instanceof Error && (err as Error & { code: string }).code === "DUPLICATE") {
      res.status(409).json({ error: "A skill with this name already exists" });
      return;
    }
    console.error("Failed to create skill:", err);
    res.status(500).json({ error: "Failed to create skill" });
  }
});

// GET /api/skills/:id - Get a single skill
router.get("/:id", async (req, res) => {
  try {
    const skill = await skillService.get(req.params["id"]!);
    if (!skill) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(skill);
  } catch (err) {
    console.error("Failed to get skill:", err);
    res.status(500).json({ error: "Failed to get skill" });
  }
});

// PUT /api/skills/:id - Update a skill
router.put("/:id", async (req, res) => {
  const { name, description, instructions } = req.body as {
    name?: string;
    description?: string;
    instructions?: string;
  };

  // Validate that at least one field is provided
  if (name === undefined && description === undefined && instructions === undefined) {
    res.status(400).json({ error: "At least one field must be provided for update" });
    return;
  }

  // Validate name if provided
  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    res.status(400).json({ error: "Skill name must be a non-empty string" });
    return;
  }

  // Validate description if provided
  if (description !== undefined && typeof description !== "string") {
    res.status(400).json({ error: "Skill description must be a string" });
    return;
  }

  // Validate instructions if provided
  if (instructions !== undefined && typeof instructions !== "string") {
    res.status(400).json({ error: "Skill instructions must be a string" });
    return;
  }

  try {
    const updated = await skillService.update(req.params["id"]!, {
      name,
      description,
      instructions,
    });
    if (!updated) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof Error && (err as Error & { code: string }).code === "DUPLICATE") {
      res.status(409).json({ error: "A skill with this name already exists" });
      return;
    }
    console.error("Failed to update skill:", err);
    res.status(500).json({ error: "Failed to update skill" });
  }
});

// DELETE /api/skills/:id - Delete a skill (with cascade)
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params["id"]!;

    // First remove from all teams
    await skillService.removeSkillFromAllTeams(id);

    // Then delete the skill
    const deleted = await skillService.remove(id);
    if (!deleted) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete skill:", err);
    res.status(500).json({ error: "Failed to delete skill" });
  }
});

export { router as skillsRouter };
