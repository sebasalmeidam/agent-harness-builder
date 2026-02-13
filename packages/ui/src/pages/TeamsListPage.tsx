import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";

interface TeamSummary {
  id: string;
  name: string;
  description: string;
  agentCount: number;
}

export default function TeamsListPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchTeams() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teams");
      if (!res.ok) {
        throw new Error(`Failed to fetch teams: ${res.statusText}`);
      }
      const data: TeamSummary[] = await res.json();
      setTeams(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeams();
  }, []);

  async function handleDelete(id: string, name: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Failed to delete team: ${res.statusText}`);
      }
      setTeams((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 className="font-heading text-[28px] font-semibold text-black">
        Teams
      </h1>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchTeams}
            className="mt-2 text-sm font-medium text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !error && (
        <p className="mt-6 text-center font-body text-base text-text-secondary">
          Loading teams...
        </p>
      )}

      {!loading && !error && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* New Team card */}
          <Link
            to="/teams/new"
            className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-bg-primary p-6 text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="mb-2 h-8 w-8" />
            <span className="font-body text-sm font-medium">New Team</span>
          </Link>

          {/* Team cards */}
          {teams.map((team) => (
            <div
              key={team.id}
              className="group relative flex min-h-[140px] flex-col rounded-lg border border-border bg-bg-primary p-6 transition-shadow hover:shadow-md"
            >
              <Link to={`/teams/${team.id}`} className="flex flex-1 flex-col">
                <h2 className="font-heading text-lg font-semibold text-black">
                  {team.name}
                </h2>
                {team.description && (
                  <p className="mt-1 line-clamp-2 font-body text-sm text-text-secondary">
                    {team.description}
                  </p>
                )}
                <div className="mt-auto pt-4">
                  <span className="font-body text-xs text-text-secondary">
                    {team.agentCount} {team.agentCount === 1 ? "agent" : "agents"}
                  </span>
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(team.id, team.name);
                }}
                disabled={deletingId === team.id}
                className="absolute right-3 top-3 rounded p-1 text-text-secondary opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                title="Delete team"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {teams.length === 0 && (
            <p className="col-span-full text-center font-body text-base text-text-secondary">
              No teams yet. Create your first team to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
