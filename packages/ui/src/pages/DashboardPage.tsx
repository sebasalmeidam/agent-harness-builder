import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  teamId: string | null;
  createdAt: string;
}

interface TeamSummary {
  id: string;
  name: string;
  description: string;
  agentCount: number;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) {
          throw new Error(`Failed to fetch projects: ${res.statusText}`);
        }
        const data: ProjectSummary[] = await res.json();
        setProjects(data);
      } catch (err) {
        setProjectsError(
          err instanceof Error ? err.message : "Failed to load projects",
        );
      } finally {
        setProjectsLoading(false);
      }
    }

    async function fetchTeams() {
      setTeamsLoading(true);
      setTeamsError(null);
      try {
        const res = await fetch("/api/teams");
        if (!res.ok) {
          throw new Error(`Failed to fetch teams: ${res.statusText}`);
        }
        const data: TeamSummary[] = await res.json();
        setTeams(data);
      } catch (err) {
        setTeamsError(
          err instanceof Error ? err.message : "Failed to load teams",
        );
      } finally {
        setTeamsLoading(false);
      }
    }

    fetchProjects();
    fetchTeams();
  }, []);

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="font-heading text-[28px] font-semibold text-black">
          Welcome back
        </h1>
        <p className="mt-1 font-body text-base text-text-secondary">
          Here is an overview of your projects and teams.
        </p>
      </div>

      {/* My Projects section */}
      <section className="mb-10">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-black">
            My Projects
          </h2>
          <Link
            to="/projects/new"
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 font-body text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>

        {projectsError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{projectsError}</p>
          </div>
        )}

        {projectsLoading && !projectsError && (
          <p className="mt-4 text-center font-body text-sm text-text-secondary">
            Loading projects...
          </p>
        )}

        {!projectsLoading && !projectsError && projects.length === 0 && (
          <p className="mt-4 font-body text-sm text-text-secondary">
            No projects yet. Create your first project to get started.
          </p>
        )}

        {!projectsLoading && !projectsError && projects.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex min-h-[120px] flex-col rounded-lg border border-border bg-bg-primary p-5 transition-shadow hover:shadow-md"
              >
                <h3 className="font-heading text-lg font-semibold text-black">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="mt-1 line-clamp-2 font-body text-sm text-text-secondary">
                    {project.description}
                  </p>
                )}
                <div className="mt-auto pt-3">
                  <span className="font-body text-xs text-text-secondary">
                    {project.teamId ? "Team assigned" : "No team assigned"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* My Teams section */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-black">
            My Teams
          </h2>
          <Link
            to="/teams/new"
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 font-body text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            New Team
          </Link>
        </div>

        {teamsError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{teamsError}</p>
          </div>
        )}

        {teamsLoading && !teamsError && (
          <p className="mt-4 text-center font-body text-sm text-text-secondary">
            Loading teams...
          </p>
        )}

        {!teamsLoading && !teamsError && teams.length === 0 && (
          <p className="mt-4 font-body text-sm text-text-secondary">
            No teams yet. Create your first team to get started.
          </p>
        )}

        {!teamsLoading && !teamsError && teams.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="flex min-h-[120px] flex-col rounded-lg border border-border bg-bg-primary p-5 transition-shadow hover:shadow-md"
              >
                <h3 className="font-heading text-lg font-semibold text-black">
                  {team.name}
                </h3>
                {team.description && (
                  <p className="mt-1 line-clamp-2 font-body text-sm text-text-secondary">
                    {team.description}
                  </p>
                )}
                <div className="mt-auto pt-3">
                  <span className="font-body text-xs text-text-secondary">
                    {team.agentCount}{" "}
                    {team.agentCount === 1 ? "agent" : "agents"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
