import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskDetailPanel from "./TaskDetailPanel";

// Mock fetch globally
global.fetch = vi.fn();

// Mock TaskActivityLog component
vi.mock("./TaskActivityLog", () => ({
  default: () => <div>TaskActivityLog</div>,
}));

describe("TaskDetailPanel - Execute Button", () => {
  const mockProjectId = "project-123";
  const mockTaskId = "task-456";
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables execute button when task has team and status is pending", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: mockTaskId,
        projectId: mockProjectId,
        title: "Test Task",
        description: "Test description",
        checklist: [],
        teamId: "team-123",
        status: "pending",
      }),
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeInTheDocument();
    });

    const executeButton = screen.getByTestId("execute-button");
    expect(executeButton).not.toBeDisabled();
    expect(executeButton).toHaveTextContent("Execute Task");
  });

  it("enables execute button when task status is failed", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: mockTaskId,
        projectId: mockProjectId,
        title: "Test Task",
        description: "Test description",
        checklist: [],
        teamId: "team-123",
        status: "failed",
      }),
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeInTheDocument();
    });

    const executeButton = screen.getByTestId("execute-button");
    expect(executeButton).not.toBeDisabled();
  });

  it("disables execute button when task has no team", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: mockTaskId,
        projectId: mockProjectId,
        title: "Test Task",
        description: "Test description",
        checklist: [],
        teamId: null,
        status: "pending",
      }),
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeInTheDocument();
    });

    const executeButton = screen.getByTestId("execute-button");
    expect(executeButton).toBeDisabled();
    expect(executeButton).toHaveAttribute(
      "title",
      "Assign a team to execute this task",
    );
  });

  it("disables execute button when task status is running", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: mockTaskId,
        projectId: mockProjectId,
        title: "Test Task",
        description: "Test description",
        checklist: [],
        teamId: "team-123",
        status: "running",
      }),
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeInTheDocument();
    });

    const executeButton = screen.getByTestId("execute-button");
    expect(executeButton).toBeDisabled();
    expect(executeButton).toHaveTextContent("Running...");
  });

  it("disables execute button when task status is done", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: mockTaskId,
        projectId: mockProjectId,
        title: "Test Task",
        description: "Test description",
        checklist: [],
        teamId: "team-123",
        status: "done",
      }),
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeInTheDocument();
    });

    const executeButton = screen.getByTestId("execute-button");
    expect(executeButton).toBeDisabled();
    expect(executeButton).toHaveTextContent("Completed");
  });

  it("calls execute endpoint and shows activity log on successful execution", async () => {
    const user = userEvent.setup();

    // Mock initial task fetch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: mockTaskId,
        projectId: mockProjectId,
        title: "Test Task",
        description: "Test description",
        checklist: [],
        teamId: "team-123",
        status: "pending",
      }),
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeInTheDocument();
    });

    // Mock execute endpoint response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runId: "run-789" }),
    });

    const executeButton = screen.getByTestId("execute-button");
    await user.click(executeButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/projects/${mockProjectId}/tasks/${mockTaskId}/execute`,
        { method: "POST" },
      );
    });

    // Activity log should be shown
    await waitFor(() => {
      expect(screen.getByText("TaskActivityLog")).toBeInTheDocument();
    });

    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it("shows error message when execute fails", async () => {
    const user = userEvent.setup();

    // Mock initial task fetch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: mockTaskId,
        projectId: mockProjectId,
        title: "Test Task",
        description: "Test description",
        checklist: [],
        teamId: "team-123",
        status: "pending",
      }),
    });

    render(
      <TaskDetailPanel
        taskId={mockTaskId}
        projectId={mockProjectId}
        onUpdate={mockOnUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("execute-button")).toBeInTheDocument();
    });

    // Mock execute endpoint error
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      json: async () => ({ message: "Task cannot be executed" }),
    });

    const executeButton = screen.getByTestId("execute-button");
    await user.click(executeButton);

    await waitFor(() => {
      expect(screen.getByText("Task cannot be executed")).toBeInTheDocument();
    });
  });
});
