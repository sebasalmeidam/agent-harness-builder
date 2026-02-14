// --- Runtime Translator ---
// Converts HarnessData into Claude Agent SDK team structures.
// See ADR-005 Section 3.3 for the translation mapping specification.

import type { HarnessData, HarnessAgent, HarnessEdge } from "./harness-schema.js";
import type { TranslatedTeam, TranslatedAgent } from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Identifies the lead agent from harness data.
 * The lead is the target of the most "escalates-to" edges.
 * If no "escalates-to" edges exist, the first agent is the lead.
 */
export function identifyLeadAgent(
  agents: HarnessAgent[],
  edges: HarnessEdge[]
): HarnessAgent {
  if (agents.length === 0) {
    throw new Error("Cannot identify lead agent: agents array is empty");
  }

  const escalatesTo = edges.filter((e) => e.type === "escalates-to");

  if (escalatesTo.length === 0) {
    return agents[0];
  }

  // Count how many escalates-to edges target each agent
  const targetCounts = new Map<string, number>();
  for (const edge of escalatesTo) {
    const current = targetCounts.get(edge.target) ?? 0;
    targetCounts.set(edge.target, current + 1);
  }

  // Find the agent with the highest count
  let maxCount = 0;
  let leadId = "";
  for (const [agentId, count] of targetCounts) {
    if (count > maxCount) {
      maxCount = count;
      leadId = agentId;
    }
  }

  const leadAgent = agents.find((a) => a.id === leadId);
  if (!leadAgent) {
    // Fallback: if the escalates-to target is not found in agents, use first
    return agents[0];
  }

  return leadAgent;
}

/**
 * Builds a list of incoming edges for an agent (edges where the agent is the target).
 */
function getIncomingEdges(agentId: string, edges: HarnessEdge[]): HarnessEdge[] {
  return edges.filter((e) => e.target === agentId);
}

/**
 * Builds a list of outgoing edges for an agent (edges where the agent is the source).
 */
function getOutgoingEdges(agentId: string, edges: HarnessEdge[]): HarnessEdge[] {
  return edges.filter((e) => e.source === agentId);
}

/**
 * Formats an edge type into a human-readable relationship description.
 */
function describeEdgeType(type: HarnessEdge["type"]): string {
  switch (type) {
    case "passes-work-to":
      return "passes work to";
    case "reviews":
      return "reviews work from";
    case "escalates-to":
      return "escalates to";
  }
}

/**
 * Resolves an agent name by ID from the agents list.
 */
function getAgentName(agentId: string, agents: HarnessAgent[]): string {
  const agent = agents.find((a) => a.id === agentId);
  return agent ? agent.name : agentId;
}

/**
 * Builds the workflow context section of an agent's system prompt.
 * Describes incoming and outgoing edges for that agent.
 */
function buildWorkflowContext(
  agent: HarnessAgent,
  agents: HarnessAgent[],
  edges: HarnessEdge[]
): string {
  const incoming = getIncomingEdges(agent.id, edges);
  const outgoing = getOutgoingEdges(agent.id, edges);

  const lines: string[] = [];

  if (incoming.length > 0) {
    lines.push("Incoming workflow connections:");
    for (const edge of incoming) {
      const sourceName = getAgentName(edge.source, agents);
      lines.push(`- ${sourceName} ${describeEdgeType(edge.type)} you`);
    }
  }

  if (outgoing.length > 0) {
    lines.push("Outgoing workflow connections:");
    for (const edge of outgoing) {
      const targetName = getAgentName(edge.target, agents);
      lines.push(`- You ${describeEdgeType(edge.type)} ${targetName}`);
    }
  }

  return lines.join("\n");
}

/**
 * Builds a system prompt for a non-lead agent.
 * Includes role, goal, skills, practices, and workflow context.
 */
function buildAgentPrompt(
  agent: HarnessAgent,
  agents: HarnessAgent[],
  edges: HarnessEdge[]
): string {
  const sections: string[] = [];

  // Role and goal
  sections.push(`# Role: ${agent.role}`);
  sections.push(`## Goal\n${agent.goal}`);

  // Resolved skill entities with instructions
  if (agent.resolvedSkills && agent.resolvedSkills.length > 0) {
    const skillSections = agent.resolvedSkills
      .map((skill) => `### ${skill.name}\n${skill.instructions}`)
      .join("\n\n");
    sections.push(`## Skills\n${skillSections}`);
  }

  // Free-text skill tags
  if (agent.skills.length > 0) {
    const skillsList = agent.skills.map((s) => `- ${s}`).join("\n");
    sections.push(`## Tags\n${skillsList}`);
  }

  // Practices
  if (agent.practices.length > 0) {
    const practicesList = agent.practices.map((p) => `- ${p}`).join("\n");
    sections.push(`## Practices\n${practicesList}`);
  }

  // Workflow context
  const workflowContext = buildWorkflowContext(agent, agents, edges);
  if (workflowContext.length > 0) {
    sections.push(`## Workflow\n${workflowContext}`);
  }

  return sections.join("\n\n");
}

