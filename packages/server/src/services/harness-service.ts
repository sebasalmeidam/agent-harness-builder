import type { HarnessData, HarnessAgent, HarnessEdge } from "@agent-harness/runtime";
import * as teamService from "./team-service.js";
import type { Agent, Edge, Team } from "./team-service.js";

/**
 * Export a team as a portable harness JSON.
 *
 * Reads the team by ID, validates it has at least one agent,
 * and maps the team data into the versioned HarnessData format.
 *
 * @throws Error with code "NOT_FOUND" if team does not exist
 * @throws Error with code "NO_AGENTS" if team has zero agents
 */
export async function exportHarness(teamId: string): Promise<HarnessData> {
  const team = await teamService.get(teamId);

  if (!team) {
    const error = new Error("Team not found");
    (error as Error & { code: string }).code = "NOT_FOUND";
    throw error;
  }

  if (team.agents.length === 0) {
    const error = new Error("Team has no agents");
    (error as Error & { code: string }).code = "NO_AGENTS";
    throw error;
  }

  const agents: HarnessAgent[] = team.agents.map(mapAgent);
  const edges: HarnessEdge[] = team.edges.map(mapEdge);

  return {
    harnessVersion: "1.0",
    name: team.name,
    description: team.description,
    agents,
    edges,
  };
}

function mapAgent(agent: Agent): HarnessAgent {
  return {
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji,
    role: agent.role,
    goal: agent.goal,
    skills: [...agent.skills],
    practices: [...agent.practices],
    position: { x: agent.position.x, y: agent.position.y },
  };
}

function mapEdge(edge: Edge): HarnessEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    label: edge.label,
    failureRouting: edge.failureRouting,
    gate: edge.gate ? { type: edge.gate.type } : null,
  };
}

/**
 * Import a harness JSON to create a new team.
 *
 * Validates the harness structure, creates a team via team-service,
 * and populates it with the harness agents and edges.
 *
 * @throws Error with code "INVALID_HARNESS" if harness is missing required fields
 * @throws Error with code "DUPLICATE" (from team-service) if team name already exists
 */
export async function importHarness(harness: HarnessData): Promise<Team> {
  if (!harness.harnessVersion || typeof harness.harnessVersion !== "string") {
    const error = new Error("Harness is missing harnessVersion field");
    (error as Error & { code: string }).code = "INVALID_HARNESS";
    throw error;
  }

  if (!harness.name || typeof harness.name !== "string" || harness.name.trim().length === 0) {
    const error = new Error("Harness is missing name field");
    (error as Error & { code: string }).code = "INVALID_HARNESS";
    throw error;
  }

  if (!Array.isArray(harness.agents) || harness.agents.length === 0) {
    const error = new Error("Harness must have at least one agent");
    (error as Error & { code: string }).code = "INVALID_HARNESS";
    throw error;
  }

  // Create team shell via team-service (handles slug generation and duplicate detection)
  const team = await teamService.create({
    name: harness.name,
    description: harness.description ?? "",
  });

  // Map harness agents and edges back to team-service types
  const agents: Agent[] = harness.agents.map(harnessAgentToAgent);
  const edges: Edge[] = (harness.edges ?? []).map(harnessEdgeToEdge);

  // Populate team with agents and edges
  const updatedTeam = await teamService.update(team.id, {
    ...team,
    agents,
    edges,
  });

  // update should always succeed since we just created the team
  return updatedTeam!;
}

function harnessAgentToAgent(agent: HarnessAgent): Agent {
  return {
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji,
    role: agent.role,
    goal: agent.goal,
    skills: [...agent.skills],
    practices: [...agent.practices],
    position: { x: agent.position.x, y: agent.position.y },
  };
}

function harnessEdgeToEdge(edge: HarnessEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    label: edge.label,
    failureRouting: edge.failureRouting,
    gate: edge.gate ? { type: edge.gate.type } : null,
  };
}
