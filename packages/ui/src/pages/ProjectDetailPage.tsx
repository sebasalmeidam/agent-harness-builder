import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Trash2, FolderOpen } from "lucide-react";
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
  emoji: string;
  createdAt: string;
  updatedAt: string;
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

  const handleNameBlur = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed.length === 0) {
      // Revert to previous value -- empty name is not allowed
      setEditName(nameBeforeEdit.current);
      return;
    }
    if (trimmed !== nameBeforeEdit.current) {
      handlePatchField("name", trimmed);
    }
  }, [editName, handlePatchField]);

  const handleDescriptionBlur = useCallback(() => {
    if (editDescription !== descriptionBeforeEdit.current) {
      handlePatchField("description", editDescription);
    }
  }, [editDescription, handlePatchField]);

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

      {/* Project header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-1 gap-3">
          <span className="text-[32px] leading-none" data-testid="project-emoji">
            {project.emoji || "\u{1F4E6}"}
          </span>
          <div className="flex-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameBlur}
              aria-label="Project name"
              className="w-full border-0 bg-transparent p-0 font-heading text-[28px] font-semibold text-black focus:outline-none focus:ring-0"
            />
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description..."
              aria-label="Project description"
              className="mt-1 w-full border-0 bg-transparent p-0 font-body text-sm text-text-secondary focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm font-medium text-text-secondary transition-colors hover:border-red-300 hover:text-red-600"
          title="Delete project"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
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

      {/* Project path section */}
      <div className="mb-6 rounded-lg border border-border bg-bg-primary p-6">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="h-4 w-4 text-text-secondary" />
          <h2 className="font-heading text-lg font-semibold text-black">
            Project Path
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="flex-1 rounded-md border border-border bg-bg-secondary px-3 py-1.5 font-body text-sm font-mono text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="project-path"
            value={editingPath ?? project.path ?? ""}
            placeholder="/absolute/path/to/project"
            onChange={(e) => setEditingPath(e.target.value)}
          />
          {editingPath !== null && editingPath !== project.path && (
            <button
              className="rounded-md bg-primary px-3 py-1.5 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              disabled={savingPath}
              onClick={async () => {
                const trimmed = editingPath.trim();
                if (!trimmed) return;
                setSavingPath(true);
                try {
                  const res = await fetch(`/api/projects/${project.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: trimmed }),
                  });
                  if (!res.ok) {
                    const data = await res.json();
                    setSaveMessage({ type: "error", text: data.error || "Failed to update path" });
                  } else {
                    const updated = await res.json();
                    setProject(updated);
                    setEditingPath(null);
                    setSaveMessage({ type: "success", text: "Path updated. New tasks will use this directory." });
                  }
                } catch {
                  setSaveMessage({ type: "error", text: "Failed to update path" });
                } finally {
                  setSavingPath(false);
                }
              }}
            >
              {savingPath ? "Saving..." : "Save"}
            </button>
          )}
        </div>
        <p className="mt-1 font-body text-xs text-text-secondary">
          Absolute path to the project directory. Created automatically if it doesn't exist.
        </p>
      </div>

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
              onTaskSelect={setSelectedTaskId}
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
