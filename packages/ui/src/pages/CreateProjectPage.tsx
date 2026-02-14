import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import ErrorCard from "../components/ErrorCard";
import EmojiPicker from "../components/emoji-picker/EmojiPicker";
import { DEFAULT_EMOJIS } from "../components/emoji-picker/emoji-data";

// Slugify function - same as server-side
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [path, setPath] = useState("");
  const [emoji, setEmoji] = useState(DEFAULT_EMOJIS.project);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [defaultProjectsPath, setDefaultProjectsPath] = useState("");
  const [autoFillPath, setAutoFillPath] = useState(true);

  // Fetch default projects path on mount
  useEffect(() => {
    async function fetchDefaultPath() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setDefaultProjectsPath(data.defaultProjectsPath || "");
        }
      } catch (err) {
        console.error("Failed to fetch default projects path:", err);
      }
    }
    fetchDefaultPath();
  }, []);

  // Auto-fill path when name changes
  useEffect(() => {
    if (autoFillPath && name.trim() && defaultProjectsPath) {
      const slug = slugify(name);
      if (slug) {
        setPath(`${defaultProjectsPath}/${slug}`);
      }
    }
  }, [name, defaultProjectsPath, autoFillPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name is required");
      return;
    }

    const trimmedPath = path.trim();
    if (!trimmedPath) {
      setError("Project path is required");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        name: trimmedName,
        description: description.trim(),
        emoji: emoji,
        path: trimmedPath,
      };

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error ?? `Failed to create project: ${res.statusText}`,
        );
      }

      const project = await res.json();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create project",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-heading text-[28px] font-semibold text-black">
        Create Project
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <ErrorCard message={error} />
        )}

        <div>
          <label
            htmlFor="project-emoji"
            className="block font-body text-sm font-medium text-black"
          >
            Emoji
          </label>
          <div className="mt-1">
            <EmojiPicker
              id="project-emoji"
              value={emoji}
              onChange={setEmoji}
              defaultEmoji={DEFAULT_EMOJIS.project}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="project-name"
            className="block font-body text-sm font-medium text-black"
          >
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Web Application"
            className="mt-1 block w-full rounded-md border border-border bg-bg-primary px-3 py-2 font-body text-sm text-black placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="project-description"
            className="block font-body text-sm font-medium text-black"
          >
            Description
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this project is about..."
            rows={3}
            className="mt-1 block w-full rounded-md border border-border bg-bg-primary px-3 py-2 font-body text-sm text-black placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label
            htmlFor="project-path"
            className="block font-body text-sm font-medium text-black"
          >
            Project Path <span className="text-red-500">*</span>
          </label>
          <input
            id="project-path"
            type="text"
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setAutoFillPath(false); // Disable auto-fill when user manually edits
            }}
            placeholder="/home/user/projects/my-app"
            className="mt-1 block w-full rounded-md border border-border bg-bg-primary px-3 py-2 font-body text-sm font-mono text-black placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1 font-body text-xs text-text-secondary">
            Absolute path to the local project directory. Will be created automatically if it doesn't exist.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
          <Link
            to="/projects"
            className="font-body text-sm text-text-secondary hover:text-black"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
