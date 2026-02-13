import { render, screen } from "@testing-library/react";
import { test, expect, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import AgentNode from "./AgentNode";

// Mock the Handle component to avoid React Flow DOM measurement requirements
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react");
  return {
    ...actual,
    Handle: ({ type, position }: { type: string; position: string }) => (
      <div data-testid={`handle-${type}`} data-position={position} />
    ),
  };
});

function renderAgentNode(data: {
  name: string;
  emoji: string;
  role: string;
  goal?: string;
  skills?: string[];
  practices?: string[];
}) {
  const defaultData = {
    goal: "",
    skills: [],
    practices: [],
    ...data,
  };

  const props = {
    id: "test-node",
    data: defaultData,
    type: "agent" as const,
    selected: false,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    dragHandle: undefined,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
    width: 200,
    height: 60,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return render(
    <ReactFlowProvider>
      <AgentNode {...props} />
    </ReactFlowProvider>,
  );
}

test("renders agent name and emoji", () => {
  renderAgentNode({ name: "Architect", emoji: "\uD83D\uDC68\u200D\uD83D\uDCBB", role: "Lead" });

  expect(screen.getByText("Architect")).toBeTruthy();
  expect(screen.getByText("\uD83D\uDC68\u200D\uD83D\uDCBB")).toBeTruthy();
});

test("renders role label when provided", () => {
  renderAgentNode({ name: "Dev", emoji: "\uD83E\uDD16", role: "Backend Developer" });

  expect(screen.getByText("Backend Developer")).toBeTruthy();
});

test("does not render role label when empty", () => {
  renderAgentNode({ name: "Dev", emoji: "\uD83E\uDD16", role: "" });

  expect(screen.queryByText("Backend Developer")).toBeNull();
});

test("renders source and target handles", () => {
  renderAgentNode({ name: "Dev", emoji: "\uD83E\uDD16", role: "Dev" });

  expect(screen.getByTestId("handle-source")).toBeTruthy();
  expect(screen.getByTestId("handle-target")).toBeTruthy();
});

test("has agent-node test id for targeting", () => {
  renderAgentNode({ name: "Dev", emoji: "\uD83E\uDD16", role: "Dev" });

  expect(screen.getByTestId("agent-node")).toBeTruthy();
});
