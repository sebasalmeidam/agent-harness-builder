import { Router } from "express";
import * as generationService from "../services/generation-service.js";
import * as skillService from "../services/skill-service.js";
import * as teamService from "../services/team-service.js";

const router = Router();

// POST /api/generate/skill-instructions - Generate instructions for a skill
router.post("/skill-instructions", async (req, res) => {
  const { name, description } = req.body as {
    name?: string;
    description?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Skill name is required" });
    return;
  }

  if (!description || typeof description !== "string" || description.trim().length === 0) {
    res.status(400).json({ error: "Skill description is required" });
    return;
  }

  try {
    const instructions = await generationService.generateSkillInstructions(
      name.trim(),
      description.trim()
    );
    res.json({ instructions });
  } catch (err) {
    if (err instanceof Error && (err as Error & { code: string }).code === "NO_API_KEY") {
      res.status(400).json({ error: "API key not configured. Set it in Settings." });
      return;
    }
    console.error("Failed to generate skill instructions:", err);
    res.status(500).json({ error: "Failed to generate instructions" });
  }
});

// POST /api/generate/agent-persona - Generate persona for an agent
router.post("/agent-persona", async (req, res) => {
  const { name, role, capabilities, skillIds } = req.body as {
    name?: string;
    role?: string;
    capabilities?: string;
    skillIds?: string[];
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Agent name is required" });
    return;
  }

  if (!role || typeof role !== "string") {
    res.status(400).json({ error: "Agent role is required" });
    return;
  }

  try {
    // Load skills if skillIds provided
    const skills: generationService.Skill[] = [];
    if (skillIds && Array.isArray(skillIds)) {
      for (const skillId of skillIds) {
        const skill = await skillService.get(skillId);
        if (skill) {
          skills.push(skill);
        }
      }
    }

    const persona = await generationService.generateAgentPersona(
      name.trim(),
      role.trim(),
      capabilities?.trim() || "",
      skills
    );
    res.json({ persona });
  } catch (err) {
    if (err instanceof Error && (err as Error & { code: string }).code === "NO_API_KEY") {
      res.status(400).json({ error: "API key not configured. Set it in Settings." });
      return;
    }
    console.error("Failed to generate agent persona:", err);
    res.status(500).json({ error: "Failed to generate persona" });
  }
});

// POST /api/generate/team-workflow - Generate workflow for a team
router.post("/team-workflow", async (req, res) => {
  const { teamId } = req.body as {
    teamId?: string;
  };

  if (!teamId || typeof teamId !== "string") {
    res.status(400).json({ error: "Team ID is required" });
    return;
  }

  try {
    // Load team
    const team = await teamService.get(teamId);
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    // Convert team agents and edges to the expected format
    const agents: generationService.Agent[] = team.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      goal: agent.goal,
      skills: agent.skills,
      skillIds: agent.skillIds,
    }));

    const edges: generationService.Edge[] = team.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label,
    }));

    const workflow = await generationService.generateTeamWorkflow(
      agents,
      edges,
      team.description
    );
    res.json({ workflow });
  } catch (err) {
    if (err instanceof Error && (err as Error & { code: string }).code === "NO_API_KEY") {
      res.status(400).json({ error: "API key not configured. Set it in Settings." });
      return;
    }
    console.error("Failed to generate team workflow:", err);
    res.status(500).json({ error: "Failed to generate workflow" });
  }
});

export { router as generateRouter };
