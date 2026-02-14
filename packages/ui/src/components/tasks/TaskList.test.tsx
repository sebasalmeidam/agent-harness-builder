import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import TaskList from "./TaskList";

const mockTasks = [
  {
    id: "task-1",
    projectId: "project-1",
    title: "Implement login",
    description: "Build the login form",
    checklist: [
      { id: "c1", description: "Create form", completed: true },
      { id: "c2", description: "Add validation", completed: false },
    ],
    teamId: "team-1",
    status: "pending" as const,
  },
  {
    id: "task-2",
    projectId: "project-1",
    title: "Write tests",
    description: "Add test coverage",
    checklist: [
      { id: "c3", description: "Unit tests", completed: true },
      { id: "c4", description: "E2E tests", completed: true },
      { id: "c5", description: "Integration tests", completed: false },
    ],
    teamId: null,
    status: "running" as const,
  },
  {
    id: "task-3",
    projectId: "project-1",
    title: "Deploy",
    description: "",
    checklist: [],
    teamId: "team-2",
    status: "done" as const,
  },
  {
    id: "task-4",
    projectId: "project-1",
    title: "Fix bug",
    description: "",
    checklist: [{ id: "c6", description: "Debug", completed: false }],
    teamId: null,
    status: "failed" as const,
  },
];

