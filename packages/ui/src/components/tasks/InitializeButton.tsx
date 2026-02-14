import { useState } from "react";
import { Sparkles } from "lucide-react";

interface TaskSuggestion {
  title: string;
  description: string;
  checklist: { description: string }[];
}

interface InitializeButtonProps {
  projectId: string;
  taskCount: number;
  onSuggestionsReceived: (suggestions: TaskSuggestion[]) => void;
}

export default function InitializeButton({
  projectId,
  taskCount,
  onSuggestionsReceived,
}: InitializeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show button when task count is 0
  if (taskCount > 0) {
    return null;
  }

  async function handleInitialize() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/initialize`, {
        method: "POST",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const data = await res.json();
          throw new Error(data.error || "Failed to initialize project");
        } else if (res.status === 504) {
          throw new Error("Request timeout - please try again");
        } else {
          throw new Error(`Failed to initialize project: ${res.statusText}`);
        }
      }

      const data = await res.json();
      onSuggestionsReceived(data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6">
      <button
        onClick={handleInitialize}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        data-testid="initialize-button"
      >
        <Sparkles className="h-4 w-4" />
        {loading ? "Analyzing project..." : "Initialize Project"}
      </button>

      {error && (
        <div
          className="mt-3 rounded-md border border-error bg-error-light px-4 py-3"
          role="alert"
          data-testid="initialize-error"
        >
          <p className="font-body text-sm text-error">{error}</p>
        </div>
      )}
    </div>
  );
}
