import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface TeamSummary {
  id: string;
  name: string;
  description: string;
  agentCount: number;
  agentEmojis: string[];
}

interface TeamSelectorProps {
  teamId: string | null;
  onChange: (teamId: string | null) => void;
  disabled?: boolean;
}

export default function TeamSelector({
  teamId,
  onChange,
  disabled = false,
}: TeamSelectorProps) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : "Failed to load teams");
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  function handleClearSelection() {
    if (disabled) return;
    onChange(null);
  }

  if (loading) {
    return (
      <div className="text-sm text-text-secondary font-body">
        Loading teams...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 font-body" data-testid="team-selector-error">
        {error}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={teamId || ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className="flex-1 rounded-md border border-border bg-white px-3 py-2 font-body text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-bg-secondary disabled:opacity-50"
        data-testid="team-selector"
      >
        <option value="">No team assigned</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>

      {teamId && !disabled && (
        <button
          onClick={handleClearSelection}
          className="rounded p-2 text-text-secondary transition-colors hover:bg-red-50 hover:text-red-600"
          title="Clear team assignment"
          data-testid="clear-team-button"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
