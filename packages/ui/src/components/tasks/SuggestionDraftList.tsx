import { useState } from "react";
import { Check, X, CheckCheck } from "lucide-react";

interface TaskSuggestion {
  title: string;
  description: string;
  checklist: { description: string }[];
}

interface SuggestionDraftListProps {
  projectId: string;
  suggestions: TaskSuggestion[];
  onComplete: () => void;
}

// EditableChecklistItem interface removed - was unused

export default function SuggestionDraftList({
  projectId,
  suggestions: initialSuggestions,
  onComplete,
}: SuggestionDraftListProps) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [editing, setEditing] = useState<{ [key: number]: TaskSuggestion }>({});
  const [errors, setErrors] = useState<{ [key: number]: string }>({});
  const [processing, setProcessing] = useState<{ [key: number]: boolean }>({});
  const [acceptingAll, setAcceptingAll] = useState(false);

  // Initialize editing state for each suggestion
  function getEditState(index: number): TaskSuggestion {
    return editing[index] || suggestions[index];
  }

  function updateEditState(index: number, updates: Partial<TaskSuggestion>) {
    setEditing((prev) => ({
      ...prev,
      [index]: {
        ...getEditState(index),
        ...updates,
      },
    }));
  }

  // Handle Accept: create task via API
  async function handleAccept(index: number) {
    const suggestion = getEditState(index);
    setProcessing((prev) => ({ ...prev, [index]: true }));
    setErrors((prev) => ({ ...prev, [index]: "" }));

    try {
      // Transform checklist to include id and completed fields
      const checklist = suggestion.checklist.map((item) => ({
        id: crypto.randomUUID(),
        description: item.description,
        completed: false,
      }));

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestion.title,
          description: suggestion.description,
          checklist,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create task: ${res.statusText}`);
      }

      // Remove suggestion from list
      setSuggestions((prev) => prev.filter((_, i) => i !== index));
      setEditing((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });

      // Check if all suggestions processed
      if (suggestions.length === 1) {
        onComplete();
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [index]:
          err instanceof Error ? err.message : "Failed to create task",
      }));
    } finally {
      setProcessing((prev) => ({ ...prev, [index]: false }));
    }
  }

  // Handle Reject: remove from list
  function handleReject(index: number) {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
    setEditing((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    // Check if all suggestions processed
    if (suggestions.length === 1) {
      onComplete();
    }
  }

  // Handle Accept All
  async function handleAcceptAll() {
    setAcceptingAll(true);

    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = getEditState(i);

      try {
        const checklist = suggestion.checklist.map((item) => ({
          id: crypto.randomUUID(),
          description: item.description,
          completed: false,
        }));

        const res = await fetch(`/api/projects/${projectId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: suggestion.title,
            description: suggestion.description,
            checklist,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to create task: ${res.statusText}`);
        }
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [i]: err instanceof Error ? err.message : "Failed to create task",
        }));
        setAcceptingAll(false);
        return;
      }
    }

    setAcceptingAll(false);
    setSuggestions([]);
    onComplete();
  }

  // Handle checklist item edit
  function updateChecklistItem(
    suggestionIndex: number,
    itemIndex: number,
    newDescription: string
  ) {
    const suggestion = getEditState(suggestionIndex);
    const newChecklist = [...suggestion.checklist];
    newChecklist[itemIndex] = { description: newDescription };

    updateEditState(suggestionIndex, { checklist: newChecklist });
  }

  // Add checklist item
  function addChecklistItem(suggestionIndex: number) {
    const suggestion = getEditState(suggestionIndex);
    const newChecklist = [
      ...suggestion.checklist,
      { description: "New item" },
    ];

    updateEditState(suggestionIndex, { checklist: newChecklist });
  }

  // Remove checklist item
  function removeChecklistItem(suggestionIndex: number, itemIndex: number) {
    const suggestion = getEditState(suggestionIndex);
    const newChecklist = suggestion.checklist.filter((_, i) => i !== itemIndex);

    updateEditState(suggestionIndex, { checklist: newChecklist });
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div data-testid="suggestion-draft-list">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-black">
          Task Suggestions ({suggestions.length})
        </h3>
        <button
          onClick={handleAcceptAll}
          disabled={acceptingAll}
          className="inline-flex items-center gap-2 rounded-md bg-success px-3 py-1.5 font-body text-sm font-medium text-white transition-colors hover:bg-success/90 disabled:opacity-50"
          data-testid="accept-all-button"
        >
          <CheckCheck className="h-4 w-4" />
          {acceptingAll ? "Creating..." : "Accept All"}
        </button>
      </div>

      <div className="space-y-4">
        {suggestions.map((_suggestion, index) => {
          const editState = getEditState(index);
          const error = errors[index];
          const isProcessing = processing[index];

          return (
            <div
              key={index}
              className="rounded-lg border border-border bg-bg-primary p-6"
              data-testid={`suggestion-${index}`}
            >
              {/* Title */}
              <div className="mb-3">
                <label className="mb-1 block font-body text-xs font-medium text-text-secondary">
                  Title
                </label>
                <input
                  type="text"
                  value={editState.title}
                  onChange={(e) =>
                    updateEditState(index, { title: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-white px-3 py-2 font-body text-base font-medium text-black focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  data-testid={`suggestion-title-${index}`}
                />
              </div>

              {/* Description */}
              <div className="mb-3">
                <label className="mb-1 block font-body text-xs font-medium text-text-secondary">
                  Description
                </label>
                <textarea
                  value={editState.description}
                  onChange={(e) =>
                    updateEditState(index, { description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 font-body text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  data-testid={`suggestion-description-${index}`}
                />
              </div>

              {/* Checklist */}
              <div className="mb-4">
                <label className="mb-2 block font-body text-xs font-medium text-text-secondary">
                  Checklist
                </label>
                <div className="space-y-2">
                  {editState.checklist.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className="flex items-center gap-2"
                      data-testid={`checklist-item-${index}-${itemIndex}`}
                    >
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateChecklistItem(
                            index,
                            itemIndex,
                            e.target.value
                          )
                        }
                        className="flex-1 rounded-md border border-border px-3 py-2 font-body text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        data-testid={`checklist-input-${index}-${itemIndex}`}
                      />
                      <button
                        onClick={() => removeChecklistItem(index, itemIndex)}
                        className="rounded p-2 text-text-secondary transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Remove item"
                        data-testid={`remove-checklist-${index}-${itemIndex}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addChecklistItem(index)}
                    className="font-body text-sm text-primary hover:underline"
                    data-testid={`add-checklist-item-${index}`}
                  >
                    + Add item
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div
                  className="mb-4 rounded-md border border-error bg-error-light px-4 py-3"
                  role="alert"
                  data-testid={`suggestion-error-${index}`}
                >
                  <p className="font-body text-sm text-error">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAccept(index)}
                  disabled={isProcessing || acceptingAll}
                  className="inline-flex items-center gap-2 rounded-md bg-success px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-success/90 disabled:opacity-50"
                  data-testid={`accept-button-${index}`}
                >
                  <Check className="h-4 w-4" />
                  {isProcessing ? "Creating..." : "Accept"}
                </button>
                <button
                  onClick={() => handleReject(index)}
                  disabled={isProcessing || acceptingAll}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-primary px-4 py-2 font-body text-sm font-medium text-text-secondary transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                  data-testid={`reject-button-${index}`}
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
