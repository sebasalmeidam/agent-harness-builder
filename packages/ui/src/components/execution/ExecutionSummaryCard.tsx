import type { ExecutionSummary } from "../../hooks/useExecutionSSE";

interface ExecutionSummaryCardProps {
  summary: ExecutionSummary;
}

/**
 * Formats a duration in seconds into a human-readable string.
 * Examples: "5s", "2m 30s", "1h 5m 10s"
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

/**
 * 2x2 grid of stat cards showing execution summary:
 * files changed, total time, iterations, and errors.
 * Only renders when summary data is available (run completed).
 */
export default function ExecutionSummaryCard({
  summary,
}: ExecutionSummaryCardProps) {
  const stats = [
    {
      label: "Files Changed",
      value: summary.filesChanged,
      testId: "stat-files-changed",
      className: "text-black",
    },
    {
      label: "Total Time",
      value: formatDuration(summary.totalTime),
      testId: "stat-total-time",
      className: "text-black",
    },
    {
      label: "Iterations",
      value: summary.iterations,
      testId: "stat-iterations",
      className: "text-black",
    },
    {
      label: "Errors",
      value: summary.errors,
      testId: "stat-errors",
      className: summary.errors > 0 ? "text-red-600" : "text-black",
    },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-4"
      data-testid="execution-summary-card"
    >
      {stats.map((stat) => (
        <div
          key={stat.testId}
          className="rounded-lg border border-border bg-bg-primary p-4"
          data-testid={stat.testId}
        >
          <p className="font-body text-xs text-text-secondary">{stat.label}</p>
          <p
            className={`mt-1 font-heading text-xl font-semibold ${stat.className}`}
          >
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
