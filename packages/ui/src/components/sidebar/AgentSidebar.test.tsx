import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    skillIds: [],
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
  global.fetch = vi.fn();
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
  renderSidebar(createMockData({ emoji: "🤖" }));

  // The emoji picker trigger displays the current emoji
  const emojiTrigger = screen.getByTestId("emoji-picker-trigger");
  expect(emojiTrigger.textContent).toBe("🤖");
});

test("emits onChange when emoji is edited", async () => {
  const onChange = vi.fn();
  renderSidebar(createMockData(), onChange);

  // Open emoji picker
  const emojiTrigger = screen.getByTestId("emoji-picker-trigger");
  fireEvent.click(emojiTrigger);

  // Wait for popover and select rocket emoji
  await waitFor(() => {
    expect(screen.getByTestId("emoji-picker-popover")).toBeTruthy();
  });

  const rocketEmoji = screen.getByTestId("emoji-🚀");
  fireEvent.click(rocketEmoji);

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ emoji: "🚀" }),
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

test("renders free-text tags under Tags label", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  renderSidebar(createMockData({ skills: ["TypeScript", "React"] }));

  await waitFor(() => {
    expect(screen.getByText("Tags")).toBeTruthy();
  });

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
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  renderSidebar();

  expect(screen.getByLabelText("Name")).toBeTruthy();
  expect(screen.getByLabelText("Emoji")).toBeTruthy();
  expect(screen.getByLabelText("Role")).toBeTruthy();
  expect(screen.getByLabelText("Goal")).toBeTruthy();
  expect(screen.getAllByText("Skills").length).toBeGreaterThan(0);
  expect(screen.getByText("Tags")).toBeTruthy();
  expect(screen.getByText("Practices")).toBeTruthy();
});

test("fetches available skills on mount", async () => {
  const mockSkills = [
    { id: "skill-1", name: "TypeScript Expert", description: "Advanced TS knowledge" },
    { id: "skill-2", name: "React Specialist", description: "React best practices" },
  ];

  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => mockSkills,
  });

  renderSidebar();

  await waitFor(() => {
    expect(screen.getByText("TypeScript Expert")).toBeTruthy();
    expect(screen.getByText("React Specialist")).toBeTruthy();
  });

  expect(global.fetch).toHaveBeenCalledWith("/api/skills");
});

test("displays empty state when no skills are available", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  renderSidebar();

  await waitFor(() => {
    expect(screen.getByText("No skills available. Create skills in the Skills page.")).toBeTruthy();
  });
});

test("displays loading state while fetching skills", () => {
  (global.fetch as any).mockImplementation(() => new Promise(() => {}));

  renderSidebar();

  expect(screen.getByText("Loading skills...")).toBeTruthy();
});

test("handles skill selection", async () => {
  const mockSkills = [
    { id: "skill-1", name: "TypeScript Expert", description: "Advanced TS" },
  ];

  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => mockSkills,
  });

  const onChange = vi.fn();
  renderSidebar(createMockData({ skillIds: [] }), onChange);

  await waitFor(() => {
    expect(screen.getByText("TypeScript Expert")).toBeTruthy();
  });

  const checkbox = screen.getByTestId("skill-checkbox-skill-1") as HTMLInputElement;
  expect(checkbox.checked).toBe(false);

  fireEvent.click(checkbox);

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ skillIds: ["skill-1"] }),
  );
});

test("handles skill deselection", async () => {
  const mockSkills = [
    { id: "skill-1", name: "TypeScript Expert", description: "Advanced TS" },
  ];

  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => mockSkills,
  });

  const onChange = vi.fn();
  renderSidebar(createMockData({ skillIds: ["skill-1"] }), onChange);

  await waitFor(() => {
    expect(screen.getByText("TypeScript Expert")).toBeTruthy();
  });

  const checkbox = screen.getByTestId("skill-checkbox-skill-1") as HTMLInputElement;
  expect(checkbox.checked).toBe(true);

  fireEvent.click(checkbox);

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ skillIds: [] }),
  );
});

test("displays multiple skills with correct checked state", async () => {
  const mockSkills = [
    { id: "skill-1", name: "Skill A", description: "Description A" },
    { id: "skill-2", name: "Skill B", description: "Description B" },
    { id: "skill-3", name: "Skill C", description: "Description C" },
  ];

  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => mockSkills,
  });

  renderSidebar(createMockData({ skillIds: ["skill-1", "skill-3"] }));

  await waitFor(() => {
    expect(screen.getByText("Skill A")).toBeTruthy();
  });

  const checkbox1 = screen.getByTestId("skill-checkbox-skill-1") as HTMLInputElement;
  const checkbox2 = screen.getByTestId("skill-checkbox-skill-2") as HTMLInputElement;
  const checkbox3 = screen.getByTestId("skill-checkbox-skill-3") as HTMLInputElement;

  expect(checkbox1.checked).toBe(true);
  expect(checkbox2.checked).toBe(false);
  expect(checkbox3.checked).toBe(true);
});

