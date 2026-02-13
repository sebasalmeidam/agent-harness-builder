import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useExecutionSSE } from "../hooks/useExecutionSSE";
import TeamProgress from "../components/execution/TeamProgress";
import ActivityLog from "../components/execution/ActivityLog";
import FileList from "../components/execution/FileList";
import ExecutionSummaryCard from "../components/execution/ExecutionSummaryCard";
import type { AgentInfo } from "../components/execution/TeamProgress";

/**
 * Returns a Tailwind badge class for the overall run status.
 */
function getRunStatusBadge(status: string | null): {
  label: string;
  className: string;
} {
  switch (status) {
    case "running":
      return {
        label: "Running",
        className: "bg-warning-light text-warning",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-success-light text-success",
      };
    case "failed":
      return {
        label: "Failed",
        className: "bg-red-100 text-red-600",
      };
    default:
      return {
        label: "Connecting...",
        className: "bg-info-light text-info",
      };
  }
}

/**
 * Formats a running duration as "Xm Ys" or "Xs".
 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/**
 * Main execution monitoring page.
 * Connects to the SSE endpoint and renders agent statuses, activity log,
 * file list, and completion summary.
 */
export default function ExecutionPage() {
  const { id: projectId, runId } = useParams<{
    id: string;
    runId: string;
  }>();

  const sseState = useExecutionSSE(projectId, runId);

  // Project name for breadcrumb
  const [projectName, setProjectName] = useState<string>("");

  // Agent info for team progress display
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  // Running duration counter
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch project name for breadcrumb
  useEffect(() => {
    if (!projectId) return;

    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setProjectName(data.name);
          // If project has a teamId, fetch team to get agent info
          if (data.teamId) {
            const teamRes = await fetch(`/api/teams/${data.teamId}`);
            if (teamRes.ok) {
              const teamData = await teamRes.json();
              const agentInfos: AgentInfo[] = (teamData.agents ?? []).map(
                (a: { id: string; name: string; emoji: string }) => ({
                  id: a.id,
                  name: a.name,
                  emoji: a.emoji,
                }),
              );
              setAgents(agentInfos);
            }
          }
        }
      } catch {
        // Non-critical: breadcrumb will show without name
      }
    }

    fetchProject();
  }, [projectId]);

  // Running duration timer
  useEffect(() => {
    if (sseState.status === "running") {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sseState.status]);

  const statusBadge = getRunStatusBadge(sseState.status);

  // Connection status indicator
  const connectionIndicator =
    sseState.connectionStatus === "connected"
      ? "bg-success"
      : sseState.connectionStatus === "connecting"
        ? "bg-warning animate-pulse"
        : "bg-text-secondary";

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-2 font-body text-sm text-text-secondary">
        <Link to="/projects" className="hover:text-primary">
          Projects
        </Link>
        <span className="mx-2">/</span>
        {projectId && (
          <>
            <Link
              to={`/projects/${projectId}`}
              className="hover:text-primary"
            >
              {projectName || "Project"}
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-text-primary">Run</span>
      </nav>

      {/* Task header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[28px] font-semibold text-black">
            Execution Run
          </h1>
          <span
            className={`inline-block rounded-full px-3 py-1 font-body text-xs font-medium ${statusBadge.className}`}
            data-testid="run-status-badge"
          >
            {statusBadge.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-2" data-testid="connection-status">
            <span
              className={`inline-block h-2 w-2 rounded-full ${connectionIndicator}`}
            />
            <span className="font-body text-xs text-text-secondary">
              {sseState.connectionStatus === "connected"
                ? "Live"
                : sseState.connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
            </span>
          </div>

          {/* Duration */}
          {sseState.status === "running" && (
            <span
              className="font-body text-sm text-text-secondary"
              data-testid="running-duration"
            >
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
      </div>

      {/* Error message for failed runs */}
      {sseState.error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="font-body text-sm text-red-700" data-testid="run-error">
            {sseState.error}
          </p>
        </div>
      )}

      {/* Team Progress */}
      <section className="mb-6">
        <h2 className="mb-3 font-heading text-lg font-semibold text-black">
          Team Progress
        </h2>
        <TeamProgress agents={agents} agentStatuses={sseState.agentStatuses} />
      </section>

      {/* Activity Log */}
      <section className="mb-6">
        <h2 className="mb-3 font-heading text-lg font-semibold text-black">
          Activity Log
        </h2>
        <ActivityLog entries={sseState.activityLog} />
      </section>

      {/* Output section: Files and Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Files */}
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold text-black">
            Files Changed
          </h2>
          <FileList files={sseState.files} />
        </section>

        {/* Summary (only when run is completed) */}
        {sseState.summary && (
          <section>
            <h2 className="mb-3 font-heading text-lg font-semibold text-black">
              Summary
            </h2>
            <ExecutionSummaryCard summary={sseState.summary} />
          </section>
        )}
      </div>
    </div>
  );
}
