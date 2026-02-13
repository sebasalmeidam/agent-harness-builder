import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import ErrorCard from "../components/ErrorCard";
import { useExecutionSSE } from "../hooks/useExecutionSSE";
import type { ExecutionSSEState } from "../hooks/useExecutionSSE";
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
        className: "bg-primary-light text-primary",
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
 * Determines whether a run is in a terminal state (completed or failed).
 * Terminal runs are displayed via REST data, not SSE.
 */
function isTerminalStatus(status: string | null): boolean {
  return status === "completed" || status === "failed";
}

/**
 * Main execution monitoring page.
 *
 * Supports two modes:
 * - Live mode (SSE): For runs with status "running". Connects to the SSE
 *   endpoint for real-time updates.
 * - History mode (REST): For completed or failed runs. Fetches the full run
 *   data from the REST endpoint without establishing an SSE connection.
 */
export default function ExecutionPage() {
  const { id: projectId, runId } = useParams<{
    id: string;
    runId: string;
  }>();

  // History mode state: run data fetched via REST for completed/failed runs
  const [historyData, setHistoryData] = useState<ExecutionSSEState | null>(
    null,
  );
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  // SSE hook: only activated when run is still "running" and initial check is done.
  // While historyLoading is true, pass undefined to suppress SSE connection.
  const shouldUseSSE = !isHistoryMode && !historyLoading;
  const sseState = useExecutionSSE(
    shouldUseSSE ? projectId : undefined,
    shouldUseSSE ? runId : undefined,
  );

  // Project name for breadcrumb
  const [projectName, setProjectName] = useState<string>("");

  // Agent info for team progress display
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  // Team name for section title
  const [teamName, setTeamName] = useState<string>("");

  // Running duration counter
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount, fetch run data via REST to determine mode
  useEffect(() => {
    if (!projectId || !runId) return;

    async function checkRunStatus() {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/runs/${runId}`);
        if (!res.ok) {
          // If run not found, fall through to SSE which will show connecting state
          setIsHistoryMode(false);
          setHistoryLoading(false);
          return;
        }
        const data = await res.json();
        if (isTerminalStatus(data.status)) {
          // History mode: use REST data directly
          setHistoryData({
            status: data.status,
            agentStatuses: data.agentStatuses ?? {},
            activityLog: data.activityLog ?? [],
            files: data.files ?? [],
            summary: data.summary ?? null,
            error: data.error ?? null,
            connectionStatus: "disconnected",
          });
          setIsHistoryMode(true);
        } else {
          // Live mode: let SSE hook handle it
          setIsHistoryMode(false);
        }
      } catch {
        // On error, fall through to SSE mode
        setIsHistoryMode(false);
      } finally {
        setHistoryLoading(false);
      }
    }

    checkRunStatus();
  }, [projectId, runId]);

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
              setTeamName(teamData.name ?? "");
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

  // The active state: either history data or SSE data
  const activeState = isHistoryMode && historyData ? historyData : sseState;

  // Running duration timer
  useEffect(() => {
    if (activeState.status === "running") {
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
  }, [activeState.status]);

  // Show loading while determining mode
  if (historyLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-body text-base text-text-secondary">
          Loading run data...
        </p>
      </div>
    );
  }

  const statusBadge = getRunStatusBadge(activeState.status);

  // Connection status indicator (only relevant in live mode)
  const showConnectionStatus = !isHistoryMode;
  const connectionIndicator =
    activeState.connectionStatus === "connected"
      ? "bg-success"
      : activeState.connectionStatus === "connecting"
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
          {/* Connection status (only in live mode) */}
          {showConnectionStatus && (
            <div className="flex items-center gap-2" data-testid="connection-status">
              <span
                className={`inline-block h-2 w-2 rounded-full ${connectionIndicator}`}
              />
              <span className="font-body text-xs text-text-secondary">
                {activeState.connectionStatus === "connected"
                  ? "Live"
                  : activeState.connectionStatus === "connecting"
                    ? "Connecting..."
                    : "Disconnected"}
              </span>
            </div>
          )}

          {/* Duration */}
          {activeState.status === "running" && (
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
      {activeState.error && (
        <ErrorCard message={activeState.error} className="mb-6" />
      )}

      {/* Team Progress */}
      <section className="mb-6">
        <h2 className="mb-3 font-heading text-xl font-semibold text-black">
          {teamName ? `Team Progress (${teamName})` : "Team Progress"}
        </h2>
        <TeamProgress agents={agents} agentStatuses={activeState.agentStatuses} />
      </section>

      {/* Activity Log */}
      <section className="mb-6">
        <h2 className="mb-3 font-heading text-xl font-semibold text-black">
          Activity Log
        </h2>
        <ActivityLog entries={activeState.activityLog} />
      </section>

      {/* Output section: Files and Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Files */}
        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold text-black">
            Files Changed
          </h2>
          <FileList files={activeState.files} />
        </section>

        {/* Summary (only when run is completed) */}
        {activeState.summary && (
          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-black">
              Summary
            </h2>
            <ExecutionSummaryCard summary={activeState.summary} />
          </section>
        )}
      </div>
    </div>
  );
}