/**
 * Builds the full team workflow description string.
 * Describes all edges, gates, and failure routing.
 */
function buildWorkflowDescription(
  agents: HarnessAgent[],
  edges: HarnessEdge[]
): string {
  if (edges.length === 0) {
    return "This team has no defined workflow edges.";
  }

  const lines: string[] = ["Team Workflow:"];

  for (const edge of edges) {
    const sourceName = getAgentName(edge.source, agents);
    const targetName = getAgentName(edge.target, agents);
    let description = `- ${sourceName} ${describeEdgeType(edge.type)} ${targetName}`;

    if (edge.gate) {
      const gateDesc =
        edge.gate.type === "auto"
          ? "proceed automatically"
          : "pause for human approval";
      description += ` (gate: ${gateDesc})`;
    }

    if (edge.failureRouting === "loop-back") {
      description += ` (on failure: return work to ${sourceName})`;
    }

    lines.push(description);
  }

  return lines.join("\n");
}

/**
 * Builds a system prompt for the lead agent.
 * Includes everything from a regular agent prompt plus:
 * - Full team workflow description
 * - Gate definitions and failure routing rules
 * - Project specification
 * - Instructions to coordinate the team
 */
function buildLeadAgentPrompt(
  agent: HarnessAgent,
  agents: HarnessAgent[],
  edges: HarnessEdge[],
  projectSpec: string,
  workflowDescription: string
): string {
  const basePrompt = buildAgentPrompt(agent, agents, edges);

  const sections: string[] = [basePrompt];

  // Team composition
  const teamMembers = agents
    .filter((a) => a.id !== agent.id)
    .map((a) => `- ${a.name} (${a.role}): ${a.goal}`)
    .join("\n");

  if (teamMembers.length > 0) {
    sections.push(`## Team Members\n${teamMembers}`);
  }

  // Full workflow
  sections.push(`## Team Workflow\n${workflowDescription}`);

  // Project specification
  sections.push(`## Project Specification\n${projectSpec}`);

  // Coordination instructions
  sections.push(
    `## Coordination Instructions\nYou are the lead agent of this team. Coordinate the team members following the defined workflow. Decompose the project specification into tasks, assign them to the appropriate team members based on their roles and skills, and ensure the workflow edges, gates, and failure routing rules are followed.`
  );

  return sections.join("\n\n");
}

/**
 * Translates a HarnessData object into Claude Agent SDK team structures.
 *
 * @param harness - The harness data to translate
 * @param projectSpec - The project specification text
 * @returns TranslatedTeam containing lead agent, teammates, and workflow description
 * @throws Error if harness has no agents
 */
export function translateHarness(
  harness: HarnessData,
  projectSpec: string
): TranslatedTeam {
  if (harness.agents.length === 0) {
    throw new Error("Cannot translate harness: no agents defined");
  }

  const leadHarnessAgent = identifyLeadAgent(harness.agents, harness.edges);
  const workflowDescription = buildWorkflowDescription(
    harness.agents,
    harness.edges
  );

  // Build lead agent
  const leadPrompt = buildLeadAgentPrompt(
    leadHarnessAgent,
    harness.agents,
    harness.edges,
    projectSpec,
    workflowDescription
  );

  const leadAgent: TranslatedAgent = {
    name: leadHarnessAgent.name,
    systemPrompt: leadPrompt,
    model: DEFAULT_MODEL,
  };

  // Build teammates (all agents except the lead)
  const teammates: TranslatedAgent[] = harness.agents
    .filter((a) => a.id !== leadHarnessAgent.id)
    .map((a) => ({
      name: a.name,
      systemPrompt: buildAgentPrompt(a, harness.agents, harness.edges),
      model: DEFAULT_MODEL,
    }));

  return {
    leadAgent,
    teammates,
    workflowDescription,
  };
}
