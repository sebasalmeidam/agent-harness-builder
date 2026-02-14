import { useState } from "react";
import { Plus, X, Check } from "lucide-react";

export interface ChecklistItem {
  id: string;
  description: string;
  completed: boolean;
}

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  disabled?: boolean;
}

export default function ChecklistEditor({
  items,
  onChange,
  disabled = false,
}: ChecklistEditorProps) {
  const [newItemDescription, setNewItemDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Toggle completed state
  function handleToggle(id: string) {
    if (disabled) return;
    const updated = items.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item,
    );
    onChange(updated);
  }

  // Remove item
  function handleRemove(id: string) {
    if (disabled) return;
    const updated = items.filter((item) => item.id !== id);
    onChange(updated);
  }

  // Start editing an item
  function handleStartEdit(id: string, currentDescription: string) {
    if (disabled) return;
    setEditingId(id);
    setEditText(currentDescription);
  }

  // Save edited description
  function handleSaveEdit(id: string) {
    if (disabled) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      // Empty description, cancel edit
      setEditingId(null);
      setEditText("");
      return;
    }

    const updated = items.map((item) =>
      item.id === id ? { ...item, description: trimmed } : item,
    );
    onChange(updated);
    setEditingId(null);
    setEditText("");
  }

  // Cancel editing
  function handleCancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  // Add new item
  function handleAddItem() {
    if (disabled) return;
    const trimmed = newItemDescription.trim();
    if (!trimmed) return;

    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      description: trimmed,
      completed: false,
    };

    onChange([...items, newItem]);
    setNewItemDescription("");
  }

  return (
    <div>
      {/* Existing items */}
      <div className="space-y-2 mb-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 group"
            data-testid={`checklist-item-${item.id}`}
          >
            {/* Checkbox */}
            <button
              onClick={() => handleToggle(item.id)}
              disabled={disabled}
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                item.completed
                  ? "border-success bg-success text-white"
                  : "border-border bg-white"
              } disabled:opacity-50`}
              data-testid={`toggle-${item.id}`}
              aria-label={`Toggle ${item.description}`}
            >
              {item.completed && <Check className="h-3 w-3" />}
            </button>

            {/* Description - editable or display */}
            {editingId === item.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveEdit(item.id);
                    } else if (e.key === "Escape") {
                      handleCancelEdit();
                    }
                  }}
                  onBlur={() => handleSaveEdit(item.id)}
                  className="flex-1 rounded-md border border-primary px-2 py-1 font-body text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                  data-testid={`edit-input-${item.id}`}
                />
              </div>
            ) : (
              <span
                onClick={() => handleStartEdit(item.id, item.description)}
                className={`flex-1 cursor-text font-body text-sm ${
                  item.completed
                    ? "text-text-secondary line-through"
                    : "text-text-primary"
                } ${disabled ? "cursor-default" : ""}`}
                data-testid={`description-${item.id}`}
              >
                {item.description}
              </span>
            )}

            {/* Remove button */}
            <button
              onClick={() => handleRemove(item.id)}
              disabled={disabled}
              className="opacity-0 group-hover:opacity-100 rounded p-1 text-text-secondary transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-0"
              title="Remove item"
              data-testid={`remove-${item.id}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <p className="mb-3 font-body text-sm text-text-secondary italic">
          No checklist items yet.
        </p>
      )}

      {/* Add item input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newItemDescription}
          onChange={(e) => setNewItemDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAddItem();
            }
          }}
          placeholder="Add a checklist item..."
          disabled={disabled}
          className="flex-1 rounded-md border border-border px-3 py-2 font-body text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-bg-secondary disabled:opacity-50"
          data-testid="new-item-input"
        />
        <button
          onClick={handleAddItem}
          disabled={!newItemDescription.trim() || disabled}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          data-testid="add-item-button"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}