const mockTeams = [
  {
    id: "team-1",
    name: "Frontend Team",
    description: "UI developers",
    agentCount: 3,
    agentEmojis: ["👨‍💻", "🎨", "🧪"],
  },
  {
    id: "team-2",
    name: "Backend Team",
    description: "API developers",
    agentCount: 2,
    agentEmojis: ["🏗️", "📋"],
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    // GET /api/projects/project-1/tasks
    if (urlStr.endsWith("/api/projects/project-1/tasks") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockTasks), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/teams
    if (urlStr.endsWith("/api/teams") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockTeams), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // POST /api/projects/project-1/tasks
    if (urlStr.endsWith("/api/projects/project-1/tasks") && method === "POST") {
      const body = JSON.parse(init?.body as string);
      const newTask = {
        id: "new-task-id",
        projectId: "project-1",
        title: body.title,
        description: "",
        checklist: [],
        teamId: null,
        status: "pending" as const,
      };
      return Promise.resolve(
        new Response(JSON.stringify(newTask), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // DELETE /api/projects/project-1/tasks/:id
    if (
      urlStr.includes("/api/projects/project-1/tasks/") &&
      method === "DELETE"
    ) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    return Promise.resolve(
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TaskList", () => {
  test("shows loading state while fetching", () => {
    render(<TaskList projectId="project-1" />);
    expect(screen.getByText("Loading tasks...")).toBeTruthy();
  });

  test("renders task list after loading", async () => {
    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("task-list")).toBeTruthy();
    });

    expect(screen.getByText("Implement login")).toBeTruthy();
    expect(screen.getByText("Write tests")).toBeTruthy();
    expect(screen.getByText("Deploy")).toBeTruthy();
    expect(screen.getByText("Fix bug")).toBeTruthy();
  });

  test("displays status badges with correct colors", async () => {
    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("task-status-task-1")).toBeTruthy();
    });

    const pendingBadge = screen.getByTestId("task-status-task-1");
    const runningBadge = screen.getByTestId("task-status-task-2");
    const doneBadge = screen.getByTestId("task-status-task-3");
    const failedBadge = screen.getByTestId("task-status-task-4");

    expect(pendingBadge.textContent).toBe("pending");
    expect(pendingBadge.className).toContain("bg-[rgb(189,190,191)]");

    expect(runningBadge.textContent).toBe("running");
    expect(runningBadge.className).toContain("bg-info-light");

    expect(doneBadge.textContent).toBe("done");
    expect(doneBadge.className).toContain("bg-success-light");

    expect(failedBadge.textContent).toBe("failed");
    expect(failedBadge.className).toContain("bg-red-50");
  });

  test("displays team names", async () => {
    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("task-team-task-1")).toBeTruthy();
    });

    expect(screen.getByTestId("task-team-task-1").textContent).toBe(
      "Frontend Team",
    );
    expect(screen.getByTestId("task-team-task-2").textContent).toBe("No team");
    expect(screen.getByTestId("task-team-task-3").textContent).toBe(
      "Backend Team",
    );
  });

  test("displays checklist progress", async () => {
    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("task-progress-task-1")).toBeTruthy();
    });

    expect(screen.getByTestId("task-progress-task-1").textContent).toBe(
      "1/2 done",
    );
    expect(screen.getByTestId("task-progress-task-2").textContent).toBe(
      "2/3 done",
    );
    expect(screen.getByTestId("task-progress-task-3").textContent).toBe(
      "0/0 done",
    );
    expect(screen.getByTestId("task-progress-task-4").textContent).toBe(
      "0/1 done",
    );
  });

  test("shows empty state when no tasks", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects/empty-project/tasks")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (urlStr.endsWith("/api/teams")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTeams), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
        }),
      );
    });

    render(<TaskList projectId="empty-project" />);

    await waitFor(() => {
      expect(screen.getByTestId("tasks-empty")).toBeTruthy();
    });

    expect(
      screen.getByText('No tasks yet. Click "Add Task" to create one.'),
    ).toBeTruthy();
  });

  test("renders Add Task button", async () => {
    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("add-task-button")).toBeTruthy();
    });

    expect(screen.getByText("Add Task")).toBeTruthy();
  });

  test("shows task creation form when Add Task is clicked", async () => {
    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("add-task-button")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("add-task-button"));

    await waitFor(() => {
      expect(screen.getByTestId("new-task-input")).toBeTruthy();
    });

    expect(screen.getByPlaceholderText("Task title...")).toBeTruthy();
    expect(screen.getByTestId("create-task-button")).toBeTruthy();
  });

  test("creates a new task", async () => {
    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("add-task-button")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("add-task-button"));

    const input = screen.getByTestId("new-task-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Task" } });
    fireEvent.click(screen.getByTestId("create-task-button"));

    await waitFor(() => {
      expect(screen.getByText("New Task")).toBeTruthy();
    });

    // Verify POST was called
    const postCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === "POST",
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.title).toBe("New Task");
  });

  test("cancels task creation form", async () => {
    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("add-task-button")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("add-task-button"));

    await waitFor(() => {
      expect(screen.getByTestId("new-task-input")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByTestId("new-task-input")).toBeNull();
    });

    expect(screen.getByTestId("add-task-button")).toBeTruthy();
  });

  test("does not create task with empty title", async () => {
    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("add-task-button")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("add-task-button"));

    const createButton = screen.getByTestId(
      "create-task-button",
    ) as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);
  });

  test("deletes a task with confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("delete-task-task-1")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("delete-task-task-1"));

    await waitFor(() => {
      expect(screen.queryByText("Implement login")).toBeNull();
    });

    // Verify DELETE was called
    const deleteCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === "DELETE",
    );
    expect(deleteCall).toBeTruthy();
  });

  test("does not delete task when confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<TaskList projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("delete-task-task-1")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("delete-task-task-1"));

    await waitFor(() => {
      expect(screen.getByText("Implement login")).toBeTruthy();
    });

    // Verify DELETE was not called
    const deleteCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === "DELETE",
    );
    expect(deleteCall).toBeFalsy();
  });

  test("calls onTaskSelect when task is clicked", async () => {
    const onTaskSelect = vi.fn();

    render(<TaskList projectId="project-1" onTaskSelect={onTaskSelect} />);

    await waitFor(() => {
      expect(screen.getByTestId("task-item-task-1")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("task-item-task-1"));

    expect(onTaskSelect).toHaveBeenCalledWith("task-1");
  });

  test("highlights selected task", async () => {
    render(<TaskList projectId="project-1" selectedTaskId="task-2" />);

    await waitFor(() => {
      expect(screen.getByTestId("task-item-task-2")).toBeTruthy();
    });

    const selectedTask = screen.getByTestId("task-item-task-2");
    expect(selectedTask.className).toContain("border-primary");
    expect(selectedTask.className).toContain("bg-primary-light");

    const unselectedTask = screen.getByTestId("task-item-task-1");
    expect(unselectedTask.className).toContain("border-border");
  });

  test("handles API error gracefully", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects/error-project/tasks")) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
        }),
      );
    });

    render(<TaskList projectId="error-project" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to fetch tasks:/i),
      ).toBeTruthy();
    });
  });
});
