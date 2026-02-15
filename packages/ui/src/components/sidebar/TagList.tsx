import { useState, type KeyboardEvent } from "react";
import { X, HelpCircle } from "lucide-react";

interface TagListProps {
  label: string;
  hint?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagList({ label, hint, tags, onChange }: TagListProps) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const trimmed = inputValue.trim();
    if (trimmed === "") return;

    const isDuplicate = tags.some(
      (tag) => tag.toLowerCase() === trimmed.toLowerCase(),
    );
    if (isDuplicate) return;

    onChange([...tags, trimmed]);
    setInputValue("");
  }

  function handleRemove(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="font-body text-sm text-text-secondary">{label}</label>
        {hint && (
          <span className="group relative">
            <HelpCircle className="h-3.5 w-3.5 text-text-muted" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-48 -translate-x-1/2 rounded-md bg-black px-2.5 py-1.5 font-body text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {hint}
            </span>
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" data-testid="tag-list">
          {tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-secondary px-2.5 py-0.5 font-body text-xs text-text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-0.5 inline-flex items-center justify-center rounded-full text-text-secondary transition-colors hover:text-primary"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a tag and press Enter"
        className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
        data-testid="tag-input"
      />
    </div>
  );
}
