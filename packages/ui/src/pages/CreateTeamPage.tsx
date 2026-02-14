import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import ErrorCard from "../components/ErrorCard";
import EmojiPicker from "../components/emoji-picker/EmojiPicker";
import { DEFAULT_EMOJIS } from "../components/emoji-picker/emoji-data";

export default function CreateTeamPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState(DEFAULT_EMOJIS.team);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNameError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Team name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, description: description.trim(), emoji }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Failed to create team: ${res.statusText}`);
      }

      const team = await res.json();
      navigate(`/teams/${team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-heading text-[28px] font-semibold text-black">
        Create Team
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <ErrorCard message={error} />
        )}

        <div>
          <label
            htmlFor="team-emoji"
            className="block font-body text-sm font-medium text-black"
          >
            Emoji
          </label>
          <div className="mt-1">
            <EmojiPicker
              id="team-emoji"
              value={emoji}
              onChange={setEmoji}
              defaultEmoji={DEFAULT_EMOJIS.team}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="team-name"
            className="block font-body text-sm font-medium text-black"
          >
            Team Name <span className="text-red-500">*</span>
          </label>
          <input
            id="team-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) {
                setNameError(null);
              }
            }}
            placeholder="e.g. Full Stack Dev Team"
            className={`mt-1 block w-full rounded-md border bg-bg-primary px-3 py-2 font-body text-sm text-black placeholder:text-text-secondary focus:outline-none focus:ring-1 ${
              nameError
                ? "border-error focus:border-error focus:ring-error"
                : "border-border focus:border-primary focus:ring-primary"
            }`}
            autoFocus
          />
          {nameError && (
            <p className="mt-1 font-body text-sm text-error">{nameError}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="team-description"
            className="block font-body text-sm font-medium text-black"
          >
            Description
          </label>
          <textarea
            id="team-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this team does..."
            rows={3}
            className="mt-1 block w-full rounded-md border border-border bg-bg-primary px-3 py-2 font-body text-sm text-black placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Team"}
          </button>
          <Link
            to="/teams"
            className="font-body text-sm text-text-secondary hover:text-black"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
