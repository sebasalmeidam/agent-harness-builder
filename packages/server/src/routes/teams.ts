import { Router } from "express";
import * as teamService from "../services/team-service.js";

const router = Router();

// GET /api/teams - List all teams
router.get("/", async (_req, res) => {
  try {
    const teams = await teamService.list();
    res.json(teams);
  } catch (err) {
    console.error("Failed to list teams:", err);
    res.status(500).json({ error: "Failed to list teams" });
  }
});

// POST /api/teams - Create a new team
router.post("/", async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Team name is required" });
    return;
  }

  try {
    const team = await teamService.create({
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
    });
    res.status(201).json(team);
  } catch (err) {
    if (err instanceof Error && (err as Error & { code: string }).code === "DUPLICATE") {
      res.status(409).json({ error: "A team with this name already exists" });
      return;
    }
    console.error("Failed to create team:", err);
    res.status(500).json({ error: "Failed to create team" });
  }
});

// GET /api/teams/:id - Get a single team
router.get("/:id", async (req, res) => {
  try {
    const team = await teamService.get(req.params["id"]!);
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }
    res.json(team);
  } catch (err) {
    console.error("Failed to get team:", err);
    res.status(500).json({ error: "Failed to get team" });
  }
});

// PUT /api/teams/:id - Update a team
router.put("/:id", async (req, res) => {
  try {
    const updated = await teamService.update(req.params["id"]!, req.body);
    if (!updated) {
      res.status(404).json({ error: "Team not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("Failed to update team:", err);
    res.status(500).json({ error: "Failed to update team" });
  }
});

// DELETE /api/teams/:id - Delete a team
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await teamService.remove(req.params["id"]!);
    if (!deleted) {
      res.status(404).json({ error: "Team not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete team:", err);
    res.status(500).json({ error: "Failed to delete team" });
  }
});

export { router as teamsRouter };
