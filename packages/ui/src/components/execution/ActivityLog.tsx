import { useEffect, useRef } from "react";
import type { ActivityEntry } from "../../hooks/useExecutionSSE";

interface ActivityLogProps {
  entries: ActivityEntry[];
}

/**
 * Formats an ISO timestamp into a short HH:MM:SS format for display.
 */
function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Returns entry-type-specific styles.
 * Handoff entries get a visual arrow indicator.
 * Error entries display in red text.
 */
function getEntryStyle(type: ActivityEntry["type"]): string {
  switch (type) {
    case "error":
      return "text-red-600";
    case "handoff":
      return "text-text-primary";
    case "complete":
      return "text-success";
    default:
      return "text-text-primary";
  }
}

/**
 * Scrollable activity log container with timestamped entries.
 * Auto-scrolls to bottom when new entries are appended.
 */
export default function ActivityLog({ entries }: ActivityLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-primary p-4">
        <p className="font-body text-sm text-text-secondary">
          No activity yet. Waiting for agents to start working...
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="max-h-96 overflow-y-auto rounded-lg border border-border bg-bg-primary"
      data-testid="activity-log"
    >
      <ul className="divide-y divide-border">
        {entries.map((entry, index) => (
          <li
            key={`${entry.timestamp}-${entry.agentId}-${index}`}
            className="flex items-start gap-3 px-4 py-3"
            data-testid="activity-entry"
          >
            {/* Timestamp */}
            <span className="shrink-0 font-body text-xs text-text-secondary">
              {formatTimestamp(entry.timestamp)}
            </span>

            {/* Agent emoji */}
            <span className="shrink-0 text-sm">{entry.agentEmoji}</span>

            {/* Message */}
            <div className="min-w-0 flex-1">
              {entry.type === "handoff" && (
                <span
                  className="mr-1 font-body text-xs text-text-secondary"
                  aria-label="handoff"
                >
                  &rarr;
                </span>
              )}
              <span
                className={`font-body text-sm ${getEntryStyle(entry.type)}`}
              >
                {entry.message}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
