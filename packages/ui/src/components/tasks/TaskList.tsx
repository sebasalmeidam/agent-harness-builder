import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

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

  // Get team name by ID
  function getTeamName(teamId: string | null): string {
    if (!teamId) return "No team";
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : "Unknown team";
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
      {/* Add Task Button */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-bg-primary px-4 py-2 font-body text-sm font-medium text-text-primary transition-colors hover:border-primary hover:text-primary"
          data-testid="add-task-button"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
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

      {/* Task List */}
      {tasks.length > 0 && (
        <div className="space-y-2" data-testid="task-list">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`group relative flex items-center justify-between rounded-lg border p-4 transition-colors ${
                selectedTaskId === task.id
                  ? "border-primary bg-primary-light"
                  : "border-border bg-bg-primary hover:border-primary/50"
              }`}
              onClick={() => onTaskSelect?.(task.id)}
              data-testid={`task-item-${task.id}`}
            >
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
                  <span
                    className="font-body text-xs text-text-secondary"
                    data-testid={`task-team-${task.id}`}
                  >
                    {getTeamName(task.teamId)}
                  </span>
                  <span
                    className="font-body text-xs text-text-secondary"
                    data-testid={`task-progress-${task.id}`}
                  >
                    {task.checklist.filter((item) => item.completed).length}/
                    {task.checklist.length} done
                  </span>
                </div>
              </div>

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
