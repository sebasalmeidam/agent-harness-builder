import { render, screen } from "@testing-library/react";
import { test, expect, vi } from "vitest";
import { ReactFlowProvider, Position } from "@xyflow/react";
import WorkflowEdge from "./WorkflowEdge";

// Mock ResizeObserver which React Flow requires
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock DOMMatrixReadOnly which React Flow requires for transforms
class DOMMatrixReadOnlyMock {
  m22: number;
  constructor() {
    this.m22 = 1;
  }
  inverse() {
    return new DOMMatrixReadOnlyMock();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).DOMMatrixReadOnly = DOMMatrixReadOnlyMock;

// Mock getBezierPath and EdgeLabelRenderer for testing
// EdgeLabelRenderer uses a portal that requires a full ReactFlow canvas,
// so we replace it with a simple div wrapper to render children directly.
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react");
  return {
    ...actual,
    getBezierPath: () => ["M 0 0 L 100 100", 50, 50],
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});

const baseProps = {
  id: "edge-1",
  source: "agent-1",
  target: "agent-2",
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  markerEnd: "url(#arrow)",
  selected: false,
  animated: false,
  selectable: true,
  deletable: true,
};

function renderWorkflowEdge(
  dataOverrides: Record<string, unknown> = {},
  propsOverrides: Record<string, unknown> = {},
) {
  const data = {
    type: "passes-work-to" as const,
    failureRouting: null,
    gate: null,
    ...dataOverrides,
  };

  return render(
    <ReactFlowProvider>
      <svg>
        <WorkflowEdge {...baseProps} {...propsOverrides} data={data} />
      </svg>
    </ReactFlowProvider>,
  );
}

test("renders edge label with default type", () => {
  renderWorkflowEdge();

  expect(screen.getByText("passes work to")).toBeTruthy();
});

test("renders label for reviews type", () => {
  renderWorkflowEdge({ type: "reviews" });

  expect(screen.getByText("reviews")).toBeTruthy();
});

test("renders label for escalates-to type", () => {
  renderWorkflowEdge({ type: "escalates-to" });

  expect(screen.getByText("escalates to")).toBeTruthy();
});

test("does not render gate indicator when gate is null", () => {
  renderWorkflowEdge({ gate: null });

  expect(screen.queryByTestId("gate-indicator-edge-1")).toBeNull();
});

test("renders green auto gate indicator", () => {
  renderWorkflowEdge({ gate: { type: "auto" } });

  const indicator = screen.getByTestId("gate-indicator-edge-1");
  expect(indicator).toBeTruthy();
  expect(indicator.textContent).toBe("A");
  expect(indicator.style.backgroundColor).toBe("rgb(74, 157, 110)");
});

test("renders orange manual gate indicator", () => {
  renderWorkflowEdge({ gate: { type: "manual" } });

  const indicator = screen.getByTestId("gate-indicator-edge-1");
  expect(indicator).toBeTruthy();
  expect(indicator.textContent).toBe("M");
  expect(indicator.style.backgroundColor).toBe("rgb(212, 168, 68)");
});

test("renders edge label with test id", () => {
  renderWorkflowEdge();

  expect(screen.getByTestId("edge-label-edge-1")).toBeTruthy();
});

test("renders selected edge with primary color border on label", () => {
  renderWorkflowEdge({}, { selected: true });

  const label = screen.getByText("passes work to");
  expect(label.style.border).toContain("rgb(217, 98, 72)");
});
