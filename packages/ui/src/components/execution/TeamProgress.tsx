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
 * Maps agent status to Tailwind badge styles per ADR-025 spec:
 * idle = gray, working = blue-pulse, done = green, error/blocked = red/yellow
 */
function getStatusBadge(status: AgentStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "idle":
      return {
        label: "Idle",
        className: "bg-[rgb(189,190,191)] text-text-secondary",
      };
    case "working":
      return {
        label: "Working",
        className: "bg-info-light text-info animate-pulse",
      };
    case "done":
      return {
        label: "Done",
        className: "bg-success-light text-success",
      };
    case "blocked":
      return {
        label: "Blocked",
        className: "bg-warning-light text-warning",
      };
  }
}

/**
 * Horizontal flow of agent nodes with arrows between them.
 * Each node shows a vertical column: 40x40 emoji avatar, name below,
 * and status badge below name, per design-system.md Agent Node spec.
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
          <div key={agent.id} className="flex items-center gap-2">
            {/* Agent node: vertical column layout */}
            <div
              className="flex flex-col items-center gap-1"
              data-testid={`agent-node-${agent.id}`}
            >
              {/* 40x40 rounded emoji avatar */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-secondary text-xl">
                {agent.emoji}
              </div>
              <p className="font-body text-sm font-medium">
                {agent.name}
              </p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-medium ${badge.className}`}
                data-testid={`agent-status-${agent.id}`}
              >
                {badge.label}
              </span>
            </div>

            {/* Arrow between agents (not after the last one) */}
            {index < agents.length - 1 && (
              <span
                className="text-lg text-text-muted"
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
