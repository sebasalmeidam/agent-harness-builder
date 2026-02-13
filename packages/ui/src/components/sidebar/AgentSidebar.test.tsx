import { render, screen, fireEvent } from "@testing-library/react";
import { test, expect, vi, beforeEach } from "vitest";
import AgentSidebar from "./AgentSidebar";
import type { AgentNodeData } from "../canvas/AgentNode";

function createMockData(overrides: Partial<AgentNodeData> = {}): AgentNodeData {
  return {
    name: "Architect",
    emoji: "\uD83D\uDC68\u200D\uD83D\uDCBB",
    role: "Lead Architect",
    goal: "Design robust systems",
    skills: ["TypeScript", "React"],
    practices: ["Code review", "TDD"],
    ...overrides,
  };
}

function renderSidebar(
  data: AgentNodeData = createMockData(),
  onChange = vi.fn(),
  onClose = vi.fn(),
  onDelete = vi.fn(),
) {
  return {
    onChange,
    onClose,
    onDelete,
    ...render(
      <AgentSidebar
        data={data}
        onChange={onChange}
        onClose={onClose}
        onDelete={onDelete}
      />,
    ),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

test("renders the sidebar with header", () => {
  renderSidebar();
  expect(screen.getByText("Agent Properties")).toBeTruthy();
  expect(screen.getByTestId("agent-sidebar")).toBeTruthy();
});

test("renders close button", () => {
  renderSidebar();
  expect(screen.getByTestId("close-sidebar")).toBeTruthy();
});

test("calls onClose when close button is clicked", () => {
  const onClose = vi.fn();
  renderSidebar(createMockData(), vi.fn(), onClose);

  fireEvent.click(screen.getByTestId("close-sidebar"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("renders name input with current value", () => {
  renderSidebar(createMockData({ name: "Architect" }));

  const input = screen.getByTestId("agent-name-input") as HTMLInputElement;
  expect(input.value).toBe("Architect");
});

test("emits onChange when name is edited", () => {
  const onChange = vi.fn();
  renderSidebar(createMockData(), onChange);

  const input = screen.getByTestId("agent-name-input");
  fireEvent.change(input, { target: { value: "New Name" } });

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ name: "New Name" }),
  );
});

test("renders emoji input with current value", () => {
  renderSidebar(createMockData({ emoji: "\uD83E\uDD16" }));

  const input = screen.getByTestId("agent-emoji-input") as HTMLInputElement;
  expect(input.value).toBe("\uD83E\uDD16");
});

test("emits onChange when emoji is edited", () => {
  const onChange = vi.fn();
  renderSidebar(createMockData(), onChange);

  const input = screen.getByTestId("agent-emoji-input");
  fireEvent.change(input, { target: { value: "\uD83D\uDE80" } });

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ emoji: "\uD83D\uDE80" }),
  );
});

test("renders role input with current value", () => {
  renderSidebar(createMockData({ role: "Lead Architect" }));

  const input = screen.getByTestId("agent-role-input") as HTMLInputElement;
  expect(input.value).toBe("Lead Architect");
});

test("emits onChange when role is edited", () => {
  const onChange = vi.fn();
  renderSidebar(createMockData(), onChange);

  const input = screen.getByTestId("agent-role-input");
  fireEvent.change(input, { target: { value: "Senior Dev" } });

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ role: "Senior Dev" }),
  );
});

test("renders goal textarea with current value", () => {
  renderSidebar(createMockData({ goal: "Design robust systems" }));

  const textarea = screen.getByTestId("agent-goal-input") as HTMLTextAreaElement;
  expect(textarea.value).toBe("Design robust systems");
});

test("goal textarea accepts multi-line text", () => {
  const onChange = vi.fn();
  renderSidebar(createMockData(), onChange);

  const textarea = screen.getByTestId("agent-goal-input");
  fireEvent.change(textarea, { target: { value: "Line 1\nLine 2\nLine 3" } });

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ goal: "Line 1\nLine 2\nLine 3" }),
  );
});

test("renders skills as tags", () => {
  renderSidebar(createMockData({ skills: ["TypeScript", "React"] }));

  expect(screen.getByText("TypeScript")).toBeTruthy();
  expect(screen.getByText("React")).toBeTruthy();
});

test("renders practices as list items", () => {
  renderSidebar(createMockData({ practices: ["Code review", "TDD"] }));

  expect(screen.getByText("Code review")).toBeTruthy();
  expect(screen.getByText("TDD")).toBeTruthy();
});

test("renders delete agent button", () => {
  renderSidebar();
  expect(screen.getByTestId("delete-agent-button")).toBeTruthy();
  expect(screen.getByText("Delete Agent")).toBeTruthy();
});

test("calls onDelete when delete is confirmed", () => {
  const onDelete = vi.fn();
  vi.spyOn(window, "confirm").mockReturnValue(true);

  renderSidebar(createMockData(), vi.fn(), vi.fn(), onDelete);

  fireEvent.click(screen.getByTestId("delete-agent-button"));

  expect(window.confirm).toHaveBeenCalled();
  expect(onDelete).toHaveBeenCalledTimes(1);
});

test("does not call onDelete when delete is cancelled", () => {
  const onDelete = vi.fn();
  vi.spyOn(window, "confirm").mockReturnValue(false);

  renderSidebar(createMockData(), vi.fn(), vi.fn(), onDelete);

  fireEvent.click(screen.getByTestId("delete-agent-button"));

  expect(window.confirm).toHaveBeenCalled();
  expect(onDelete).not.toHaveBeenCalled();
});

test("renders all field labels", () => {
  renderSidebar();

  expect(screen.getByLabelText("Name")).toBeTruthy();
  expect(screen.getByLabelText("Emoji")).toBeTruthy();
  expect(screen.getByLabelText("Role")).toBeTruthy();
  expect(screen.getByLabelText("Goal")).toBeTruthy();
  expect(screen.getByText("Skills")).toBeTruthy();
  expect(screen.getByText("Practices")).toBeTruthy();
});
