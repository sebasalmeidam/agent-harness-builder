import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";

export interface WorkflowEdgeData {
  type: "passes-work-to" | "reviews" | "escalates-to";
  failureRouting: "loop-back" | null;
  gate: { type: "auto" | "manual" } | null;
  [key: string]: unknown;
}

type WorkflowEdgeType = Edge<WorkflowEdgeData, "workflow">;

const EDGE_TYPE_LABELS: Record<string, string> = {
  "passes-work-to": "passes work to",
  reviews: "reviews",
  "escalates-to": "escalates to",
};

export default function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps<WorkflowEdgeType>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeType = data?.type ?? "passes-work-to";
  const label = EDGE_TYPE_LABELS[edgeType] ?? edgeType;
  const gate = data?.gate ?? null;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? "#D96248" : "#888A8C",
          strokeWidth: selected ? 2 : 1.5,
        }}
        interactionWidth={20}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          data-testid={`edge-label-${id}`}
        >
          <div className="flex items-center gap-1.5">
            {/* Gate indicator */}
            {gate && (
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold text-white"
                style={{
                  backgroundColor:
                    gate.type === "auto" ? "#4A9D6E" : "#D4A844",
                }}
                data-testid={`gate-indicator-${id}`}
                title={
                  gate.type === "auto"
                    ? "Auto approval gate"
                    : "Manual approval gate"
                }
              >
                {gate.type === "auto" ? "A" : "M"}
              </span>
            )}
            {/* Edge type label */}
            <span
              className="rounded-sm bg-bg-primary px-1.5 py-0.5 font-body text-xs text-text-secondary shadow-sm"
              style={{
                border: selected ? "1px solid #D96248" : "1px solid #E5E5E7",
              }}
            >
              {label}
            </span>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
