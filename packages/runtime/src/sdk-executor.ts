// --- SDK Executor Module ---
// Encapsulates all Claude Agent SDK interaction for real execution.
// See ADR-014 for the integration architecture.

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/**
 * Agent definition for SDK's agents option.
 * Used to define sub-agents that can be spawned via the Task tool.
 */
export interface AgentDefinition {
  description: string;
  prompt: string;
  tools?: string[];
}

/**
 * Parameters for SDK execution.
 */
export interface ExecuteWithSdkParams {
  systemPrompt: string;
  model: string;
  cwd: string;
  prompt: string;
  tools: string[];
  maxBudgetUsd?: number;
  agents?: Record<string, AgentDefinition>;
}

/**
 * Resolves agent skills to SDK tool arrays.
 *
 * Maps agent skills/roles to tool availability per ADR-014 Section 3.5:
 * - "read-only" skill → Read, Glob, Grep only
 * - "testing" skill → Read, Write, Edit, Bash, Glob, Grep
 * - Default → Full tool set
 * - Lead agents (isLead=true) also get the "Task" tool for delegation
 *
 * @param skills - Array of agent skill strings
 * @param isLead - Whether this is the lead agent (adds Task tool)
 * @returns Array of tool names for SDK tools and allowedTools options
 */
export function resolveTools(skills: string[], isLead?: boolean): string[] {
  let tools: string[];

  // Check for read-only restriction
  if (skills.some((s) => s.toLowerCase().includes("read-only"))) {
    tools = ["Read", "Glob", "Grep"];
  }
  // Check for testing skill
  else if (skills.some((s) => s.toLowerCase().includes("testing"))) {
    tools = ["Read", "Write", "Edit", "Bash", "Glob", "Grep"];
  }
  // Default: full tool set
  else {
    tools = [
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Glob",
      "Grep",
      "WebFetch",
      "WebSearch",
      "NotebookEdit",
    ];
  }

  // Add Task tool for lead agents
  if (isLead) {
    tools.push("Task");
  }

  return tools;
}

/**
 * Executes an agent task using the Claude Agent SDK.
 *
 * Calls the SDK's query() function with proper parameters and returns
 * the async generator that yields SDK messages.
 *
 * @param params - Execution parameters (systemPrompt, model, cwd, prompt, tools, maxBudgetUsd, agents)
 * @returns AsyncGenerator yielding SDKMessage objects
 */
export function executeWithSdk(
  params: ExecuteWithSdkParams
): AsyncGenerator<SDKMessage, void, unknown> {
  const {
    systemPrompt,
    model,
    cwd,
    prompt,
    tools,
    maxBudgetUsd = 5.0,
    agents,
  } = params;

  return query({
    prompt,
    options: {
      systemPrompt,
      model,
      cwd,
      permissionMode: "bypassPermissions",
      tools,
      allowedTools: tools,
      allowDangerouslySkipPermissions: true,
      maxBudgetUsd,
      ...(agents && { agents }),
    },
  });
}
