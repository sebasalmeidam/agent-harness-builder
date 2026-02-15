import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TextListProps {
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
}

export default function TextList({ label, hint, items, onChange }: TextListProps) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const trimmed = inputValue.trim();
    if (trimmed === "") return;

    onChange([...items, trimmed]);
    setInputValue("");
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="mb-0.5 block font-body text-sm text-text-secondary">
        {label}
      </label>
      {hint && (
        <p className="mb-1.5 font-body text-xs text-text-muted">{hint}</p>
      )}

      {items.length > 0 && (
        <ul className="mb-2 space-y-1" data-testid="text-list">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-center justify-between rounded-md border border-border bg-bg-secondary px-3 py-1.5 font-body text-sm text-text-primary"
            >
              <span className="mr-2 min-w-0 break-words">{item}</span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="shrink-0 text-text-secondary transition-colors hover:text-primary"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add an item and press Enter"
        className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
        data-testid="text-list-input"
      />
    </div>
  );
}
