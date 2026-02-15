import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Trash2, FolderOpen, Pencil, X, Check } from "lucide-react";
import TaskList from "../components/tasks/TaskList";
import TaskDetailPanel from "../components/tasks/TaskDetailPanel";
import InitializeButton from "../components/tasks/InitializeButton";
import SuggestionDraftList from "../components/tasks/SuggestionDraftList";

interface TaskSuggestion {
  title: string;
  description: string;
  checklist: { description: string }[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  path: string;
  previousPaths?: string[];
  emoji: string;
  createdAt: string;
  updatedAt: string;
  hasExecutedTasks?: boolean;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Path editing state
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [savingPath, setSavingPath] = useState(false);

  // Task selection state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskListKey, setTaskListKey] = useState(0);

  // Suggestion state
  const [suggestions, setSuggestions] = useState<TaskSuggestion[] | null>(null);
  const [taskCount, setTaskCount] = useState(0);

  // Refresh task list (called after task detail panel saves)
  const handleTaskUpdate = useCallback(() => {
    setTaskListKey((prev) => prev + 1);
  }, []);

  // Handle suggestions received from InitializeButton
  const handleSuggestionsReceived = useCallback((newSuggestions: TaskSuggestion[]) => {
    setSuggestions(newSuggestions);
  }, []);

  // Handle suggestions completed (all accepted or rejected)
  const handleSuggestionsComplete = useCallback(() => {
    setSuggestions(null);
    setTaskListKey((prev) => prev + 1);
  }, []);

  // Handle task count change from TaskList
  const handleTaskCountChange = useCallback((count: number) => {
    setTaskCount(count);
  }, []);

  // Save message for inline editing feedback
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Inline editing state for name and description
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const nameBeforeEdit = useRef("");
  const descriptionBeforeEdit = useRef("");

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Project not found");
          }
          throw new Error(`Failed to load project: ${res.statusText}`);
        }
        const data: Project = await res.json();
        setProject(data);
        setEditName(data.name);
        setEditDescription(data.description);
        nameBeforeEdit.current = data.name;
        descriptionBeforeEdit.current = data.description;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load project",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [id]);

  // Clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handlePatchField = useCallback(
    async (field: "name" | "description", value: string) => {
      if (!project) return;

      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? `Failed to save ${field}`);
        }

        const updated: Project = await res.json();
        setProject(updated);
        setEditName(updated.name);
        setEditDescription(updated.description);
        nameBeforeEdit.current = updated.name;
        descriptionBeforeEdit.current = updated.description;
      } catch (err) {
        setSaveMessage({
          type: "error",
          text: err instanceof Error ? err.message : `Failed to save ${field}`,
        });
        // Revert to previous value on error
        if (field === "name") {
          setEditName(nameBeforeEdit.current);
        } else {
          setEditDescription(descriptionBeforeEdit.current);
        }
      }
    },
    [project],
  );

  const handleSaveHeader = useCallback(async () => {
    const trimmedName = editName.trim();
    if (trimmedName.length === 0) {
      setEditName(nameBeforeEdit.current);
    } else if (trimmedName !== nameBeforeEdit.current) {
      handlePatchField("name", trimmedName);
    }
    if (editDescription !== descriptionBeforeEdit.current) {
      handlePatchField("description", editDescription);
    }
    // Save path if changed
    if (editingPath !== null && editingPath !== project?.path) {
      const trimmedPath = editingPath.trim();
      if (trimmedPath && project) {
        if (project.hasExecutedTasks) {
          const confirmed = window.confirm(
            "This project has executed tasks using the previous path. Changing it means new executions target a different directory.\n\nContinue?"
          );
          if (!confirmed) {
            setEditingPath(null);
            setIsEditingHeader(false);
            return;
          }
        }
        setSavingPath(true);
        try {
          const res = await fetch(`/api/projects/${project.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: trimmedPath }),
          });
          if (res.ok) {
            const updated = await res.json();
            setProject(updated);
            setEditingPath(null);
          }
        } catch { /* ignore */ } finally {
          setSavingPath(false);
        }
      }
    }
    setIsEditingHeader(false);
  }, [editName, editDescription, editingPath, project, handlePatchField]);

  const handleCancelEdit = useCallback(() => {
    setEditName(nameBeforeEdit.current);
    setEditDescription(descriptionBeforeEdit.current);
    setIsEditingHeader(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!project) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`Failed to delete project: ${res.statusText}`);
      }

      navigate("/projects");
    } catch (err) {
      setSaveMessage({
        type: "error",
        text:
          err instanceof Error ? err.message : "Failed to delete project",
      });
    }
  }, [project, navigate]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-body text-base text-text-secondary">
          Loading project...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-md border border-red-200 bg-red-50 px-6 py-4 text-center">
          <p className="font-body text-sm text-red-700">{error}</p>
          <Link
            to="/projects"
            className="mt-3 inline-block font-body text-sm font-medium text-primary underline"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-2 font-body text-sm text-text-secondary">
        <Link to="/projects" className="hover:text-primary">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">{project.name}</span>
      </nav>

      {/* Project header card */}
      <div className="mb-6 rounded-lg border border-border bg-bg-primary p-5">
        {isEditingHeader ? (
          /* Edit mode */
          <div>
            <div className="flex items-start gap-3">
              <span className="text-[32px] leading-none" data-testid="project-emoji">
                {project.emoji || "\u{1F4E6}"}
              </span>
              <div className="flex-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label="Project name"
                  autoFocus
                  className="w-full rounded-md border border-border bg-white px-3 py-1.5 font-heading text-xl font-semibold text-black focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe the project (used as input for Initialize Project)"
                  aria-label="Project description"
                  rows={2}
                  className="mt-2 w-full resize-none rounded-md border border-border bg-white px-3 py-1.5 font-body text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="mt-2">
                  <label className="flex items-center gap-1.5 font-body text-xs font-medium text-text-secondary">
                    <FolderOpen className="h-3 w-3" />
                    Project Path
                  </label>
                  <input
                    type="text"
                    value={editingPath ?? project.path ?? ""}
                    onChange={(e) => setEditingPath(e.target.value)}
                    placeholder="/absolute/path/to/project"
                    className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 font-body text-sm font-mono text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 font-body text-sm text-text-secondary hover:bg-bg-secondary"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <button
                onClick={handleSaveHeader}
                disabled={savingPath}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-body text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </div>
        ) : (
          /* View mode */
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-1 gap-3">
              <span className="text-[32px] leading-none" data-testid="project-emoji">
                {project.emoji || "\u{1F4E6}"}
              </span>
              <div className="flex-1">
                <h1 className="font-heading text-2xl font-semibold text-black">
                  {project.name}
                </h1>
                <p className="mt-1 font-body text-sm text-text-secondary">
                  {project.description || "No description"}
                </p>
                {project.path && (
                  <div className="mt-2 flex items-center gap-1.5 font-body text-xs text-text-muted">
                    <FolderOpen className="h-3 w-3" />
                    <span className="font-mono">{project.path}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsEditingHeader(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary"
                title="Edit project"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={handleDelete}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-secondary hover:text-red-600"
                title="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save message */}
      {saveMessage && (
        <div
          className={`mb-4 rounded-md border px-4 py-2 font-body text-sm ${
            saveMessage.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role="status"
        >
          {saveMessage.text}
        </div>
      )}

      {/* Tasks section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Task List */}
        <div className="rounded-lg border border-border bg-bg-primary p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold text-black">
            Tasks
          </h2>

          {/* Initialize button - shown when task count is 0 and no suggestions */}
          {!suggestions && (
            <InitializeButton
              projectId={project.id}
              taskCount={taskCount}
              onSuggestionsReceived={handleSuggestionsReceived}
            />
          )}

          {/* Suggestion draft list - shown when suggestions exist */}
          {suggestions && (
            <SuggestionDraftList
              projectId={project.id}
              suggestions={suggestions}
              onComplete={handleSuggestionsComplete}
            />
          )}

          {/* Task list - always shown */}
          {!suggestions && (
            <TaskList
              key={taskListKey}
              projectId={project.id}
              onTaskSelect={(id) => setSelectedTaskId(prev => prev === id ? null : id)}
              selectedTaskId={selectedTaskId}
              onTaskCountChange={handleTaskCountChange}
            />
          )}
        </div>

        {/* Task Detail Panel */}
        {selectedTaskId && (
          <div>
            <h2 className="mb-4 font-heading text-lg font-semibold text-black">
              Task Details
            </h2>
            <TaskDetailPanel
              taskId={selectedTaskId}
              projectId={project.id}
              onUpdate={handleTaskUpdate}
              onClose={() => setSelectedTaskId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
