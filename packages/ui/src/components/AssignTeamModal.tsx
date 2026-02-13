import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface TeamSummary {
  id: string;
  name: string;
  description: string;
  agentCount: number;
}

interface AssignTeamModalProps {
  projectId: string;
  currentTeamId: string | null;
  onAssigned: (teamId: string) => void;
  onClose: () => void;
}

export default function AssignTeamModal({
  projectId,
  currentTeamId,
  onAssigned,
  onClose,
}: AssignTeamModalProps) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    currentTeamId,
  );
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
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
        setError(
          err instanceof Error ? err.message : "Failed to load teams",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  async function handleAssign() {
    if (!selectedTeamId) return;

    setAssigning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeamId }),
      });

      if (!res.ok) {
        throw new Error(`Failed to assign team: ${res.statusText}`);
      }

      onAssigned(selectedTeamId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to assign team",
      );
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="assign-team-modal"
    >
      <div className="w-full max-w-md rounded-lg bg-bg-primary p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-black">
            Assign Team
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-black"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <p className="py-8 text-center font-body text-sm text-text-secondary">
            Loading teams...
          </p>
        )}

        {/* Empty state */}
        {!loading && !error && teams.length === 0 && (
          <p className="py-8 text-center font-body text-sm text-text-secondary">
            No teams available. Create a team first.
          </p>
        )}

        {/* Team list */}
        {!loading && teams.length > 0 && (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {teams.map((team) => (
              <label
                key={team.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                  selectedTeamId === team.id
                    ? "border-primary bg-primary-light"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="team"
                  value={team.id}
                  checked={selectedTeamId === team.id}
                  onChange={() => setSelectedTeamId(team.id)}
                  className="h-4 w-4 text-primary accent-primary"
                />
                <div className="flex-1">
                  <p className="font-body text-sm font-medium text-black">
                    {team.name}
                  </p>
                  <p className="font-body text-xs text-text-secondary">
                    {team.agentCount}{" "}
                    {team.agentCount === 1 ? "agent" : "agents"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 font-body text-sm text-text-secondary transition-colors hover:text-black"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedTeamId || assigning || loading}
            className="rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {assigning ? "Assigning..." : "Assign Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
