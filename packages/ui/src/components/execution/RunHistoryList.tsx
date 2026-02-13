import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Lightweight run summary returned by the list endpoint.
 * Matches the ExecutionRunSummary type from the server.
 */
interface RunSummary {
  id: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

interface RunHistoryListProps {
  projectId: string;
}

/**
 * Returns a Tailwind badge class for the run status.
 */
function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
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
    case "running":
      return {
        label: "Running",
        className: "bg-warning-light text-warning",
      };
    default:
      return {
        label: status,
        className: "bg-info-light text-info",
      };
  }
}

/**
 * Formats an ISO 8601 date string into a human-readable date and time.
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return "Unknown date";
    }
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Unknown date";
  }
}

/**
 * Computes a human-readable duration between two ISO timestamps.
 */
function formatDuration(
  startedAt: string,
  completedAt: string | null,
): string {
  if (!completedAt) {
    return "In progress";
  }
  try {
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    if (isNaN(start) || isNaN(end)) {
      return "Unknown";
    }
    const seconds = Math.round((end - start) / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) {
      return `${minutes}m ${secs}s`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  } catch {
    return "Unknown";
  }
}

/**
 * Truncates a run ID for display, showing the first 8 characters.
 */
function truncateId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

/**
 * List of past execution runs for a project.
 * Fetches summaries from GET /api/projects/:id/runs on mount.
 * Each entry shows status badge, start time, and duration.
 * Clicking an entry navigates to the run detail view.
 */
export default function RunHistoryList({ projectId }: RunHistoryListProps) {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRuns() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/runs`);
        if (!res.ok) {
          throw new Error(`Failed to load runs: ${res.statusText}`);
        }
        const data: unknown = await res.json();
        // Gracefully handle corrupted data: filter to valid entries only
        if (!Array.isArray(data)) {
          setRuns([]);
          return;
        }
        const validRuns = data.filter(
          (entry: unknown): entry is RunSummary =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as RunSummary).id === "string" &&
            typeof (entry as RunSummary).status === "string" &&
            typeof (entry as RunSummary).startedAt === "string",
        );
        setRuns(validRuns);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load execution history",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchRuns();
  }, [projectId]);

  if (loading) {
    return (
      <p
        className="font-body text-sm text-text-secondary"
        data-testid="run-history-loading"
      >
        Loading execution history...
      </p>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-md border border-red-200 bg-red-50 px-4 py-2"
        data-testid="run-history-error"
      >
        <p className="font-body text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <p
        className="font-body text-sm text-text-secondary"
        data-testid="run-history-empty"
      >
        No past executions yet.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="run-history-list">
      {runs.map((run) => {
        const badge = getStatusBadge(run.status);
        return (
          <button
            key={run.id}
            type="button"
            onClick={() => navigate(`/projects/${projectId}/runs/${run.id}`)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-primary px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
            data-testid={`run-entry-${run.id}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-medium ${badge.className}`}
                data-testid={`run-status-${run.id}`}
              >
                {badge.label}
              </span>
              <span className="font-mono text-xs text-text-secondary">
                {truncateId(run.id)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-body text-xs text-text-secondary">
                {formatDate(run.startedAt)}
              </span>
              <span className="font-body text-xs font-medium text-text-secondary">
                {formatDuration(run.startedAt, run.completedAt)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
