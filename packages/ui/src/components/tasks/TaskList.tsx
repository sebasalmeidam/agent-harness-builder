import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Trash2, Clock, ExternalLink, Eye, EyeOff, GripVertical } from "lucide-react";
import { Link } from "react-router-dom";

interface ChecklistItem {
  id: string;
  description: string;
  completed: boolean;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  teamId: string | null;
  status: "pending" | "running" | "done" | "failed";
}

interface TeamSummary {
  id: string;
  name: string;
  description: string;
  agentCount: number;
  agentEmojis: string[];
}

interface RunSummary {
  id: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  costUsd?: number | null;
}

interface TaskListProps {
  projectId: string;
  onTaskSelect?: (taskId: string) => void;
  selectedTaskId?: string | null;
  onTaskCountChange?: (count: number) => void;
}

export default function TaskList({
  projectId,
  onTaskSelect,
  selectedTaskId,
  onTaskCountChange,
}: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Runs per task: taskId -> RunSummary[]
  const [taskRuns, setTaskRuns] = useState<Record<string, RunSummary[]>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showDone, setShowDone] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      if (!res.ok) {
        throw new Error(`Failed to fetch tasks: ${res.statusText}`);
      }
      const data: Task[] = await res.json();
      setTasks(data);
      onTaskCountChange?.(data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [projectId, onTaskCountChange]);

  // Fetch teams once for name lookup
  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch("/api/teams");
        if (!res.ok) {
          throw new Error(`Failed to fetch teams: ${res.statusText}`);
        }
        const data: TeamSummary[] = await res.json();
        setTeams(data);
      } catch (err) {
        // Silently fail - team names will just not be shown
        console.error("Failed to load teams:", err);
      }
    }

    fetchTeams();
  }, []);

  // Fetch tasks on mount
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Fetch runs for all tasks
  useEffect(() => {
    if (tasks.length === 0) return;

    async function fetchAllRuns() {
      const runsMap: Record<string, RunSummary[]> = {};
      await Promise.all(
        tasks.map(async (task) => {
          try {
            const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}/runs`);
            if (res.ok) {
              runsMap[task.id] = await res.json();
            }
          } catch { /* ignore */ }
        }),
      );
      setTaskRuns(runsMap);
    }

    fetchAllRuns();
  }, [tasks, projectId]);

  // Create task
  async function handleCreateTask() {
    const title = newTaskTitle.trim();
    if (!title) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create task: ${res.statusText}`);
      }

      const newTask: Task = await res.json();
      setTasks((prev) => {
        const updated = [...prev, newTask];
        onTaskCountChange?.(updated.length);
        return updated;
      });
      setNewTaskTitle("");
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  // Delete task
  async function handleDelete(taskId: string, taskTitle: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${taskTitle}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(taskId);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Failed to delete task: ${res.statusText}`);
      }
      setTasks((prev) => {
        const updated = prev.filter((t) => t.id !== taskId);
        onTaskCountChange?.(updated.length);
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  }

  // Assign team to task inline
  async function handleAssignTeam(taskId: string, teamId: string) {
    const value = teamId === "" ? null : teamId;
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: value }),
      });
      if (res.ok) {
        const updated: Task = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      }
    } catch { /* ignore */ }
  }

  // Format date compactly
  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // Get run status badge
  function getRunBadge(status: RunSummary["status"]) {
    switch (status) {
      case "running":
        return { label: "Running", className: "bg-info-light text-info animate-pulse" };
      case "completed":
        return { label: "Done", className: "bg-success-light text-success" };
      case "failed":
        return { label: "Failed", className: "bg-red-50 text-red-600" };
    }
  }

  // Get status badge color
  function getStatusBadge(status: Task["status"]) {
    switch (status) {
      case "pending":
        return "bg-[rgb(189,190,191)] text-text-secondary";
      case "running":
        return "bg-info-light text-info";
      case "done":
        return "bg-success-light text-success";
      case "failed":
        return "bg-red-50 text-red-600";
    }
  }

  // Drag & drop handlers
  function handleDragStart(taskId: string) {
    dragRef.current = taskId;
    setDragId(taskId);
  }

  function handleDragOver(e: React.DragEvent, taskId: string) {
    e.preventDefault();
    setDragOverId(taskId);
  }

  function handleDragEnd() {
    setDragId(null);
    setDragOverId(null);
    dragRef.current = null;
  }

  async function handleDrop(targetId: string) {
    const sourceId = dragRef.current;
    if (!sourceId || sourceId === targetId) {
      handleDragEnd();
      return;
    }

    // Reorder locally first for instant feedback
    const sourceIndex = tasks.findIndex((t) => t.id === sourceId);
    const targetIndex = tasks.findIndex((t) => t.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    const reordered = [...tasks];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setTasks(reordered);
    handleDragEnd();

    // Persist to backend
    try {
      await fetch(`/api/projects/${projectId}/tasks/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: reordered.map((t) => t.id) }),
      });
    } catch {
      // Revert on failure
      fetchTasks();
    }
  }

  // Filter tasks
  const visibleTasks = showDone ? tasks : tasks.filter((t) => t.status !== "done");
  const doneCount = tasks.filter((t) => t.status === "done").length;

  if (loading) {
    return (
      <p className="font-body text-sm text-text-secondary">Loading tasks...</p>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
        <p className="font-body text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar: Add Task + Toggle Done */}
      {!showAddForm && (
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-primary px-4 py-2 font-body text-sm font-medium text-text-primary transition-colors hover:border-primary hover:text-primary"
            data-testid="add-task-button"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
          {doneCount > 0 && (
            <button
              onClick={() => setShowDone((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-primary px-3 py-2 font-body text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
              title={showDone ? "Hide completed tasks" : "Show completed tasks"}
              data-testid="toggle-done-button"
            >
              {showDone ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showDone ? "Hide done" : `Show done (${doneCount})`}
            </button>
          )}
        </div>
      )}

      {/* Add Task Form */}
      {showAddForm && (
        <div className="mb-4 rounded-lg border border-border bg-bg-primary p-4">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Task title..."
            className="mb-3 w-full rounded-md border border-border px-3 py-2 font-body text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
            data-testid="new-task-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateTask();
              } else if (e.key === "Escape") {
                setShowAddForm(false);
                setNewTaskTitle("");
              }
            }}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim() || creating}
              className="rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              data-testid="create-task-button"
            >
              {creating ? "Creating..." : "Create Task"}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewTaskTitle("");
              }}
              className="rounded-md px-4 py-2 font-body text-sm text-text-secondary transition-colors hover:text-black"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && (
        <p
          className="font-body text-sm text-text-secondary"
          data-testid="tasks-empty"
        >
          No tasks yet. Click "Add Task" to create one.
        </p>
      )}

      {/* All filtered out */}
      {tasks.length > 0 && visibleTasks.length === 0 && (
        <p className="font-body text-sm text-text-secondary">
          All tasks are done.{" "}
          <button onClick={() => setShowDone(true)} className="text-primary underline">
            Show them
          </button>
        </p>
      )}

      {/* Task List */}
      {visibleTasks.length > 0 && (
        <div className="space-y-2" data-testid="task-list">
          {visibleTasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={() => handleDragStart(task.id)}
              onDragOver={(e) => handleDragOver(e, task.id)}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(task.id)}
              className={`group relative flex items-center justify-between rounded-lg border p-4 transition-colors ${
                dragId === task.id
                  ? "opacity-50"
                  : dragOverId === task.id
                    ? "border-primary border-dashed"
                    : selectedTaskId === task.id
                      ? "border-primary bg-primary-light"
                      : "border-border bg-bg-primary hover:border-primary/50"
              }`}
              onClick={() => onTaskSelect?.(task.id)}
              data-testid={`task-item-${task.id}`}
            >
              <div
                className="mr-3 cursor-grab text-text-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 font-body text-base font-medium text-black">
                  {task.title}
                </h3>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block rounded-sm px-2.5 py-1 font-body text-xs font-medium ${getStatusBadge(task.status)}`}
                    data-testid={`task-status-${task.id}`}
                  >
                    {task.status}
                  </span>
                  {task.status === "done" ? (
                    task.teamId && (
                      <span className="font-body text-xs text-text-secondary">
                        {teams.find((t) => t.id === task.teamId)?.name ?? "Team"}
                      </span>
                    )
                  ) : (
                    <select
                      value={task.teamId ?? ""}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleAssignTeam(task.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-body text-xs text-text-secondary transition-colors hover:border-border hover:bg-bg-secondary focus:border-primary focus:outline-none"
                      data-testid={`task-team-${task.id}`}
                    >
                      <option value="">No team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <span
                    className="font-body text-xs text-text-secondary"
                    data-testid={`task-progress-${task.id}`}
                  >
                    {task.checklist.filter((item) => item.completed).length}/
                    {task.checklist.length} done
                  </span>
                </div>

                {/* Runs for this task */}
                {(taskRuns[task.id] ?? []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {(taskRuns[task.id] ?? []).slice(0, 3).map((run) => {
                      const badge = getRunBadge(run.status);
                      return (
                        <Link
                          key={run.id}
                          to={`/projects/${projectId}/runs/${run.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 rounded border border-border/50 px-2 py-1 text-xs transition-colors hover:border-primary/50 hover:bg-bg-secondary"
                        >
                          <span className={`inline-block rounded-full px-1.5 py-0.5 font-body text-[10px] font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="flex items-center gap-1 text-text-secondary">
                            <Clock className="h-3 w-3" />
                            {formatDate(run.startedAt)}
                          </span>
                          {run.costUsd != null && (
                            <span className="text-text-secondary">${run.costUsd.toFixed(2)}</span>
                          )}
                          <ExternalLink className="ml-auto h-3 w-3 text-text-muted" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {task.status !== "done" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(task.id, task.title);
                  }}
                  disabled={deletingId === task.id}
                  className="rounded p-2 text-text-secondary transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Delete task"
                  data-testid={`delete-task-${task.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
