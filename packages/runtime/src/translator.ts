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
 * - Teammates available for delegation with skills and workflow relationships
 * - Delegation instructions for using the Task tool
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

  // Team composition with skills and workflow relationships
  const teammates = agents.filter((a) => a.id !== agent.id);

  if (teammates.length > 0) {
    const teammateDescriptions: string[] = [];

    for (const teammate of teammates) {
      const lines: string[] = [];
      lines.push(`### ${teammate.name}`);
      lines.push(`- **Role:** ${teammate.role}`);
      lines.push(`- **Goal:** ${teammate.goal}`);

      if (teammate.skills.length > 0) {
        lines.push(`- **Skills:** ${teammate.skills.join(", ")}`);
      }

      // Add workflow relationships for this teammate
      const teammateOutgoing = getOutgoingEdges(agent.id, edges).filter(
        (e) => e.target === teammate.id
      );
      const teammateIncoming = getIncomingEdges(teammate.id, edges).filter(
        (e) => e.source === agent.id
      );

      const workflowLines: string[] = [];
      for (const edge of teammateOutgoing) {
        workflowLines.push(`You ${describeEdgeType(edge.type)} ${teammate.name}`);
      }
      for (const edge of teammateIncoming) {
        workflowLines.push(`${teammate.name} ${describeEdgeType(edge.type)} you`);
      }

      if (workflowLines.length > 0) {
        lines.push(`- **Workflow:** ${workflowLines.join("; ")}`);
      }

      teammateDescriptions.push(lines.join("\n"));
    }

    sections.push(
      `## Teammates Available for Delegation\n\n${teammateDescriptions.join("\n\n")}`
    );

    // Add delegation instructions
    sections.push(
      `## Delegation Instructions\n\nYou can delegate subtasks to your teammates using the Task tool. When delegating:\n- Match the subtask to the teammate whose skills best fit\n- Provide clear, specific instructions in the task description\n- Each teammate will work independently with their own system prompt`
    );
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
    model: leadHarnessAgent.model ?? DEFAULT_MODEL,
  };

  // Build teammates (all agents except the lead)
  const teammates: TranslatedAgent[] = harness.agents
    .filter((a) => a.id !== leadHarnessAgent.id)
    .map((a) => ({
      name: a.name,
      systemPrompt: buildAgentPrompt(a, harness.agents, harness.edges),
      model: a.model ?? DEFAULT_MODEL,
    }));

  return {
    leadAgent,
    teammates,
    workflowDescription,
  };
}

/**
 * Translates a HarnessData object into an orchestrator-led team structure.
 *
 * Instead of picking a team member as lead, this creates a synthetic
 * Orchestrator agent that coordinates ALL team members. The orchestrator:
 * - Reads the task, checklist, and workflow
 * - Delegates work to team members in the order defined by edges
 * - Validates the checklist after all agents complete
 * - Re-delegates if validation fails
 *
 * ALL agents from the harness become teammates (none is promoted to lead).
 *
 * @param harness - The harness data to translate
 * @param projectSpec - The project specification text
 * @param orchestratorModel - Model to use for the orchestrator (optional)
 * @returns TranslatedTeam with synthetic orchestrator as lead
 * @throws Error if harness has no agents
 */
export function translateHarnessWithOrchestrator(
  harness: HarnessData,
  projectSpec: string,
  orchestratorModel?: string
): TranslatedTeam {
  if (harness.agents.length === 0) {
    throw new Error("Cannot translate harness: no agents defined");
  }

  const workflowDescription = buildWorkflowDescription(
    harness.agents,
    harness.edges
  );

  // Build orchestrator system prompt
  const orchestratorPrompt = buildOrchestratorPrompt(
    harness.agents,
    harness.edges,
    projectSpec,
    workflowDescription
  );

  const orchestrator: TranslatedAgent = {
    name: "Orchestrator",
    systemPrompt: orchestratorPrompt,
    model: orchestratorModel ?? DEFAULT_MODEL,
  };

  // ALL agents become teammates
  const teammates: TranslatedAgent[] = harness.agents.map((a) => ({
    name: a.name,
    systemPrompt: buildAgentPrompt(a, harness.agents, harness.edges),
    model: a.model ?? DEFAULT_MODEL,
  }));

  return {
    leadAgent: orchestrator,
    teammates,
    workflowDescription,
  };
}

/**
 * Builds the system prompt for the synthetic orchestrator agent.
 *
 * The orchestrator does not write code itself. It coordinates the team
 * by delegating tasks via the Task tool and validating results.
 */
