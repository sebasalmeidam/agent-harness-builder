import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import TaskDetailPanel from "./TaskDetailPanel";

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Mock TaskActivityLog component
vi.mock("./TaskActivityLog", () => ({
  default: () => <div data-testid="task-activity-log">TaskActivityLog</div>,
}));

// Mock TeamSelector to avoid fetch calls
vi.mock("./TeamSelector", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (v: string | null) => void;
  }) => (
    <select
      data-testid="team-selector"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">No team</option>
      <option value="team-123">Team 123</option>
    </select>
  ),
}));

// Mock ChecklistEditor to avoid complexity
vi.mock("./ChecklistEditor", () => ({
  default: () => <div data-testid="checklist-editor">ChecklistEditor</div>,
}));

function mockTaskFetch(task: Record<string, unknown>) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => task,
  });
}

describe("TaskDetailPanel - Execute Button", () => {
  const mockProjectId = "project-123";
  const mockTaskId = "task-456";
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables execute button when task has team and status is pending", async () => {
    mockTaskFetch({
      id: mockTaskId,
      projectId: mockProjectId,
      title: "Test Task",
      description: "Test description",
      checklist: [],
      teamId: "team-123",
      status: "pending",
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeTruthy();
    });

    const executeButton = screen.getByTestId(
      "execute-button",
    ) as HTMLButtonElement;
    expect(executeButton.disabled).toBe(false);
    expect(executeButton.textContent).toContain("Execute Task");
  });

  it("enables execute button when task status is failed", async () => {
    mockTaskFetch({
      id: mockTaskId,
      projectId: mockProjectId,
      title: "Test Task",
      description: "Test description",
      checklist: [],
      teamId: "team-123",
      status: "failed",
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeTruthy();
    });

    const executeButton = screen.getByTestId(
      "execute-button",
    ) as HTMLButtonElement;
    expect(executeButton.disabled).toBe(false);
  });

  it("disables execute button when task has no team", async () => {
    mockTaskFetch({
      id: mockTaskId,
      projectId: mockProjectId,
      title: "Test Task",
      description: "Test description",
      checklist: [],
      teamId: null,
      status: "pending",
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeTruthy();
    });

    const executeButton = screen.getByTestId(
      "execute-button",
    ) as HTMLButtonElement;
    expect(executeButton.disabled).toBe(true);
    expect(executeButton.getAttribute("title")).toBe(
      "Assign a team to execute this task",
    );
  });

  it("disables execute button when task status is running", async () => {
    mockTaskFetch({
      id: mockTaskId,
      projectId: mockProjectId,
      title: "Test Task",
      description: "Test description",
      checklist: [],
      teamId: "team-123",
      status: "running",
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeTruthy();
    });

    const executeButton = screen.getByTestId(
      "execute-button",
    ) as HTMLButtonElement;
    expect(executeButton.disabled).toBe(true);
    expect(executeButton.textContent).toContain("Running...");
  });

  it("disables execute button when task status is done", async () => {
    mockTaskFetch({
      id: mockTaskId,
      projectId: mockProjectId,
      title: "Test Task",
      description: "Test description",
      checklist: [],
      teamId: "team-123",
      status: "done",
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeTruthy();
    });

    const executeButton = screen.getByTestId(
      "execute-button",
    ) as HTMLButtonElement;
    expect(executeButton.disabled).toBe(true);
    expect(executeButton.textContent).toContain("Completed");
  });

  it("calls execute endpoint on button click", async () => {
    mockTaskFetch({
      id: mockTaskId,
      projectId: mockProjectId,
      title: "Test Task",
      description: "Test description",
      checklist: [],
      teamId: "team-123",
      status: "pending",
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeTruthy();
    });

    // Mock execute endpoint response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runId: "run-789" }),
    });

    fireEvent.click(screen.getByTestId("execute-button"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/projects/${mockProjectId}/tasks/${mockTaskId}/execute`,
        { method: "POST" },
      );
    });
  });

  it("shows error message when execute fails", async () => {
    mockTaskFetch({
      id: mockTaskId,
      projectId: mockProjectId,
      title: "Test Task",
      description: "Test description",
      checklist: [],
      teamId: "team-123",
      status: "pending",
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeTruthy();
    });

    // Mock execute endpoint error
    fetchMock.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      json: async () => ({ message: "Task cannot be executed" }),
    });

    fireEvent.click(screen.getByTestId("execute-button"));

    await waitFor(() => {
      expect(screen.getByText("Task cannot be executed")).toBeTruthy();
    });
  });
});
