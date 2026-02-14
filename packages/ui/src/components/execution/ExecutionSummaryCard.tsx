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
 * Formats cost in USD with 4 decimal places.
 */
function formatCost(cost: number | null | undefined): string {
  if (cost == null) return "$0.0000";
  return `$${cost.toFixed(4)}`;
}

/**
 * Grid of stat cards showing execution summary:
 * files changed, total time, cost, checklist completion, and errors.
 * Only renders when summary data is available (run completed).
 */
export default function ExecutionSummaryCard({
  summary,
}: ExecutionSummaryCardProps) {
  // Calculate checklist percentage
  const hasChecklist = summary.checklistTotal != null && summary.checklistTotal > 0;
  const checklistPercentage = hasChecklist
    ? Math.round(((summary.checklistCompleted ?? 0) / summary.checklistTotal!) * 100)
    : null;

  const stats = [
    {
      label: "Duration",
      value: formatDuration(summary.totalTime),
      testId: "stat-total-time",
      className: "text-black",
    },
    {
      label: "Files Changed",
      value: summary.filesChanged.toString(),
      testId: "stat-files-changed",
      className: "text-black",
    },
    {
      label: "Cost",
      value: formatCost(summary.costUsd),
      testId: "stat-cost",
      className: "text-black",
    },
    ...(hasChecklist
      ? [
          {
            label: "Checklist",
            value: `${summary.checklistCompleted}/${summary.checklistTotal} (${checklistPercentage}%)`,
            testId: "stat-checklist",
            className:
              checklistPercentage === 100
                ? "text-success"
                : checklistPercentage! >= 50
                  ? "text-warning"
                  : "text-text-primary",
          },
        ]
      : []),
    {
      label: "Errors",
      value: summary.errors.toString(),
      testId: "stat-errors",
      className: summary.errors > 0 ? "text-error" : "text-black",
    },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-4 lg:grid-cols-3"
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
