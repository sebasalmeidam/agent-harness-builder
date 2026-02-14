import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TaskActivityLog from "./TaskActivityLog";
import * as useExecutionSSEModule from "../../hooks/useExecutionSSE";

// Mock the useExecutionSSE hook
vi.mock("../../hooks/useExecutionSSE");

describe("TaskActivityLog", () => {
  const mockProjectId = "project-123";
  const mockRunId = "run-456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders activity log with connecting state", () => {
    vi.spyOn(useExecutionSSEModule, "useExecutionSSE").mockReturnValue({
      status: null,
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: null,
      error: null,
      connectionStatus: "connecting",
    });

    render(
      <TaskActivityLog projectId={mockProjectId} runId={mockRunId} />,
    );

    expect(screen.getByText("Activity Log")).toBeInTheDocument();
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("renders activity log with connected state", () => {
    vi.spyOn(useExecutionSSEModule, "useExecutionSSE").mockReturnValue({
      status: "running",
      agentStatuses: {},
      activityLog: [
        {
          timestamp: "2024-01-01T00:00:00Z",
          agentId: "agent-1",
          agentEmoji: "🤖",
          agentName: "Agent 1",
          message: "Starting work",
          type: "action",
        },
      ],
      files: [],
      summary: null,
      error: null,
      connectionStatus: "connected",
    });

    render(
      <TaskActivityLog projectId={mockProjectId} runId={mockRunId} />,
    );

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Starting work")).toBeInTheDocument();
  });

  it("renders completed state with summary", () => {
    vi.spyOn(useExecutionSSEModule, "useExecutionSSE").mockReturnValue({
      status: "completed",
      agentStatuses: {},
      activityLog: [
        {
          timestamp: "2024-01-01T00:00:00Z",
          agentId: "agent-1",
          agentEmoji: "🤖",
          agentName: "Agent 1",
          message: "Work completed",
          type: "complete",
        },
      ],
      files: ["file1.ts"],
      summary: {
        filesChanged: 1,
        totalTime: 10,
        iterations: 5,
        errors: 0,
      },
      error: null,
      connectionStatus: "disconnected",
    });

    render(
      <TaskActivityLog projectId={mockProjectId} runId={mockRunId} />,
    );

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText(/Files changed:/)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/Total time:/)).toBeInTheDocument();
    expect(screen.getByText("10s")).toBeInTheDocument();
  });

  it("renders failed state with error", () => {
    vi.spyOn(useExecutionSSEModule, "useExecutionSSE").mockReturnValue({
      status: "failed",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: {
        filesChanged: 0,
        totalTime: 5,
        iterations: 2,
        errors: 1,
      },
      error: "Execution failed",
      connectionStatus: "disconnected",
    });

    render(
      <TaskActivityLog projectId={mockProjectId} runId={mockRunId} />,
    );

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Execution failed")).toBeInTheDocument();
  });

  it("calls onComplete callback when execution completes", async () => {
    const onComplete = vi.fn();

    const { rerender } = render(
      <TaskActivityLog
        projectId={mockProjectId}
        runId={mockRunId}
        onComplete={onComplete}
      />,
    );

    // Initial state: running
    vi.spyOn(useExecutionSSEModule, "useExecutionSSE").mockReturnValue({
      status: "running",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: null,
      error: null,
      connectionStatus: "connected",
    });

    rerender(
      <TaskActivityLog
        projectId={mockProjectId}
        runId={mockRunId}
        onComplete={onComplete}
      />,
    );

    expect(onComplete).not.toHaveBeenCalled();

    // Change to completed state
    vi.spyOn(useExecutionSSEModule, "useExecutionSSE").mockReturnValue({
      status: "completed",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: {
        filesChanged: 0,
        totalTime: 5,
        iterations: 2,
        errors: 0,
      },
      error: null,
      connectionStatus: "disconnected",
    });

    rerender(
      <TaskActivityLog
        projectId={mockProjectId}
        runId={mockRunId}
        onComplete={onComplete}
      />,
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("completed");
    });
  });

  it("calls onComplete callback when execution fails", async () => {
    const onComplete = vi.fn();

    const { rerender } = render(
      <TaskActivityLog
        projectId={mockProjectId}
        runId={mockRunId}
        onComplete={onComplete}
      />,
    );

    // Initial state: running
    vi.spyOn(useExecutionSSEModule, "useExecutionSSE").mockReturnValue({
      status: "running",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: null,
      error: null,
      connectionStatus: "connected",
    });

    rerender(
      <TaskActivityLog
        projectId={mockProjectId}
        runId={mockRunId}
        onComplete={onComplete}
      />,
    );

    // Change to failed state
    vi.spyOn(useExecutionSSEModule, "useExecutionSSE").mockReturnValue({
      status: "failed",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: {
        filesChanged: 0,
        totalTime: 5,
        iterations: 2,
        errors: 1,
      },
      error: "Something went wrong",
      connectionStatus: "disconnected",
    });

    rerender(
      <TaskActivityLog
        projectId={mockProjectId}
        runId={mockRunId}
        onComplete={onComplete}
      />,
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("failed");
    });
  });
});
