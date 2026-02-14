import { useEffect, useRef } from "react";
import { useExecutionSSE } from "../../hooks/useExecutionSSE";
import ActivityLog from "../execution/ActivityLog";

interface TaskActivityLogProps {
  projectId: string;
  runId: string;
  onComplete?: (status: "completed" | "failed") => void;
}

export default function TaskActivityLog({
  projectId,
  runId,
  onComplete,
}: TaskActivityLogProps) {
  const sseState = useExecutionSSE(projectId, runId);
  const onCompleteRef = useRef(onComplete);

  // Update ref when callback changes
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Call onComplete when execution finishes
  useEffect(() => {
    if (sseState.status === "completed" || sseState.status === "failed") {
      onCompleteRef.current?.(sseState.status);
    }
  }, [sseState.status]);

  return (
    <div className="mt-6 rounded-lg border border-border bg-bg-primary p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-black">
          Activity Log
        </h3>
        <div className="flex items-center gap-2">
          {sseState.connectionStatus === "connected" && (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              <span className="font-body text-xs text-text-secondary">
                Live
              </span>
            </>
          )}
          {sseState.connectionStatus === "connecting" && (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-warning" />
              <span className="font-body text-xs text-text-secondary">
                Connecting...
              </span>
            </>
          )}
          {sseState.connectionStatus === "disconnected" &&
            (sseState.status === "completed" ||
              sseState.status === "failed") && (
              <span
                className={`inline-block rounded-full px-3 py-1 font-body text-xs font-medium ${
                  sseState.status === "completed"
                    ? "bg-success-light text-success"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {sseState.status === "completed" ? "Completed" : "Failed"}
              </span>
            )}
        </div>
      </div>

      {sseState.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="font-body text-sm text-red-700">{sseState.error}</p>
        </div>
      )}

      <ActivityLog entries={sseState.activityLog} />

      {sseState.summary && (
        <div className="mt-4 rounded-md border border-border bg-white p-4">
          <h4 className="mb-2 font-body text-sm font-medium text-black">
            Summary
          </h4>
          <div className="grid grid-cols-2 gap-4 font-body text-xs text-text-secondary">
            <div>
              <span className="font-medium">Files changed:</span>{" "}
              {sseState.summary.filesChanged}
            </div>
            <div>
              <span className="font-medium">Total time:</span>{" "}
              {sseState.summary.totalTime}s
            </div>
            <div>
              <span className="font-medium">Iterations:</span>{" "}
              {sseState.summary.iterations}
            </div>
            <div>
              <span className="font-medium">Errors:</span>{" "}
              {sseState.summary.errors}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
