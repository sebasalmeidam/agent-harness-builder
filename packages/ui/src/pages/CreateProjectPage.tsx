import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name is required");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        name: trimmedName,
        description: description.trim(),
      };
      const trimmedGitUrl = gitUrl.trim();
      if (trimmedGitUrl) {
        body.gitUrl = trimmedGitUrl;
      }

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
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

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
            htmlFor="project-git-url"
            className="block font-body text-sm font-medium text-black"
          >
            Git Repository URL
          </label>
          <input
            id="project-git-url"
            type="text"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder="https://github.com/user/repo (optional)"
            className="mt-1 block w-full rounded-md border border-border bg-bg-primary px-3 py-2 font-body text-sm text-black placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
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
