import { useState, useEffect, useCallback, useRef } from "react";
import { Play, ChevronDown, ChevronRight, Clock, DollarSign, ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import ChecklistEditor, { ChecklistItem } from "./ChecklistEditor";
import TeamSelector from "./TeamSelector";
import TaskActivityLog from "./TaskActivityLog";
import TeamProgress from "../execution/TeamProgress";
import type { AgentInfo } from "../execution/TeamProgress";
import type { AgentStatus } from "../../hooks/useExecutionSSE";

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  teamId: string | null;
  status: "pending" | "running" | "done" | "failed";
}

interface RunSummary {
  id: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  costUsd: number | null;
  error: string | null;
}

interface TaskDetailPanelProps {
  taskId: string;
  projectId: string;
  onUpdate?: () => void;
  onClose?: () => void;
}

/**
 * Formats a date string to a readable format.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Returns badge styling for run status.
 */
function getRunStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "running":
      return { label: "Running", className: "bg-info-light text-info" };
    case "completed":
      return { label: "Completed", className: "bg-success-light text-success" };
    case "failed":
      return { label: "Failed", className: "bg-error-light text-error" };
    default:
      return { label: status, className: "bg-[rgb(189,190,191)] text-text-secondary" };
  }
}

export default function TaskDetailPanel({
  taskId,
  projectId,
  onUpdate,
  onClose,
}: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  // Execution prompt state
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptText, setPromptText] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // Execution history state
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  // Result summary for completed tasks
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  // Team agents and status for live display
  const [teamAgents, setTeamAgents] = useState<AgentInfo[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});

  // Editable fields
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([]);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);

  // Refs to track original values for change detection
  const titleBeforeEdit = useRef("");
  const descriptionBeforeEdit = useRef("");

  // Debounce timer
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Reset state when task changes
  useEffect(() => {
    setRunId(null);
    setRuns([]);
    setResultSummary(null);
    setAgentStatuses({});
    setShowPrompt(false);
    setPromptText(null);
  }, [taskId]);

  // Fetch task data
  useEffect(() => {
    async function fetchTask() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Task not found");
          }
          throw new Error(`Failed to load task: ${res.statusText}`);
        }
        const data: Task = await res.json();
        setTask(data);
        setEditTitle(data.title);
        setEditDescription(data.description);
        setEditChecklist(data.checklist);
        setEditTeamId(data.teamId);
        titleBeforeEdit.current = data.title;
        descriptionBeforeEdit.current = data.description;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load task");
      } finally {
        setLoading(false);
      }
    }

    fetchTask();
  }, [taskId, projectId]);

  // Fetch execution history
  useEffect(() => {
    async function fetchRuns() {
      setLoadingRuns(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/runs`);
        if (res.ok) {
          const data = await res.json();
          setRuns(data);
        }
      } catch (err) {
        console.error("Failed to fetch runs:", err);
      } finally {
        setLoadingRuns(false);
      }
    }

    fetchRuns();
  }, [taskId, projectId]);

  // Fetch result summary from latest completed run
  useEffect(() => {
    if (!task || task.status !== "done" || runs.length === 0) {
      setResultSummary(null);
      return;
    }

    const completedRun = runs.find((r) => r.status === "completed");
    if (!completedRun) return;

    async function fetchSummary() {
      try {
        const res = await fetch(`/api/projects/${projectId}/runs/${completedRun!.id}`);
        if (res.ok) {
          const data = await res.json();
          setResultSummary(data.resultSummary ?? null);
        }
      } catch { /* ignore */ }
    }

    fetchSummary();
    // Poll a few times in case summary is still generating
    const interval = setInterval(fetchSummary, 5000);
    const timeout = setTimeout(() => clearInterval(interval), 30000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [task?.status, runs, projectId]);

  // Load team agents when teamId changes
  useEffect(() => {
    const teamId = editTeamId || task?.teamId;
    if (!teamId) {
      setTeamAgents([]);
      return;
    }

    async function fetchTeamAgents() {
      try {
        const res = await fetch(`/api/teams/${teamId}`);
        if (res.ok) {
          const data = await res.json();
          const agents: AgentInfo[] = (data.agents ?? []).map(
            (a: { id: string; name: string; emoji: string }) => ({
              id: a.id,
              name: a.name,
              emoji: a.emoji,
            }),
          );
          setTeamAgents(agents);
        }
      } catch { /* ignore */ }
    }

    fetchTeamAgents();
  }, [editTeamId, task?.teamId]);

  // Load agent statuses from the latest run (or active run)
  useEffect(() => {
    const activeRunId = runId || (runs.length > 0 ? runs[0].id : null);
    if (!activeRunId) {
      setAgentStatuses({});
      return;
    }

    async function fetchRunStatuses() {
      try {
        const res = await fetch(`/api/projects/${projectId}/runs/${activeRunId}`);
        if (res.ok) {
          const data = await res.json();
          const statuses = data.agentStatuses ?? {};

          // Add Orchestrator to teamAgents if present
          if ("Orchestrator" in statuses) {
            setTeamAgents((prev) => {
              if (prev.some((a) => a.name === "Orchestrator")) return prev;
              return [{ id: "orchestrator", name: "Orchestrator", emoji: "🎯" }, ...prev];
            });
          }

          setAgentStatuses(statuses);
        }
      } catch { /* ignore */ }
    }

    fetchRunStatuses();

    // Poll while task is running
    if (task?.status === "running") {
      const interval = setInterval(fetchRunStatuses, 3000);
      return () => clearInterval(interval);
    }
  }, [runId, runs, projectId, task?.status]);

  // Fetch execution prompt when toggled
  const fetchPrompt = useCallback(async () => {
    if (promptText !== null) return; // Already fetched

    setLoadingPrompt(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/prompt`);
      if (res.ok) {
        const data = await res.json();
        setPromptText(data.prompt);
      } else {
        setPromptText("Failed to load prompt");
      }
    } catch (err) {
      setPromptText("Failed to load prompt");
    } finally {
      setLoadingPrompt(false);
    }
  }, [projectId, taskId, promptText]);

  // Toggle prompt visibility
  const handleTogglePrompt = useCallback(() => {
    if (!showPrompt && promptText === null) {
      fetchPrompt();
    }
    setShowPrompt(!showPrompt);
  }, [showPrompt, promptText, fetchPrompt]);

  // Save changes to server
  const saveChanges = useCallback(
    async (updates: Partial<Task>) => {
      if (!task) return;

      setSaving(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          throw new Error(`Failed to save task: ${res.statusText}`);
        }

        const updated: Task = await res.json();
        setTask(updated);
        titleBeforeEdit.current = updated.title;
        descriptionBeforeEdit.current = updated.description;

        // Reset prompt cache since task changed
        setPromptText(null);

        // Notify parent for refresh (task list may need to update)
        onUpdate?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save task");
      } finally {
        setSaving(false);
      }
    },
    [task, taskId, projectId, onUpdate],
  );

  // Debounced save
  const debouncedSave = useCallback(
    (updates: Partial<Task>) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        saveChanges(updates);
      }, 300);
    },
    [saveChanges],
  );

  // Handle title blur
  const handleTitleBlur = useCallback(() => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      // Revert to previous value
      setEditTitle(titleBeforeEdit.current);
      return;
    }
    if (trimmed !== titleBeforeEdit.current) {
      saveChanges({ title: trimmed });
    }
  }, [editTitle, saveChanges]);

  // Handle description blur
  const handleDescriptionBlur = useCallback(() => {
    if (editDescription !== descriptionBeforeEdit.current) {
      saveChanges({ description: editDescription });
    }
  }, [editDescription, saveChanges]);

  // Handle checklist change (debounced)
  const handleChecklistChange = useCallback(
    (newChecklist: ChecklistItem[]) => {
      setEditChecklist(newChecklist);
      debouncedSave({ checklist: newChecklist });
    },
    [debouncedSave],
  );

  // Handle team change (immediate)
  const handleTeamChange = useCallback(
    (newTeamId: string | null) => {
      setEditTeamId(newTeamId);
      // Reset prompt cache since team changed
      setPromptText(null);
      saveChanges({ teamId: newTeamId });
    },
    [saveChanges],
  );

  // Fetch and refresh task data
  const refreshTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`);
      if (res.ok) {
        const data: Task = await res.json();
        setTask(data);
        setEditTitle(data.title);
        setEditDescription(data.description);
        setEditChecklist(data.checklist);
        setEditTeamId(data.teamId);
        titleBeforeEdit.current = data.title;
        descriptionBeforeEdit.current = data.description;
        onUpdate?.();
      }
      // Also refresh runs
      const runsRes = await fetch(`/api/projects/${projectId}/tasks/${taskId}/runs`);
      if (runsRes.ok) {
        setRuns(await runsRes.json());
      }
    } catch (err) {
      console.error("Failed to refresh task:", err);
    }
  }, [projectId, taskId, onUpdate]);

  // Handle execute button click
  const handleExecute = useCallback(async () => {
    if (!task) return;

    setExecuting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/execute`,
        {
          method: "POST",
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to execute task: ${res.statusText}`,
        );
      }

      const data = await res.json();
      setRunId(data.runId);

      // Update task status to running immediately
      setTask({ ...task, status: "running" });
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute task");
    } finally {
      setExecuting(false);
    }
  }, [task, taskId, projectId, onUpdate]);

  // Handle execution completion
  const handleExecutionComplete = useCallback(
    (_status: "completed" | "failed") => {
      // Refresh task data to get updated checklist and status
      refreshTask();
    },
    [refreshTask],
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-bg-primary p-6">
        <p className="font-body text-sm text-text-secondary">Loading task...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="font-body text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  const isLocked = task.status === "done" || task.status === "running";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-bg-primary p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-black">
            Task Details
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary"
              title="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Locked notice */}
        {isLocked && (
          <div className={`mb-4 rounded-md border px-4 py-2.5 ${
            task.status === "running"
              ? "border-info/20 bg-info-light"
              : "border-success/20 bg-success-light"
          }`}>
            <p className={`font-body text-sm ${task.status === "running" ? "text-info" : "text-success"}`}>
              {task.status === "running"
                ? "⏳ Task is running. Details are locked during execution."
                : "✓ Task completed. Create a new task to make changes."}
            </p>
          </div>
        )}

        {/* Result Summary */}
        {task.status === "done" && resultSummary && (
          <div className="mb-4 rounded-md border border-border bg-bg-secondary p-4">
            <label className="mb-2 block font-body text-xs font-medium text-text-secondary">
              Result
            </label>
            <p className="whitespace-pre-wrap font-body text-sm text-text-primary">
              {resultSummary}
            </p>
            {runs.length > 0 && runs[0].status === "completed" && (
              <Link
                to={`/projects/${projectId}/runs/${runs[0].id}`}
                className="mt-2 inline-flex items-center gap-1 font-body text-xs text-primary hover:text-primary/80"
              >
                View full execution details →
              </Link>
            )}
          </div>
        )}
        {task.status === "done" && !resultSummary && (
          <div className="mb-4 rounded-md border border-border bg-bg-secondary p-4">
            <p className="font-body text-sm text-text-secondary animate-pulse">
              Generating summary...
            </p>
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          <label className="mb-1 block font-body text-xs font-medium text-text-secondary">
            Title
          </label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => !isLocked && setEditTitle(e.target.value)}
            onBlur={handleTitleBlur}
            disabled={isLocked}
            className={`w-full rounded-md border border-border px-3 py-2 font-body text-base font-medium text-black focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${isLocked ? "cursor-not-allowed bg-bg-secondary opacity-60" : "bg-white"}`}
            data-testid="task-title-input"
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="mb-1 block font-body text-xs font-medium text-text-secondary">
            Description
          </label>
          <textarea
            value={editDescription}
            onChange={(e) => !isLocked && setEditDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            disabled={isLocked}
            placeholder="Add a description..."
            rows={3}
            className={`w-full rounded-md border border-border px-3 py-2 font-body text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${isLocked ? "cursor-not-allowed bg-bg-secondary opacity-60" : "bg-white"}`}
            data-testid="task-description-input"
          />
        </div>

        {/* Checklist */}
        <div className="mb-4">
          <label className="mb-2 block font-body text-xs font-medium text-text-secondary">
            Checklist
          </label>
          <div className={isLocked ? "pointer-events-none opacity-60" : ""}>
            <ChecklistEditor
              items={editChecklist}
              onChange={handleChecklistChange}
            />
          </div>
        </div>

        {/* Team Selector */}
        <div className="mb-6">
          <label className="mb-2 block font-body text-xs font-medium text-text-secondary">
            Assigned Team
          </label>
          <div className={isLocked ? "pointer-events-none opacity-60" : ""}>
            <TeamSelector teamId={editTeamId} onChange={handleTeamChange} />
          </div>
        </div>

        {/* Team Agent Status */}
        {teamAgents.length > 0 && Object.keys(agentStatuses).length > 0 && (
          <div className="mb-4">
            <label className="mb-2 block font-body text-xs font-medium text-text-secondary">
              Team Progress
            </label>
            <TeamProgress agents={teamAgents} agentStatuses={agentStatuses} />
          </div>
        )}

        {/* View Execution Prompt Toggle */}
        {editTeamId && (
          <div className="mb-4">
            <button
              onClick={handleTogglePrompt}
              className="flex items-center gap-2 font-body text-sm text-primary hover:text-primary/80"
              data-testid="view-prompt-toggle"
            >
              {showPrompt ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              View execution prompt
            </button>

            {showPrompt && (
              <div className="mt-2 rounded-md border border-border bg-bg-secondary p-4">
                {loadingPrompt ? (
                  <p className="font-body text-sm text-text-secondary">Loading prompt...</p>
                ) : (
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-text-primary">
                    {promptText}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* Execute Button */}
        <div>
          <button
            disabled={
              !editTeamId ||
              task.status === "running" ||
              task.status === "done" ||
              executing
            }
            onClick={handleExecute}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-white transition-colors disabled:opacity-50 hover:bg-primary/90 disabled:hover:bg-primary"
            title={
              !editTeamId
                ? "Assign a team to execute this task"
                : task.status === "done"
                  ? "Task is already completed"
                  : task.status === "running"
                    ? "Task is currently running"
                    : "Execute this task"
            }
            data-testid="execute-button"
          >
            <Play className="h-4 w-4" />
            {task.status === "running"
              ? "Running..."
              : task.status === "done"
                ? "Completed"
                : executing
                  ? "Starting..."
                  : "Execute Task"}
          </button>
        </div>

        {/* Saving indicator */}
        {saving && (
          <div className="mt-4 font-body text-xs text-text-secondary">
            Saving...
          </div>
        )}

        {/* View Execution link */}
        {runId && (
          <Link
            to={`/projects/${projectId}/runs/${runId}`}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-primary bg-primary-light px-4 py-2 font-body text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            {task?.status === "running" ? "View Live Execution" : "View Execution Details"}
          </Link>
        )}

        {/* Activity Log (shown during and after execution) */}
        {runId && (
          <TaskActivityLog
            projectId={projectId}
            runId={runId}
            onComplete={handleExecutionComplete}
          />
        )}
      </div>

      {/* Execution History */}
      {runs.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-primary p-6">
          <h3 className="mb-4 font-heading text-lg font-semibold text-black">
            Execution History
          </h3>

          {loadingRuns ? (
            <p className="font-body text-sm text-text-secondary">Loading history...</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const statusBadge = getRunStatusBadge(run.status);
                return (
                  <Link
                    key={run.id}
                    to={`/projects/${projectId}/runs/${run.id}`}
                    className="flex items-center justify-between rounded-md border border-border bg-bg-secondary p-3 transition-colors hover:border-primary"
                    data-testid={`run-history-${run.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-body text-xs font-medium ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                      <span className="flex items-center gap-1 font-body text-sm text-text-secondary">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(run.startedAt)}
                      </span>
                      {run.costUsd != null && (
                        <span className="flex items-center gap-1 font-body text-sm text-text-secondary">
                          <DollarSign className="h-3.5 w-3.5" />
                          ${run.costUsd.toFixed(4)}
                        </span>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-text-secondary" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
