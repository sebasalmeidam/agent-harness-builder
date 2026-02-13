import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  teamId: string | null;
  createdAt: string;
}

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchProjects() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error(`Failed to fetch projects: ${res.statusText}`);
      }
      const data: ProjectSummary[] = await res.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  async function handleDelete(id: string, name: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Failed to delete project: ${res.statusText}`);
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete project",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 className="font-heading text-[28px] font-semibold text-black">
        Projects
      </h1>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchProjects}
            className="mt-2 text-sm font-medium text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !error && (
        <p className="mt-6 text-center font-body text-base text-text-secondary">
          Loading projects...
        </p>
      )}

      {!loading && !error && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* New Project card */}
          <Link
            to="/projects/new"
            className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-bg-primary p-6 text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="mb-2 h-8 w-8" />
            <span className="font-body text-sm font-medium">New Project</span>
          </Link>

          {/* Project cards */}
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative flex min-h-[140px] flex-col rounded-lg border border-border bg-bg-primary p-6 transition-shadow hover:shadow-md"
            >
              <Link
                to={`/projects/${project.id}`}
                className="flex flex-1 flex-col"
              >
                <h2 className="font-heading text-lg font-semibold text-black">
                  {project.name}
                </h2>
                {project.description && (
                  <p className="mt-1 line-clamp-2 font-body text-sm text-text-secondary">
                    {project.description}
                  </p>
                )}
                <div className="mt-auto pt-4">
                  <span className="font-body text-xs text-text-secondary">
                    {project.teamId ? "Team assigned" : "No team assigned"}
                  </span>
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(project.id, project.name);
                }}
                disabled={deletingId === project.id}
                className="absolute right-3 top-3 rounded p-1 text-text-secondary opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                title="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {projects.length === 0 && (
            <p className="col-span-full text-center font-body text-base text-text-secondary">
              No projects yet. Create your first project to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
