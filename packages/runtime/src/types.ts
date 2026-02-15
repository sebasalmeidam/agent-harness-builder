// --- Execution Engine Types ---
// Types shared across the runtime and server packages for execution runs.
// These map to the data model defined in ADR-005 Section 3.1.

/**
 * Translated agent configuration ready for Claude Agent SDK consumption.
 * Produced by the translator from HarnessAgent + edge context.
 */
export interface TranslatedAgent {
  name: string;
  systemPrompt: string;
  model: string;
}

/**
 * Result of translating a HarnessData into Claude Agent SDK team structures.
 * Contains the lead agent, teammates, and a workflow description.
 */
export interface TranslatedTeam {
  leadAgent: TranslatedAgent;
  teammates: TranslatedAgent[];
  workflowDescription: string;
}

/**
 * Per-agent status during an execution run.
 * Maps to the state machine in ADR-005 Section 3.2.
 */
export type AgentStatus = "idle" | "working" | "done" | "blocked";

/**
 * A single entry in the execution activity log.
 */
export interface ActivityEntry {
  timestamp: string;
  agentId: string;
  agentEmoji: string;
  agentName: string;
  message: string;
  type: "action" | "handoff" | "error" | "complete";
}

/**
 * Summary statistics computed when an execution run completes.
 */
export interface ExecutionSummary {
  filesChanged: number;
  totalTime: number;
  iterations: number;
  errors: number;
}

/**
 * Full execution run record, persisted as JSON in .runs/ directory.
 */
export interface ExecutionRun {
  id: string;
  projectId: string;
  teamId: string;
  taskId: string | null;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  agentStatuses: Record<string, AgentStatus>;
  activityLog: ActivityEntry[];
  files: string[];
  summary: ExecutionSummary | null;
  error: string | null;
  costUsd?: number | null;
  resultSummary?: string | null;
}

/**
 * Lightweight run summary for list endpoints.
 * Contains only the fields needed for the history list view.
 */
export interface ExecutionRunSummary {
  id: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}
