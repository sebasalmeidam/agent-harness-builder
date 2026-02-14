import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import type { AgentNodeData } from "../canvas/AgentNode";
import TagList from "./TagList";
import TextList from "./TextList";
import EmojiPicker from "../emoji-picker/EmojiPicker";
import { DEFAULT_EMOJIS } from "../emoji-picker/emoji-data";

interface AgentSidebarProps {
  data: AgentNodeData;
  onChange: (data: AgentNodeData) => void;
  onClose: () => void;
  onDelete: () => void;
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
}: AgentSidebarProps) {
  const [availableSkills, setAvailableSkills] = useState<SkillSummary[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

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

          {/* Tags (Free-text) */}
          <TagList
            label="Tags"
            tags={data.skills}
            onChange={(skills) => handleFieldChange("skills", skills)}
          />

          {/* Practices */}
          <TextList
            label="Practices"
            items={data.practices}
            onChange={(practices) =>
              handleFieldChange("practices", practices)
            }
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
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
