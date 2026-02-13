import { X, Trash2 } from "lucide-react";
import type { AgentNodeData } from "../canvas/AgentNode";
import TagList from "./TagList";
import TextList from "./TextList";

interface AgentSidebarProps {
  data: AgentNodeData;
  onChange: (data: AgentNodeData) => void;
  onClose: () => void;
  onDelete: () => void;
}

export default function AgentSidebar({
  data,
  onChange,
  onClose,
  onDelete,
}: AgentSidebarProps) {
  function handleFieldChange(field: keyof AgentNodeData, value: unknown) {
    onChange({ ...data, [field]: value });
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
            <input
              id="agent-emoji"
              type="text"
              value={data.emoji}
              onChange={(e) => handleFieldChange("emoji", e.target.value)}
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary focus:border-primary focus:outline-none"
              data-testid="agent-emoji-input"
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

          {/* Skills */}
          <TagList
            label="Skills"
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
