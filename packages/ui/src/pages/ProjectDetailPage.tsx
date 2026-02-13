import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Save, Trash2, Users, Play } from "lucide-react";
import AssignTeamModal from "../components/AssignTeamModal";
import RunHistoryList from "../components/execution/RunHistoryList";

interface Project {
  id: string;
  name: string;
  description: string;
  spec: string;
  teamId: string | null;
  gitUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TeamInfo {
  id: string;
  name: string;
  agentCount: number;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Spec editor state
  const [spec, setSpec] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Team info
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);

  // Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Run trigger state
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

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
        setSpec(data.spec);
        setIsDirty(false);
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

  // Fetch team info when project has a teamId
  useEffect(() => {
    if (!project?.teamId) {
      setTeamInfo(null);
      return;
    }

    async function fetchTeamInfo() {
      try {
        const res = await fetch(`/api/teams/${project!.teamId}`);
        if (!res.ok) {
          setTeamInfo(null);
          return;
        }
        const data = await res.json();
        setTeamInfo({
          id: data.id,
          name: data.name,
          agentCount: data.agents?.length ?? 0,
        });
      } catch {
        setTeamInfo(null);
      }
    }

    fetchTeamInfo();
  }, [project?.teamId]);

  // Clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handleSpecChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setSpec(e.target.value);
      setIsDirty(true);
    },
    [],
  );

  const handleSaveSpec = useCallback(async () => {
    if (!project) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save spec: ${res.statusText}`);
      }

      const updated: Project = await res.json();
      setProject(updated);
      setSpec(updated.spec);
      setIsDirty(false);
      setSaveMessage({ type: "success", text: "Spec saved successfully" });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save spec",
      });
    } finally {
      setSaving(false);
    }
  }, [project, spec]);

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

  const handleTeamAssigned = useCallback(
    (teamId: string) => {
      setShowAssignModal(false);
      // Re-fetch project to get updated data
      if (project) {
        setProject({ ...project, teamId });
      }
    },
    [project],
  );

  const handleRunTeam = useCallback(async () => {
    if (!project) return;

    setTriggering(true);
    setTriggerError(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/runs`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Failed to trigger run: ${res.statusText}`);
      }

      const data = await res.json();
      navigate(`/projects/${project.id}/runs/${data.id}`);
    } catch (err) {
      setTriggerError(
        err instanceof Error ? err.message : "Failed to trigger execution",
      );
    } finally {
      setTriggering(false);
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
        <div className="flex-1">
          <h1 className="font-heading text-[28px] font-semibold text-black">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-1 font-body text-sm text-text-secondary">
              {project.description}
            </p>
          )}
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

      {/* Spec editor section */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="project-spec"
            className="font-body text-sm font-medium text-black"
          >
            Project Specification
            {isDirty && (
              <span
                className="ml-2 inline-flex items-center gap-1 text-primary"
                data-testid="dirty-indicator"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                Unsaved changes
              </span>
            )}
          </label>
          <button
            onClick={handleSaveSpec}
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Spec"}
          </button>
        </div>
        <textarea
          id="project-spec"
          value={spec}
          onChange={handleSpecChange}
          placeholder="Describe what this project should build... This is the specification that agents will use to understand the work."
          rows={10}
          className="block w-full rounded-md border border-border bg-bg-primary px-3 py-2 font-body text-sm text-black placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Assigned team section */}
      <div className="rounded-lg border border-border bg-bg-primary p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-black">
            Assigned Team
          </h2>
          <button
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <Users className="h-4 w-4" />
            {project.teamId ? "Change Team" : "Assign Team"}
          </button>
        </div>

        {project.teamId && teamInfo ? (
          <div className="flex items-center gap-3">
            <Link
              to={`/teams/${teamInfo.id}`}
              className="font-body text-sm font-medium text-primary hover:underline"
            >
              {teamInfo.name}
            </Link>
            <span className="font-body text-xs text-text-secondary">
              {teamInfo.agentCount}{" "}
              {teamInfo.agentCount === 1 ? "agent" : "agents"}
            </span>
          </div>
        ) : project.teamId && !teamInfo ? (
          <p className="font-body text-sm text-text-secondary">
            Team: {project.teamId}
          </p>
        ) : (
          <p className="font-body text-sm text-text-secondary">
            No team assigned to this project.
          </p>
        )}
      </div>

      {/* Run Team button */}
      <div className="mt-6">
        {triggerError && (
          <div
            className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 font-body text-sm text-red-700"
            role="alert"
            data-testid="trigger-error"
          >
            {triggerError}
          </div>
        )}
        <button
          onClick={handleRunTeam}
          disabled={!project.teamId || !spec.trim() || triggering}
          className="inline-flex items-center gap-1.5 rounded-md bg-success px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="run-team-button"
        >
          <Play className="h-4 w-4" />
          {triggering ? "Starting..." : "Run Team"}
        </button>
      </div>

      {/* Past Executions section */}
      <div className="mt-8">
        <h2 className="mb-3 font-heading text-lg font-semibold text-black">
          Past Executions
        </h2>
        <RunHistoryList projectId={project.id} />
      </div>

      {/* Assign Team Modal */}
      {showAssignModal && (
        <AssignTeamModal
          projectId={project.id}
          currentTeamId={project.teamId}
          onAssigned={handleTeamAssigned}
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </div>
  );
}