function buildOrchestratorPrompt(
  agents: HarnessAgent[],
  edges: HarnessEdge[],
  projectSpec: string,
  workflowDescription: string
): string {
  const sections: string[] = [];

  sections.push("# Role: Orchestrator");
  sections.push(
    "## Goal\nYou are a COORDINATOR ONLY. You manage the team workflow.\n\n" +
    "## CRITICAL RULES\n" +
    "- **NEVER use Read, Write, Edit, Bash, Glob, Grep, or any file/code tools directly**\n" +
    "- **ONLY use the Task tool to delegate ALL work to team members**\n" +
    "- You do NOT write code, read files, run commands, or make any changes yourself\n" +
    "- Your ONLY tool is Task. Use it to assign work to the right team member.\n" +
    "- If you need to verify something, delegate a verification task to the appropriate agent\n\n" +
    "## Your Workflow\n" +
    "1. Analyze the task and checklist\n" +
    "2. Use the Task tool to delegate work to each team member in the execution order\n" +
    "3. When delegating, provide clear instructions and context from previous agents\n" +
    "4. After all agents complete, delegate a final verification task to the reviewer\n" +
    "5. If verification fails, re-delegate to the appropriate agent with feedback\n" +
    "6. Report final status when the checklist is fully complete"
  );

  // Team members
  const teammateDescriptions: string[] = [];
  for (const agent of agents) {
    const lines: string[] = [];
    lines.push(`### ${agent.name}`);
    lines.push(`- **Role:** ${agent.role}`);
    lines.push(`- **Goal:** ${agent.goal}`);
    if (agent.skills.length > 0) {
      lines.push(`- **Skills:** ${agent.skills.join(", ")}`);
    }

    // Workflow relationships
    const outgoing = edges.filter((e) => e.source === agent.id);
    const incoming = edges.filter((e) => e.target === agent.id);
    const relationships: string[] = [];
    for (const edge of outgoing) {
      const targetName = agents.find((a) => a.id === edge.target)?.name ?? edge.target;
      relationships.push(`${describeEdgeType(edge.type)} ${targetName}`);
    }
    for (const edge of incoming) {
      const sourceName = agents.find((a) => a.id === edge.source)?.name ?? edge.source;
      relationships.push(`receives work from ${sourceName}`);
    }
    if (relationships.length > 0) {
      lines.push(`- **Workflow:** ${relationships.join("; ")}`);
    }

    teammateDescriptions.push(lines.join("\n"));
  }
  sections.push(`## Team Members\n\n${teammateDescriptions.join("\n\n")}`);

  // Workflow
  sections.push(`## Workflow\n${workflowDescription}`);

  // Determine execution order from edges
  const executionOrder = deriveExecutionOrder(agents, edges);
  if (executionOrder.length > 0) {
    const orderStr = executionOrder
      .map((id) => agents.find((a) => a.id === id)?.name ?? id)
      .join(" → ");
    sections.push(`## Execution Order\n${orderStr}\n\nDelegate to each agent in this order. Wait for each to complete before moving to the next.`);
  }

  // Delegation instructions
  sections.push(
    "## Delegation Instructions\n\n" +
    "Use the Task tool to delegate work to team members.\n" +
    "When delegating:\n" +
    "- Provide clear, specific instructions including what to build/review\n" +
    "- Include relevant context from previous agents' work\n" +
    "- For review agents: specify what to review and acceptance criteria\n" +
    "- If a reviewer rejects work, re-delegate to the original agent with the feedback"
  );

  // Project specification
  sections.push(`## Project Specification\n${projectSpec}`);

  return sections.join("\n\n");
}

/**
 * Derives a topological execution order from agents and edges.
 *
 * Performs a topological sort based on "passes-work-to" edges.
 * Falls back to the original agent order if no such edges exist
 * or if the graph has cycles.
 */
function deriveExecutionOrder(
  agents: HarnessAgent[],
  edges: HarnessEdge[]
): string[] {
  const workEdges = edges.filter((e) => e.type === "passes-work-to");

  if (workEdges.length === 0) {
    return agents.map((a) => a.id);
  }

  // Build adjacency list and in-degree count
  const agentIds = new Set(agents.map((a) => a.id));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of agentIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of workEdges) {
    if (agentIds.has(edge.source) && agentIds.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adj.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If not all agents were sorted (cycle detected), fall back to original order
  if (sorted.length !== agentIds.size) {
    return agents.map((a) => a.id);
  }

  return sorted;
}
