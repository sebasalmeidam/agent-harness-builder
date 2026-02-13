import type { HarnessData, HarnessAgent, HarnessEdge } from "@agent-harness/runtime";
import * as teamService from "./team-service.js";
import type { Agent, Edge } from "./team-service.js";

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
