import type { AgentStatus } from "../../hooks/useExecutionSSE";

/**
 * Agent info for display in the team progress view.
 */
export interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
}

interface TeamProgressProps {
  agents: AgentInfo[];
  agentStatuses: Record<string, AgentStatus>;
}

/**
 * Maps agent status to Tailwind badge styles per design system:
 * idle = info (blue), working = warning (yellow/animate-pulse),
 * done = success (green), blocked = primary (red).
 */
function getStatusBadge(status: AgentStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "idle":
      return {
        label: "Idle",
        className: "bg-info-light text-info",
      };
    case "working":
      return {
        label: "Working",
        className: "bg-warning-light text-warning animate-pulse",
      };
    case "done":
      return {
        label: "Done",
        className: "bg-success-light text-success",
      };
    case "blocked":
      return {
        label: "Blocked",
        className: "bg-primary-light text-primary",
      };
  }
}

/**
 * Horizontal flow of agent nodes with arrows between them.
 * Each node shows emoji, name, and status badge with design system colors.
 */
export default function TeamProgress({
  agents,
  agentStatuses,
}: TeamProgressProps) {
  if (agents.length === 0) {
    return (
      <p className="font-body text-sm text-text-secondary">
        No agents in this team.
      </p>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid="team-progress"
    >
      {agents.map((agent, index) => {
        const status = agentStatuses[agent.id] ?? "idle";
        const badge = getStatusBadge(status);

        return (
          <div key={agent.id} className="flex items-center gap-3">
            {/* Agent node card */}
            <div
              className="flex items-center gap-2 rounded-lg border border-border bg-bg-primary px-4 py-3"
              data-testid={`agent-node-${agent.id}`}
            >
              <span className="text-lg">{agent.emoji}</span>
              <div>
                <p className="font-body text-sm font-medium text-black">
                  {agent.name}
                </p>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-medium ${badge.className}`}
                  data-testid={`agent-status-${agent.id}`}
                >
                  {badge.label}
                </span>
              </div>
            </div>

            {/* Arrow between agents (not after the last one) */}
            {index < agents.length - 1 && (
              <span
                className="font-body text-lg text-text-secondary"
                aria-hidden="true"
              >
                &rarr;
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
