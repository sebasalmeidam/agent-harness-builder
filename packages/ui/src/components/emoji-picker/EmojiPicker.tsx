import { useState, useRef, useEffect } from "react";
import { EMOJI_DATA, CATEGORIES } from "./emoji-data";

export interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  defaultEmoji?: string;
}

export default function EmojiPicker({
  value,
  onChange,
  defaultEmoji = "😀",
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    (typeof CATEGORIES)[number] | "all"
  >("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  function handleEmojiSelect(emoji: string) {
    onChange(emoji);
    setIsOpen(false);
  }

  function handleTriggerClick() {
    setIsOpen(!isOpen);
  }

  // Filter emojis based on search and category
  const filteredEmojis = EMOJI_DATA.filter((entry) => {
    const matchesSearch =
      searchQuery === "" ||
      entry.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || entry.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const displayEmoji = value || defaultEmoji;

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleTriggerClick}
        className="flex h-10 w-20 items-center justify-center rounded-md border border-border bg-bg-primary text-[24px] transition-colors hover:bg-bg-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid="emoji-picker-trigger"
        aria-label="Select emoji"
        aria-expanded={isOpen}
      >
        {displayEmoji}
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-bg-primary shadow-lg"
          data-testid="emoji-picker-popover"
        >
          {/* Search Input */}
          <div className="border-b border-border p-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search emojis..."
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="emoji-search-input"
              autoFocus
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`rounded-md px-2 py-1 font-body text-xs font-medium transition-colors ${
                activeCategory === "all"
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              }`}
              data-testid="category-all"
            >
              All
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-md px-2 py-1 font-body text-xs font-medium capitalize transition-colors ${
                  activeCategory === category
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                }`}
                data-testid={`category-${category}`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Emoji Grid */}
          <div
            className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto p-3"
            data-testid="emoji-grid"
          >
            {filteredEmojis.length > 0 ? (
              filteredEmojis.map((entry) => (
                <button
                  key={entry.emoji}
                  type="button"
                  onClick={() => handleEmojiSelect(entry.emoji)}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-[20px] transition-colors hover:bg-bg-secondary"
                  title={entry.name}
                  data-testid={`emoji-${entry.emoji}`}
                >
                  {entry.emoji}
                </button>
              ))
            ) : (
              <div className="col-span-8 py-8 text-center font-body text-sm text-text-secondary">
                No emojis found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
