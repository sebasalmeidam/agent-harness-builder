import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Per-agent status during an execution run.
 */
export type AgentStatus = "idle" | "working" | "done" | "blocked";

/**
 * A single entry in the execution activity log.
 */
export interface ActivityEntry {
  timestamp: string;
  agentId: string;
  agentEmoji: string;
  agentName: string;
  message: string;
  type: "action" | "handoff" | "error" | "complete";
}

/**
 * Summary statistics computed when an execution run completes.
 */
export interface ExecutionSummary {
  filesChanged: number;
  totalTime: number;
  iterations: number;
  errors: number;
}

/**
 * Connection status of the SSE stream.
 */
export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * State returned by the useExecutionSSE hook.
 */
export interface ExecutionSSEState {
  status: "running" | "completed" | "failed" | null;
  agentStatuses: Record<string, AgentStatus>;
  activityLog: ActivityEntry[];
  files: string[];
  summary: ExecutionSummary | null;
  error: string | null;
  connectionStatus: ConnectionStatus;
}

/**
 * Custom React hook that connects to the SSE endpoint for real-time execution
 * monitoring. Parses incoming events and maintains the current run state.
 *
 * Handles reconnection with exponential backoff on EventSource errors.
 * On the `connected` event, initializes state from the full snapshot.
 */
export function useExecutionSSE(
  projectId: string | undefined,
  runId: string | undefined,
): ExecutionSSEState {
  const [state, setState] = useState<ExecutionSSEState>({
    status: null,
    agentStatuses: {},
    activityLog: [],
    files: [],
    summary: null,
    error: null,
    connectionStatus: "connecting",
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!projectId || !runId) {
      return;
    }

    function connect() {
      cleanup();

      setState((prev) => ({ ...prev, connectionStatus: "connecting" }));

      const url = `/api/projects/${projectId}/runs/${runId}/events`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("connected", (event) => {
        retryCountRef.current = 0;
        const data = JSON.parse(event.data);
        setState({
          status: data.status,
          agentStatuses: data.agentStatuses ?? {},
          activityLog: data.activityLog ?? [],
          files: data.files ?? [],
          summary: data.summary ?? null,
          error: data.error ?? null,
          connectionStatus: "connected",
        });
      });

      es.addEventListener("agent-status", (event) => {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          agentStatuses: {
            ...prev.agentStatuses,
            [data.agentId]: data.status,
          },
        }));
      });

      es.addEventListener("activity", (event) => {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          activityLog: [...prev.activityLog, data],
        }));
      });

      es.addEventListener("file-change", (event) => {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          files: prev.files.includes(data.path)
            ? prev.files
            : [...prev.files, data.path],
        }));
      });

      es.addEventListener("run-status", (event) => {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          status: data.status,
          error: data.error ?? prev.error,
          summary: data.summary ?? prev.summary,
          connectionStatus: "disconnected",
        }));
        // Run is terminal, close connection
        cleanup();
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setState((prev) => ({ ...prev, connectionStatus: "disconnected" }));

        // Exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      cleanup();
    };
  }, [projectId, runId, cleanup]);

  return state;
}
