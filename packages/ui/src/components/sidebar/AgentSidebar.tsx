import { useEffect, useState } from "react";
import { X, Trash2, Save } from "lucide-react";
import type { AgentNodeData } from "../canvas/AgentNode";
import TagList from "./TagList";
import TextList from "./TextList";
import EmojiPicker from "../emoji-picker/EmojiPicker";
import { DEFAULT_EMOJIS } from "../emoji-picker/emoji-data";

// Predefined model options
const PREDEFINED_MODELS = [
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet" },
  { id: "claude-opus-4-20250514", label: "Opus" },
  { id: "claude-haiku-3-5-20241022", label: "Haiku" },
] as const;

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

interface AgentSidebarProps {
  data: AgentNodeData;
  onChange: (data: AgentNodeData) => void;
  onClose: () => void;
  onDelete: () => void;
  onSave?: () => void;
  isDirty?: boolean;
}

interface SkillSummary {
  id: string;
  name: string;
  description: string;
}

export default function AgentSidebar({
  data,
  onChange,
  onClose,
  onDelete,
  onSave,
  isDirty,
}: AgentSidebarProps) {
  const [availableSkills, setAvailableSkills] = useState<SkillSummary[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);

  useEffect(() => {
    async function fetchSkills() {
      setLoadingSkills(true);
      try {
        const res = await fetch("/api/skills");
        if (res.ok) {
          const skills: SkillSummary[] = await res.json();
          setAvailableSkills(skills);
        }
      } catch {
        // Silently fail - skills will just be empty
      } finally {
        setLoadingSkills(false);
      }
    }

    fetchSkills();
  }, []);

  // Determine current model value and custom mode state
  const currentModel = data.model ?? DEFAULT_MODEL;
  const isPredefinedModel = PREDEFINED_MODELS.some(m => m.id === currentModel);

  useEffect(() => {
    // If model is not a predefined value, enable custom mode
    if (!isPredefinedModel && currentModel !== DEFAULT_MODEL) {
      setCustomModelMode(true);
    }
  }, [currentModel, isPredefinedModel]);

  function handleFieldChange(field: keyof AgentNodeData, value: unknown) {
    onChange({ ...data, [field]: value });
  }

  function handleSkillToggle(skillId: string) {
    const currentSkillIds = data.skillIds ?? [];
    const newSkillIds = currentSkillIds.includes(skillId)
      ? currentSkillIds.filter((id) => id !== skillId)
      : [...currentSkillIds, skillId];
    handleFieldChange("skillIds", newSkillIds);
  }

  function handleDeleteClick() {
    const confirmed = window.confirm(
      `Are you sure you want to delete the agent "${data.name}"? This action cannot be undone.`,
    );
    if (confirmed) {
      onDelete();
    }
  }

  function handleModelDropdownChange(value: string) {
    if (value === "custom") {
      setCustomModelMode(true);
      // Keep the current model value when switching to custom mode
    } else {
      setCustomModelMode(false);
      handleFieldChange("model", value);
    }
  }

  function handleCustomModelChange(value: string) {
    if (value.trim() === "") {
      // Clearing custom input reverts to default
      handleFieldChange("model", DEFAULT_MODEL);
      setCustomModelMode(false);
    } else {
      handleFieldChange("model", value);
    }
  }

  function handleBackToDropdown() {
    setCustomModelMode(false);
    // If current model is not predefined, revert to default
    if (!isPredefinedModel) {
      handleFieldChange("model", DEFAULT_MODEL);
    }
  }

  return (
    <div
      className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-bg-primary"
      data-testid="agent-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-heading text-lg font-semibold text-text-primary">
          Agent Properties
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
          aria-label="Close sidebar"
          data-testid="close-sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="agent-name"
              className="mb-1 block font-body text-sm text-text-secondary"
            >
              Name
            </label>
            <input
              id="agent-name"
              type="text"
              value={data.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary focus:border-primary focus:outline-none"
              data-testid="agent-name-input"
            />
          </div>

          {/* Emoji */}
          <div>
            <label
              htmlFor="agent-emoji"
              className="mb-1 block font-body text-sm text-text-secondary"
            >
              Emoji
            </label>
            <EmojiPicker
              id="agent-emoji"
              value={data.emoji}
              onChange={(emoji) => handleFieldChange("emoji", emoji)}
              defaultEmoji={DEFAULT_EMOJIS.agent}
            />
          </div>

          {/* Role */}
          <div>
            <label
              htmlFor="agent-role"
              className="mb-1 block font-body text-sm text-text-secondary"
            >
              Role
            </label>
            <input
              id="agent-role"
              type="text"
              value={data.role}
              onChange={(e) => handleFieldChange("role", e.target.value)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary focus:border-primary focus:outline-none"
              data-testid="agent-role-input"
            />
          </div>

          {/* Goal */}
          <div>
            <label
              htmlFor="agent-goal"
              className="mb-1 block font-body text-sm text-text-secondary"
            >
              Goal
            </label>
            <textarea
              id="agent-goal"
              value={data.goal}
              onChange={(e) => handleFieldChange("goal", e.target.value)}
              rows={3}
              className="w-full resize-y rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary focus:border-primary focus:outline-none"
              data-testid="agent-goal-input"
            />
          </div>

          {/* Model */}
          <div>
            <label
              htmlFor="agent-model"
              className="mb-1 block font-body text-sm text-text-secondary"
            >
              Model
            </label>
            {!customModelMode ? (
              <div className="space-y-2">
                <select
                  id="agent-model"
                  value={isPredefinedModel ? currentModel : "custom"}
                  onChange={(e) => handleModelDropdownChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary focus:border-primary focus:outline-none"
                  data-testid="agent-model-select"
                >
                  {PREDEFINED_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  id="agent-model"
                  type="text"
                  value={currentModel}
                  onChange={(e) => handleCustomModelChange(e.target.value)}
                  placeholder="Enter custom model string"
                  className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary focus:border-primary focus:outline-none"
                  data-testid="agent-model-custom-input"
                />
                <button
                  type="button"
                  onClick={handleBackToDropdown}
                  className="font-body text-xs text-primary hover:underline"
                  data-testid="agent-model-back-to-dropdown"
                >
                  Back to predefined models
                </button>
              </div>
            )}
          </div>

          {/* Skills (Entity) */}
          <div>
            <label className="mb-1 block font-body text-sm text-text-secondary">
              Skills
            </label>
            {loadingSkills ? (
              <p className="font-body text-xs text-text-secondary">
                Loading skills...
              </p>
            ) : availableSkills.length === 0 ? (
              <p className="font-body text-xs text-text-secondary">
                No skills available. Create skills in the Skills page.
              </p>
            ) : (
              <div className="space-y-2 rounded-md border border-border bg-bg-primary px-3 py-2">
                {availableSkills.map((skill) => {
                  const isChecked = (data.skillIds ?? []).includes(skill.id);
                  return (
                    <label
                      key={skill.id}
                      className="flex items-start gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleSkillToggle(skill.id)}
                        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        data-testid={`skill-checkbox-${skill.id}`}
                      />
                      <div className="flex-1">
                        <div className="font-body text-sm text-text-primary">
                          {skill.name}
                        </div>
                        {skill.description && (
                          <div className="font-body text-xs text-text-secondary">
                            {skill.description}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expertise */}
          <TagList
            label="Expertise"
            hint="Areas of knowledge: React, Python, Excel, UX design, testing, DevOps..."
            tags={data.skills}
            onChange={(skills) => handleFieldChange("skills", skills)}
          />

          {/* Practices */}
          <TextList
            label="Practices"
            hint="Rules and standards to follow (e.g., Write tests for every function)"
            items={data.practices}
            onChange={(practices) =>
              handleFieldChange("practices", practices)
            }
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 space-y-2">
        {onSave && isDirty && (
          <button
            type="button"
            onClick={onSave}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        )}
        <button
          type="button"
          onClick={handleDeleteClick}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-bg-primary px-3 py-2 font-body text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          data-testid="delete-agent-button"
        >
          <Trash2 className="h-4 w-4" />
          Delete Agent
        </button>
      </div>
    </div>
  );
}
