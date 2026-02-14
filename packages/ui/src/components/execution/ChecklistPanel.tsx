import { useState, useCallback } from "react";
import { Check } from "lucide-react";

export interface ChecklistItem {
  id: string;
  description: string;
  completed: boolean;
}

interface ChecklistPanelProps {
  items: ChecklistItem[];
  projectId: string;
  taskId: string;
  onUpdate?: () => void;
  readOnly?: boolean;
}

/**
 * Checklist panel for execution view.
 * Shows task checklist items with live toggle capability.
 * Items can be toggled during or after execution.
 */
export default function ChecklistPanel({
  items,
  projectId,
  taskId,
  onUpdate,
  readOnly = false,
}: ChecklistPanelProps) {
  const [localItems, setLocalItems] = useState<ChecklistItem[]>(items);
  const [saving, setSaving] = useState<string | null>(null);

  // Sync local items when props change
  if (JSON.stringify(items) !== JSON.stringify(localItems) && !saving) {
    setLocalItems(items);
  }

  const handleToggle = useCallback(
    async (itemId: string) => {
      if (readOnly || saving) return;

      setSaving(itemId);
      
      // Optimistic update
      const newItems = localItems.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );
      setLocalItems(newItems);

      try {
        const res = await fetch(
          `/api/projects/${projectId}/tasks/${taskId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checklist: newItems }),
          }
        );

        if (!res.ok) {
          // Revert on error
          setLocalItems(items);
          console.error("Failed to update checklist");
        } else {
          onUpdate?.();
        }
      } catch (err) {
        // Revert on error
        setLocalItems(items);
        console.error("Failed to update checklist:", err);
      } finally {
        setSaving(null);
      }
    },
    [localItems, items, projectId, taskId, onUpdate, readOnly, saving]
  );

  // Calculate completion percentage
  const completedCount = localItems.filter((item) => item.completed).length;
  const totalCount = localItems.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (localItems.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-primary p-4">
        <p className="font-body text-sm text-text-secondary">
          No checklist items for this task.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-primary" data-testid="checklist-panel">
      {/* Header with progress */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-body text-sm font-medium text-text-primary">
          Checklist
        </span>
        <span className="font-body text-sm text-text-secondary">
          {completedCount}/{totalCount} ({percentage}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-border">
        <div
          className="h-full bg-success transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Checklist items */}
      <ul className="divide-y divide-border">
        {localItems.map((item, index) => (
          <li
            key={item.id}
            className="flex items-start gap-3 px-4 py-3"
            data-testid={`checklist-item-${item.id}`}
          >
            {/* Checkbox */}
            <button
              type="button"
              onClick={() => handleToggle(item.id)}
              disabled={readOnly || saving === item.id}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                item.completed
                  ? "border-success bg-success text-white"
                  : "border-border-light bg-white hover:border-primary"
              } ${readOnly ? "cursor-default" : "cursor-pointer"} ${
                saving === item.id ? "opacity-50" : ""
              }`}
              aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
            >
              {item.completed && <Check className="h-3 w-3" />}
            </button>

            {/* Item text */}
            <span
              className={`font-body text-sm ${
                item.completed ? "text-text-secondary line-through" : "text-text-primary"
              }`}
            >
              {index + 1}. {item.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
