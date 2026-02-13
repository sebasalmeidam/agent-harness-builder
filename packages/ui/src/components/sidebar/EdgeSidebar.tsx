import { X, Trash2 } from "lucide-react";
import type { WorkflowEdgeData } from "../canvas/WorkflowEdge";

interface EdgeSidebarProps {
  data: WorkflowEdgeData;
  onChange: (data: WorkflowEdgeData) => void;
  onClose: () => void;
  onDelete: () => void;
}

const EDGE_TYPES: { value: WorkflowEdgeData["type"]; label: string }[] = [
  { value: "passes-work-to", label: "Passes work to" },
  { value: "reviews", label: "Reviews" },
  { value: "escalates-to", label: "Escalates to" },
];

const GATE_OPTIONS: {
  value: "none" | "auto" | "manual";
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "auto", label: "Auto approval" },
  { value: "manual", label: "Manual approval" },
];

export default function EdgeSidebar({
  data,
  onChange,
  onClose,
  onDelete,
}: EdgeSidebarProps) {
  function handleTypeChange(newType: WorkflowEdgeData["type"]) {
    onChange({ ...data, type: newType });
  }

  function handleFailureRoutingChange(enabled: boolean) {
    onChange({
      ...data,
      failureRouting: enabled ? "loop-back" : null,
    });
  }

  function handleGateChange(value: "none" | "auto" | "manual") {
    onChange({
      ...data,
      gate: value === "none" ? null : { type: value },
    });
  }

  function handleDeleteClick() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this edge? This action cannot be undone.",
    );
    if (confirmed) {
      onDelete();
    }
  }

  const currentGateValue: "none" | "auto" | "manual" =
    data.gate?.type ?? "none";

  return (
    <div
      className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-bg-primary"
      data-testid="edge-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-heading text-lg font-semibold text-text-primary">
          Edge Properties
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
        <div className="space-y-5">
          {/* Edge Type */}
          <fieldset>
            <legend className="mb-2 font-body text-sm text-text-secondary">
              Edge Type
            </legend>
            <div className="space-y-2">
              {EDGE_TYPES.map((edgeType) => (
                <label
                  key={edgeType.value}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="radio"
                    name="edge-type"
                    value={edgeType.value}
                    checked={data.type === edgeType.value}
                    onChange={() => handleTypeChange(edgeType.value)}
                    className="h-4 w-4 accent-primary"
                    data-testid={`edge-type-${edgeType.value}`}
                  />
                  <span className="font-body text-sm text-text-primary">
                    {edgeType.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Failure Routing */}
          <div>
            <span className="mb-2 block font-body text-sm text-text-secondary">
              Failure Routing
            </span>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={data.failureRouting === "loop-back"}
                onChange={(e) => handleFailureRoutingChange(e.target.checked)}
                className="h-4 w-4 accent-primary"
                data-testid="failure-routing-toggle"
              />
              <span className="font-body text-sm text-text-primary">
                Loop back on failure
              </span>
            </label>
          </div>

          {/* Gate Configuration */}
          <div>
            <label
              htmlFor="gate-select"
              className="mb-2 block font-body text-sm text-text-secondary"
            >
              Gate
            </label>
            <select
              id="gate-select"
              value={currentGateValue}
              onChange={(e) =>
                handleGateChange(
                  e.target.value as "none" | "auto" | "manual",
                )
              }
              className="w-full rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary focus:border-primary focus:outline-none"
              data-testid="gate-select"
            >
              {GATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={handleDeleteClick}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-bg-primary px-3 py-2 font-body text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          data-testid="delete-edge-button"
        >
          <Trash2 className="h-4 w-4" />
          Delete Edge
        </button>
      </div>
    </div>
  );
}
