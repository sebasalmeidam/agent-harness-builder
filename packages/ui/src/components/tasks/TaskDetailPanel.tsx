import { useState, useEffect, useCallback, useRef } from "react";
import { Play } from "lucide-react";
import ChecklistEditor, { ChecklistItem } from "./ChecklistEditor";
import TeamSelector from "./TeamSelector";

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  teamId: string | null;
  status: "pending" | "running" | "done" | "failed";
}

interface TaskDetailPanelProps {
  taskId: string;
  projectId: string;
  onUpdate?: () => void;
}

export default function TaskDetailPanel({
  taskId,
  projectId,
  onUpdate,
}: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      saveChanges({ teamId: newTeamId });
    },
    [saveChanges],
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

  return (
    <div className="rounded-lg border border-border bg-bg-primary p-6">
      {/* Title */}
      <div className="mb-4">
        <label className="mb-1 block font-body text-xs font-medium text-text-secondary">
          Title
        </label>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="w-full rounded-md border border-border bg-white px-3 py-2 font-body text-base font-medium text-black focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          onChange={(e) => setEditDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder="Add a description..."
          rows={3}
          className="w-full rounded-md border border-border bg-white px-3 py-2 font-body text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid="task-description-input"
        />
      </div>

      {/* Checklist */}
      <div className="mb-4">
        <label className="mb-2 block font-body text-xs font-medium text-text-secondary">
          Checklist
        </label>
        <ChecklistEditor
          items={editChecklist}
          onChange={handleChecklistChange}
        />
      </div>

      {/* Team Selector */}
      <div className="mb-6">
        <label className="mb-2 block font-body text-xs font-medium text-text-secondary">
          Assigned Team
        </label>
        <TeamSelector teamId={editTeamId} onChange={handleTeamChange} />
      </div>

      {/* Execute Button */}
      <div>
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-white transition-colors disabled:opacity-50"
          title={
            editTeamId
              ? "Execution will be available in a future update"
              : "Assign a team to execute this task"
          }
          data-testid="execute-button"
        >
          <Play className="h-4 w-4" />
          Execute Task
        </button>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="mt-4 font-body text-xs text-text-secondary">
          Saving...
        </div>
      )}
    </div>
  );
}
