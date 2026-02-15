import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { XCircle } from "lucide-react";
import ErrorCard from "../components/ErrorCard";
import { useExecutionSSE } from "../hooks/useExecutionSSE";
import type { ExecutionSSEState } from "../hooks/useExecutionSSE";
import TeamProgress from "../components/execution/TeamProgress";
import ActivityLog from "../components/execution/ActivityLog";
import FileList from "../components/execution/FileList";
import ExecutionSummaryCard from "../components/execution/ExecutionSummaryCard";
import ChecklistPanel from "../components/execution/ChecklistPanel";
import CostCounter from "../components/execution/CostCounter";
import type { AgentInfo } from "../components/execution/TeamProgress";
import type { ChecklistItem } from "../components/execution/ChecklistPanel";

interface RunData {
  costUsd?: number | null;
  taskId?: string | null;
}

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
        className: "bg-info-light text-info animate-pulse",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-success-light text-success",
      };
    case "failed":
      return {
        label: "Failed",
        className: "bg-error-light text-error",
      };
    default:
      return {
        label: "Connecting...",
        className: "bg-[rgb(189,190,191)] text-text-secondary",
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

  // Run data (for cost and taskId)
  const [runData, setRunData] = useState<RunData>({});

  // Task data (for checklist)
  const [taskId, setTaskId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  // Cancel state
  const [cancelling, setCancelling] = useState(false);

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

  // Fetch task checklist
  const fetchTaskChecklist = useCallback(async (taskIdToFetch: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskIdToFetch}`);
      if (res.ok) {
        const task = await res.json();
        setChecklist(task.checklist ?? []);
      }
    } catch {
      // Non-critical
    }
  }, [projectId]);

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
        
        // Store run data for cost and taskId
        setRunData({
          costUsd: data.costUsd,
          taskId: data.taskId,
        });
        
        // Fetch task checklist if taskId exists
        if (data.taskId) {
          setTaskId(data.taskId);
          fetchTaskChecklist(data.taskId);
        }

        if (isTerminalStatus(data.status)) {
          // History mode: use REST data directly
          // Inject costUsd into summary from run-level field
          const summary = data.summary ?? null;
          if (summary && data.costUsd != null) {
            summary.costUsd = data.costUsd;
          }
          setHistoryData({
            status: data.status,
            agentStatuses: data.agentStatuses ?? {},
            activityLog: data.activityLog ?? [],
            files: data.files ?? [],
            summary,
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
  }, [projectId, runId, fetchTaskChecklist]);

  // Fetch project name for breadcrumb
  useEffect(() => {
    if (!projectId) return;

    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setProjectName(data.name);
          // Get teamId: prefer project, fall back to run record
          let teamIdToUse = data.teamId;
          if (!teamIdToUse && runId) {
            try {
              const rRes = await fetch(`/api/projects/${projectId}/runs/${runId}`);
              if (rRes.ok) {
                const rData = await rRes.json();
                teamIdToUse = rData.teamId;
              }
            } catch { /* ignore */ }
          }
          if (teamIdToUse) {
            const teamRes = await fetch(`/api/teams/${teamIdToUse}`);
            if (teamRes.ok) {
              const teamData = await teamRes.json();
              setTeamName(teamData.name ?? "");
              const teamAgents: AgentInfo[] = (teamData.agents ?? []).map(
                (a: { id: string; name: string; emoji: string }) => ({
                  id: a.id,
                  name: a.name,
                  emoji: a.emoji,
                }),
              );

              // Prepend Orchestrator if present in the run's agentStatuses
              // (it's a synthetic agent not in the team definition)
              const runRes = await fetch(`/api/projects/${projectId}/runs/${runId}`);
              if (runRes.ok) {
                const runData = await runRes.json();
                const statuses = runData.agentStatuses ?? {};
                if ("Orchestrator" in statuses) {
                  teamAgents.unshift({
                    id: "orchestrator",
                    name: "Orchestrator",
                    emoji: "🎯",
                  });
                }
              }

              setAgents(teamAgents);
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
      // Calculate initial elapsed from startedAt if available
      if (historyData?.summary?.totalTime) {
        setElapsed(historyData.summary.totalTime);
      }
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // For completed runs, use the summary duration
      if (activeState.summary?.totalTime) {
        setElapsed(activeState.summary.totalTime);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeState.status, activeState.summary?.totalTime, historyData?.summary?.totalTime]);

  // Refresh checklist when activity log updates (agent may have completed items)
  useEffect(() => {
    if (taskId && activeState.activityLog.length > 0) {
      // Debounce refresh to avoid too many requests
      const timer = setTimeout(() => {
        fetchTaskChecklist(taskId);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [activeState.activityLog.length, taskId, fetchTaskChecklist]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    if (!projectId || !runId || cancelling) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/runs/${runId}/cancel`, {
        method: "POST",
      });

      if (!res.ok) {
        console.error("Failed to cancel run");
      }
    } catch (err) {
      console.error("Failed to cancel run:", err);
    } finally {
      setCancelling(false);
    }
  }, [projectId, runId, cancelling]);

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
          {/* Cost Counter */}
          <CostCounter costUsd={runData.costUsd} />

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

          {/* Cancel Button */}
          {activeState.status === "running" && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-2 rounded-md border border-error bg-error-light px-3 py-1.5 font-body text-sm font-medium text-error transition-colors hover:bg-error hover:text-white disabled:opacity-50"
              data-testid="cancel-button"
            >
              <XCircle className="h-4 w-4" />
              {cancelling ? "Cancelling..." : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {/* Error message for failed runs */}
      {activeState.error && (
        <ErrorCard message={activeState.error} className="mb-6" />
      )}

      {/* Team Progress - top level, always visible */}
      <section className="mb-6">
        <h2 className="mb-3 font-heading text-xl font-semibold text-black">
          {teamName ? `Team (${teamName})` : "Team Progress"}
        </h2>
        <TeamProgress agents={agents} agentStatuses={activeState.agentStatuses} />
      </section>

      {/* Two column layout: Left = Activity Log, Right = Checklist */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Activity Log (takes 2 columns) */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 font-heading text-xl font-semibold text-black">
            Activity Log
          </h2>
          <ActivityLog entries={activeState.activityLog} />
        </section>

        {/* Right column: Checklist */}
        <div className="space-y-6">
          {/* Checklist Panel */}
          {taskId && checklist.length > 0 && (
            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold text-black">
                Task Checklist
              </h2>
              <ChecklistPanel
                items={checklist}
                projectId={projectId!}
                taskId={taskId}
                onUpdate={() => fetchTaskChecklist(taskId)}
                readOnly={activeState.status === "running"}
              />
            </section>
          )}
        </div>
      </div>

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