test("silently handles fetch error for skills", async () => {
  (global.fetch as any).mockRejectedValue(new Error("Network error"));

  renderSidebar();

  // Should not throw, just show empty state after loading
  await waitFor(() => {
    expect(screen.queryByText("Loading skills...")).toBeNull();
  });
});

test("renders model label", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  renderSidebar();

  await waitFor(() => {
    expect(screen.getByLabelText("Model")).toBeTruthy();
  });
});

test("renders model dropdown with default selection when model is undefined", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  renderSidebar(createMockData({ model: undefined }));

  await waitFor(() => {
    const select = screen.getByTestId("agent-model-select") as HTMLSelectElement;
    expect(select.value).toBe("claude-sonnet-4-20250514");
  });
});

test("renders model dropdown with current predefined model selected", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  renderSidebar(createMockData({ model: "claude-opus-4-20250514" }));

  await waitFor(() => {
    const select = screen.getByTestId("agent-model-select") as HTMLSelectElement;
    expect(select.value).toBe("claude-opus-4-20250514");
  });
});

test("selecting a predefined model calls onChange with that model", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  const onChange = vi.fn();
  renderSidebar(createMockData({ model: "claude-sonnet-4-20250514" }), onChange);

  await waitFor(() => {
    expect(screen.getByTestId("agent-model-select")).toBeTruthy();
  });

  const select = screen.getByTestId("agent-model-select");
  fireEvent.change(select, { target: { value: "claude-haiku-3-5-20241022" } });

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ model: "claude-haiku-3-5-20241022" }),
  );
});

test("selecting Custom option reveals text input", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  renderSidebar(createMockData({ model: "claude-sonnet-4-20250514" }));

  await waitFor(() => {
    expect(screen.getByTestId("agent-model-select")).toBeTruthy();
  });

  const select = screen.getByTestId("agent-model-select");
  fireEvent.change(select, { target: { value: "custom" } });

  await waitFor(() => {
    expect(screen.getByTestId("agent-model-custom-input")).toBeTruthy();
    expect(screen.queryByTestId("agent-model-select")).toBeNull();
  });
});

test("typing a custom model value calls onChange", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  const onChange = vi.fn();
  renderSidebar(createMockData({ model: "claude-sonnet-4-20250514" }), onChange);

  await waitFor(() => {
    expect(screen.getByTestId("agent-model-select")).toBeTruthy();
  });

  // Switch to custom mode
  const select = screen.getByTestId("agent-model-select");
  fireEvent.change(select, { target: { value: "custom" } });

  await waitFor(() => {
    expect(screen.getByTestId("agent-model-custom-input")).toBeTruthy();
  });

  // Type custom value
  const input = screen.getByTestId("agent-model-custom-input");
  fireEvent.change(input, { target: { value: "custom-model-xyz" } });

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ model: "custom-model-xyz" }),
  );
});

test("clearing custom input reverts to default model", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  const onChange = vi.fn();
  renderSidebar(createMockData({ model: "custom-model-xyz" }), onChange);

  // Should start in custom mode since model is not predefined
  await waitFor(() => {
    expect(screen.getByTestId("agent-model-custom-input")).toBeTruthy();
  });

  const input = screen.getByTestId("agent-model-custom-input");
  fireEvent.change(input, { target: { value: "" } });

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ model: "claude-sonnet-4-20250514" }),
  );
});

test("model persists across sidebar open/close", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  const mockData = createMockData({ model: "claude-opus-4-20250514" });
  const { unmount } = renderSidebar(mockData);

  await waitFor(() => {
    const select = screen.getByTestId("agent-model-select") as HTMLSelectElement;
    expect(select.value).toBe("claude-opus-4-20250514");
  });

  // Unmount (simulate closing)
  unmount();

  // Re-render with same data (simulate reopening)
  renderSidebar(mockData);

  await waitFor(() => {
    const select = screen.getByTestId("agent-model-select") as HTMLSelectElement;
    expect(select.value).toBe("claude-opus-4-20250514");
  });
});

test("back to dropdown button reverts to default when custom model is not predefined", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  const onChange = vi.fn();
  renderSidebar(createMockData({ model: "custom-model-xyz" }), onChange);

  // Should start in custom mode
  await waitFor(() => {
    expect(screen.getByTestId("agent-model-custom-input")).toBeTruthy();
  });

  const backButton = screen.getByTestId("agent-model-back-to-dropdown");
  fireEvent.click(backButton);

  await waitFor(() => {
    expect(screen.getByTestId("agent-model-select")).toBeTruthy();
  });

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ model: "claude-sonnet-4-20250514" }),
  );
});

test("displays custom input when agent has non-predefined model", async () => {
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => [],
  });

  renderSidebar(createMockData({ model: "my-custom-model-2024" }));

  await waitFor(() => {
    expect(screen.getByTestId("agent-model-custom-input")).toBeTruthy();
    const input = screen.getByTestId("agent-model-custom-input") as HTMLInputElement;
    expect(input.value).toBe("my-custom-model-2024");
  });
});
