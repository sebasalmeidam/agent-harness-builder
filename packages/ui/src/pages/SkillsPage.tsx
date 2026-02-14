import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, X, Sparkles, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import ErrorCard from "../components/ErrorCard";

interface SkillSummary {
  id: string;
  name: string;
  description: string;
}

interface Skill extends SkillSummary {
  instructions: string;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    instructions: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  async function fetchSkills() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) {
        throw new Error(`Failed to fetch skills: ${res.statusText}`);
      }
      const data: SkillSummary[] = await res.json();
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSkills();
    
    // Check if API key is configured
    async function checkApiKey() {
      try {
        const res = await fetch("/api/settings/status");
        if (res.ok) {
          const data = await res.json();
          setHasApiKey(data.hasApiKey);
        }
      } catch {
        setHasApiKey(false);
      }
    }
    checkApiKey();
  }, []);

  async function handleDelete(id: string, name: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"? This skill will be removed from all agents that use it. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/skills/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Failed to delete skill: ${res.statusText}`);
      }
      setSkills((prev) => prev.filter((s) => s.id !== id));
      if (editingSkill?.id === id) {
        setEditingSkill(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete skill");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleEditClick(id: string) {
    try {
      const res = await fetch(`/api/skills/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch skill: ${res.statusText}`);
      }
      const skill: Skill = await res.json();
      setEditingSkill(skill);
      setFormData({
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
      });
      setShowCreateForm(false);
      setFormError(null);
      setShowInstructions(!!skill.instructions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skill");
    }
  }

  function handleCreateClick() {
    setShowCreateForm(true);
    setEditingSkill(null);
    setFormData({ name: "", description: "", instructions: "" });
    setFormError(null);
    setShowInstructions(false);
  }

  async function handleGenerate() {
    if (!formData.name.trim() || !formData.description.trim()) {
      setFormError("Name and description are required to generate instructions");
      return;
    }

    setGenerating(true);
    setFormError(null);

    try {
      const res = await fetch("/api/generate/skill-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to generate instructions");
      }

      const data = await res.json();
      setFormData((prev) => ({ ...prev, instructions: data.instructions }));
      setShowInstructions(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to generate instructions");
    } finally {
      setGenerating(false);
    }
  }

  function handleCancelForm() {
    setShowCreateForm(false);
    setEditingSkill(null);
    setFormData({ name: "", description: "", instructions: "" });
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const isEdit = !!editingSkill;
      const url = isEdit ? `/api/skills/${editingSkill.id}` : "/api/skills";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.status === 409) {
        setFormError("A skill with this name already exists");
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFormError(data?.error ?? "Failed to save skill");
        setSubmitting(false);
        return;
      }

      const skill: Skill = await res.json();

      if (isEdit) {
        setSkills((prev) =>
          prev.map((s) =>
            s.id === skill.id
              ? { id: skill.id, name: skill.name, description: skill.description }
              : s
          )
        );
      } else {
        setSkills((prev) => [
          ...prev,
          { id: skill.id, name: skill.name, description: skill.description },
        ]);
      }

      handleCancelForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setSubmitting(false);
    }
  }

  const showForm = showCreateForm || editingSkill;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-[28px] font-semibold text-black">
          Skills
        </h1>
        {!showForm && (
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            Create Skill
          </button>
        )}
      </div>

      {error && (
        <ErrorCard message={error} onRetry={fetchSkills} className="mb-4" />
      )}

      {showForm && (
        <div className="mb-6 rounded-lg border border-border bg-bg-primary p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-black">
              {editingSkill ? "Edit Skill" : "Create Skill"}
            </h2>
            <button
              onClick={handleCancelForm}
              className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {formError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="font-body text-sm text-red-800">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="skill-name"
                className="mb-1 block font-body text-sm font-medium text-text-primary"
              >
                Name
              </label>
              <input
                id="skill-name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                className="w-full rounded-md border border-border bg-white px-3 py-2 font-body text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
                placeholder="e.g., TypeScript Expert"
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="skill-description"
                className="mb-1 block font-body text-sm font-medium text-text-primary"
              >
                Description
              </label>
              <input
                id="skill-description"
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                required
                className="w-full rounded-md border border-border bg-white px-3 py-2 font-body text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
                placeholder="Brief description of this skill"
              />
            </div>

            {/* Instructions section with Generate button */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="flex items-center gap-1 font-body text-sm font-medium text-text-primary hover:text-primary"
                >
                  {showInstructions ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Instructions
                  {formData.instructions && (
                    <span className="ml-1 text-xs text-text-secondary">
                      ({formData.instructions.split("\n").length} lines)
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || hasApiKey === false}
                  title={hasApiKey === false ? "Set API key in Settings" : "Generate instructions with AI"}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 font-body text-sm font-medium text-text-primary transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-text-primary"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>
              {showInstructions && (
                <textarea
                  id="skill-instructions"
                  value={formData.instructions}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      instructions: e.target.value,
                    }))
                  }
                  required
                  rows={12}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 font-body text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light"
                  placeholder="Detailed instructions that will be injected into agent prompts..."
                />
              )}
              {!showInstructions && !formData.instructions && (
                <p className="text-sm text-text-secondary">
                  Click "Generate" to create instructions from the name and description, or expand to write manually.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting
                  ? "Saving..."
                  : editingSkill
                    ? "Save Changes"
                    : "Create Skill"}
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                disabled={submitting}
                className="rounded-lg border border-border bg-white px-4 py-2 font-body text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && !error && (
        <p className="mt-6 text-center font-body text-base text-text-secondary">
          Loading skills...
        </p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="group relative flex min-h-[140px] flex-col rounded-lg border border-border bg-bg-primary p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex flex-1 flex-col">
                <h2 className="font-heading text-lg font-semibold text-black">
                  {skill.name}
                </h2>
                <p className="mt-1 line-clamp-2 font-body text-sm text-text-secondary">
                  {skill.description}
                </p>
              </div>
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => handleEditClick(skill.id)}
                  className="rounded p-1 text-text-secondary transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title="Edit skill"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(skill.id, skill.name);
                  }}
                  disabled={deletingId === skill.id}
                  className="rounded p-1 text-text-secondary transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Delete skill"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {skills.length === 0 && (
            <p className="col-span-full text-center font-body text-base text-text-secondary">
              No skills yet. Create your first skill to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
