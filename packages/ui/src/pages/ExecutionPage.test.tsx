import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import ExecutionPage from "./ExecutionPage";
import ProjectDetailPage from "./ProjectDetailPage";

// --- Mock data ---

const mockProject = {
  id: "proj-1",
  name: "Test Project",
  description: "A test project",
  spec: "Build something great",
  teamId: "team-1",
  gitUrl: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockProjectNoTeam = {
  id: "proj-no-team",
  name: "No Team Project",
  description: "No team",
  spec: "Build something",
  teamId: null,
  gitUrl: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockProjectNoSpec = {
  id: "proj-no-spec",
  name: "No Spec Project",
  description: "No spec",
  spec: "",
  teamId: "team-1",
  gitUrl: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockTeam = {
  id: "team-1",
  name: "My Team",
  description: "A team",
  agents: [
    {
      id: "agent-1",
      name: "Developer",
      emoji: "D",
      role: "Dev",
      goal: "Build",
      skills: [],
      practices: [],
      position: { x: 0, y: 0 },
    },
    {
      id: "agent-2",
      name: "Reviewer",
      emoji: "R",
      role: "Review",
      goal: "Review",
      skills: [],
      practices: [],
      position: { x: 100, y: 0 },
    },
  ],
  edges: [],
};

const mockTeamsList = [
  {
    id: "team-1",
    name: "My Team",
    description: "A team",
    agentCount: 2,
  },
];

const mockRunResponse = {
  id: "run-123",
  status: "running",
  startedAt: "2025-01-01T00:00:00.000Z",
};

// --- Mock EventSource ---

type EventSourceListener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  readyState = 0;
  onerror: ((event: Event) => void) | null = null;
  private listeners: Record<string, EventSourceListener[]> = {};

  constructor(url: string) {
    this.url = url;
    this.readyState = 1;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventSourceListener) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: EventSourceListener) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(
        (l) => l !== listener,
      );
    }
  }

  close() {
    this.readyState = 2;
  }

  // Test helper: simulate a server event
  _emit(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    });
    for (const listener of this.listeners[type] ?? []) {
      listener(event);
    }
  }

  static reset() {
    MockEventSource.instances = [];
  }

  static latest(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

// --- Test helpers ---

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetchMock() {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    // GET /api/projects/proj-1
    if (urlStr.endsWith("/api/projects/proj-1") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockProject), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/projects/proj-no-team
    if (urlStr.endsWith("/api/projects/proj-no-team") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockProjectNoTeam), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/projects/proj-no-spec
    if (urlStr.endsWith("/api/projects/proj-no-spec") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockProjectNoSpec), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/teams/team-1
    if (urlStr.endsWith("/api/teams/team-1") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockTeam), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/teams (list)
    if (urlStr.endsWith("/api/teams") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockTeamsList), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // POST /api/projects/:id/runs
    if (urlStr.includes("/runs") && method === "POST") {
      return Promise.resolve(
        new Response(JSON.stringify(mockRunResponse), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // PUT /api/projects/:id
    if (urlStr.includes("/api/projects/") && method === "PUT") {
      const body = JSON.parse(init?.body as string);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...mockProject,
            ...body,
            updatedAt: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    // DELETE /api/projects/:id
    if (urlStr.includes("/api/projects/") && method === "DELETE") {
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
}

function renderExecutionPage(projectId: string, runId: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/projects/:id/runs/:runId",
        element: <ExecutionPage />,
      },
      { path: "/projects/:id", element: <div>Project Detail Page</div> },
      { path: "/projects", element: <div>Projects List Page</div> },
    ],
    { initialEntries: [`/projects/${projectId}/runs/${runId}`] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

function renderProjectDetail(projectId: string) {
  const router = createMemoryRouter(
    [
      { path: "/projects/:id", element: <ProjectDetailPage /> },
      { path: "/projects", element: <div>Projects List Page</div> },
      { path: "/teams/:id", element: <div>Team Detail Page</div> },
      {
        path: "/projects/:id/runs/:runId",
        element: <div>Execution Page</div>,
      },
    ],
    { initialEntries: [`/projects/${projectId}`] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

beforeEach(() => {
  MockEventSource.reset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).EventSource = MockEventSource;
  setupFetchMock();
});

afterEach(() => {
  vi.restoreAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).EventSource;
});

// --- ExecutionPage tests ---

describe("ExecutionPage", () => {
  test("renders execution page with breadcrumb", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Execution Run" }),
      ).toBeTruthy();
    });

    expect(screen.getByText("Projects")).toBeTruthy();
    expect(screen.getByText("Run")).toBeTruthy();
  });

  test("renders status badge from SSE connected event", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    // Simulate connected event
    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: { "agent-1": "working", "agent-2": "idle" },
      activityLog: [],
      files: [],
      summary: null,
      error: null,
    });

    await waitFor(() => {
      const badge = screen.getByTestId("run-status-badge");
      expect(badge.textContent).toBe("Running");
    });
  });

  test("renders team progress with agent statuses", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    // Simulate connected event
    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: { "agent-1": "working", "agent-2": "idle" },
      activityLog: [],
      files: [],
      summary: null,
      error: null,
    });

    // Wait for project and team data to load
    await waitFor(() => {
      expect(screen.getByText("Developer")).toBeTruthy();
    });

    // Verify agent status badges
    const devStatus = screen.getByTestId("agent-status-agent-1");
    expect(devStatus.textContent).toBe("Working");

    const reviewerStatus = screen.getByTestId("agent-status-agent-2");
    expect(reviewerStatus.textContent).toBe("Idle");
  });

  test("renders activity log entries from SSE", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {},
      activityLog: [
        {
          timestamp: "2025-01-01T12:00:00.000Z",
          agentId: "agent-1",
          agentEmoji: "D",
          agentName: "Developer",
          message: "Starting implementation",
          type: "action",
        },
      ],
      files: [],
      summary: null,
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Starting implementation")).toBeTruthy();
    });
  });

  test("renders file list from SSE", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {},
      activityLog: [],
      files: ["src/main.ts", "src/utils.ts"],
      summary: null,
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByText("src/main.ts")).toBeTruthy();
      expect(screen.getByText("src/utils.ts")).toBeTruthy();
    });
  });

  test("renders summary card when run completes", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "completed",
      agentStatuses: { "agent-1": "done", "agent-2": "done" },
      activityLog: [],
      files: ["src/main.ts"],
      summary: {
        filesChanged: 3,
        totalTime: 125,
        iterations: 10,
        errors: 0,
      },
      error: null,
    });

    await waitFor(() => {
      const badge = screen.getByTestId("run-status-badge");
      expect(badge.textContent).toBe("Completed");
    });

    expect(screen.getByTestId("execution-summary-card")).toBeTruthy();
    expect(screen.getByTestId("stat-files-changed")).toBeTruthy();
    expect(screen.getByTestId("stat-total-time")).toBeTruthy();
  });

  test("renders error state for failed runs", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "failed",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: null,
      error: "SDK execution failed: API key invalid",
    });

    await waitFor(() => {
      const badge = screen.getByTestId("run-status-badge");
      expect(badge.textContent).toBe("Failed");
    });

    expect(screen.getByTestId("run-error")).toBeTruthy();
    expect(
      screen.getByText("SDK execution failed: API key invalid"),
    ).toBeTruthy();
  });

  test("connection status shows connected when SSE connects", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: null,
      error: null,
    });

    await waitFor(() => {
      const connStatus = screen.getByTestId("connection-status");
      expect(connStatus.textContent).toContain("Live");
    });
  });

  test("handles live activity event after initial connection", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: null,
      error: null,
    });

    // Now emit a live activity event
    MockEventSource.latest()!._emit("activity", {
      timestamp: "2025-01-01T12:01:00.000Z",
      agentId: "agent-1",
      agentEmoji: "D",
      agentName: "Developer",
      message: "Created new file",
      type: "action",
    });

    await waitFor(() => {
      expect(screen.getByText("Created new file")).toBeTruthy();
    });
  });

  test("handles live file-change event", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: null,
      error: null,
    });

    MockEventSource.latest()!._emit("file-change", {
      path: "src/new-file.ts",
    });

    await waitFor(() => {
      expect(screen.getByText("src/new-file.ts")).toBeTruthy();
    });
  });

  test("handles run-status event for completion", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: null,
      error: null,
    });

    MockEventSource.latest()!._emit("run-status", {
      status: "completed",
      summary: {
        filesChanged: 5,
        totalTime: 60,
        iterations: 8,
        errors: 1,
      },
    });

    await waitFor(() => {
      const badge = screen.getByTestId("run-status-badge");
      expect(badge.textContent).toBe("Completed");
    });
  });
});

// --- TeamProgress component tests ---

describe("TeamProgress", () => {
  test("renders agent nodes with correct status badges", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {
        "agent-1": "done",
        "agent-2": "blocked",
      },
      activityLog: [],
      files: [],
      summary: null,
      error: null,
    });

    // Wait for team data
    await waitFor(() => {
      expect(screen.getByTestId("agent-node-agent-1")).toBeTruthy();
    });

    expect(screen.getByTestId("agent-status-agent-1").textContent).toBe(
      "Done",
    );
    expect(screen.getByTestId("agent-status-agent-2").textContent).toBe(
      "Blocked",
    );
  });
});

// --- ActivityLog component tests ---

describe("ActivityLog", () => {
  test("renders entries with timestamps and agent info", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {},
      activityLog: [
        {
          timestamp: "2025-01-01T12:00:05.000Z",
          agentId: "agent-1",
          agentEmoji: "D",
          agentName: "Developer",
          message: "Reading files",
          type: "action",
        },
        {
          timestamp: "2025-01-01T12:00:10.000Z",
          agentId: "agent-1",
          agentEmoji: "D",
          agentName: "Developer",
          message: "Handing off to Reviewer",
          type: "handoff",
        },
      ],
      files: [],
      summary: null,
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Reading files")).toBeTruthy();
      expect(screen.getByText("Handing off to Reviewer")).toBeTruthy();
    });

    const entries = screen.getAllByTestId("activity-entry");
    expect(entries.length).toBe(2);
  });

  test("renders error entries in red", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {},
      activityLog: [
        {
          timestamp: "2025-01-01T12:00:00.000Z",
          agentId: "agent-1",
          agentEmoji: "D",
          agentName: "Developer",
          message: "Something went wrong",
          type: "error",
        },
      ],
      files: [],
      summary: null,
      error: null,
    });

    await waitFor(() => {
      const errorMsg = screen.getByText("Something went wrong");
      expect(errorMsg.className).toContain("text-red-600");
    });
  });
});

// --- FileList component tests ---

describe("FileList", () => {
  test("renders file paths", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "completed",
      agentStatuses: {},
      activityLog: [],
      files: ["package.json", "src/index.ts", "README.md"],
      summary: {
        filesChanged: 3,
        totalTime: 30,
        iterations: 5,
        errors: 0,
      },
      error: null,
    });

    await waitFor(() => {
      const fileEntries = screen.getAllByTestId("file-entry");
      expect(fileEntries.length).toBe(3);
    });

    expect(screen.getByText("package.json")).toBeTruthy();
    expect(screen.getByText("src/index.ts")).toBeTruthy();
    expect(screen.getByText("README.md")).toBeTruthy();
  });

  test("shows empty state when no files", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "running",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: null,
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByText("No files changed yet.")).toBeTruthy();
    });
  });
});

// --- ExecutionSummaryCard tests ---

describe("ExecutionSummaryCard", () => {
  test("renders all stats", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "completed",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: {
        filesChanged: 7,
        totalTime: 150,
        iterations: 12,
        errors: 2,
      },
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("execution-summary-card")).toBeTruthy();
    });

    // Check stat values
    expect(screen.getByTestId("stat-files-changed").textContent).toContain(
      "7",
    );
    expect(screen.getByTestId("stat-total-time").textContent).toContain(
      "2m 30s",
    );
    expect(screen.getByTestId("stat-iterations").textContent).toContain(
      "12",
    );
    expect(screen.getByTestId("stat-errors").textContent).toContain("2");
  });

  test("errors count shows red when greater than 0", async () => {
    renderExecutionPage("proj-1", "run-123");

    await waitFor(() => {
      expect(MockEventSource.latest()).toBeTruthy();
    });

    MockEventSource.latest()!._emit("connected", {
      status: "completed",
      agentStatuses: {},
      activityLog: [],
      files: [],
      summary: {
        filesChanged: 1,
        totalTime: 10,
        iterations: 3,
        errors: 5,
      },
      error: null,
    });

    await waitFor(() => {
      const errorsCard = screen.getByTestId("stat-errors");
      // The value paragraph should have red text
      const valueParagraph = errorsCard.querySelectorAll("p")[1];
      expect(valueParagraph?.className).toContain("text-red-600");
    });
  });
});

// --- ProjectDetailPage "Run Team" button tests ---

describe("ProjectDetailPage Run Team button", () => {
  test("Run Team button is disabled when no team assigned", async () => {
    renderProjectDetail("proj-no-team");

    await waitFor(() => {
      expect(screen.getByTestId("run-team-button")).toBeTruthy();
    });

    const button = screen.getByTestId("run-team-button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  test("Run Team button is disabled when spec is empty", async () => {
    renderProjectDetail("proj-no-spec");

    await waitFor(() => {
      expect(screen.getByTestId("run-team-button")).toBeTruthy();
    });

    const button = screen.getByTestId("run-team-button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  test("Run Team button is enabled when team and spec are present", async () => {
    renderProjectDetail("proj-1");

    await waitFor(() => {
      expect(screen.getByTestId("run-team-button")).toBeTruthy();
    });

    const button = screen.getByTestId("run-team-button") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  test("Run Team button triggers POST and navigates to execution page", async () => {
    const { router } = renderProjectDetail("proj-1");

    await waitFor(() => {
      expect(screen.getByTestId("run-team-button")).toBeTruthy();
    });

    const button = screen.getByTestId("run-team-button") as HTMLButtonElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/projects/proj-1/runs/run-123",
      );
    });

    // Verify POST was called
    const postCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) =>
        typeof call[0] === "string" &&
        call[0].includes("/runs") &&
        call[1]?.method === "POST",
    );
    expect(postCall).toBeTruthy();
  });

  test("Run Team button shows error when trigger fails", async () => {
    // Override POST to fail
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.includes("/runs") && method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({ error: "Project has no team assigned" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        // Return defaults for other requests
        if (urlStr.endsWith("/api/projects/proj-1") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(mockProject), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        if (urlStr.endsWith("/api/teams/team-1") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(mockTeam), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    );

    renderProjectDetail("proj-1");

    await waitFor(() => {
      const button = screen.getByTestId(
        "run-team-button",
      ) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    fireEvent.click(screen.getByTestId("run-team-button"));

    await waitFor(() => {
      expect(screen.getByTestId("trigger-error")).toBeTruthy();
      expect(
        screen.getByText("Project has no team assigned"),
      ).toBeTruthy();
    });
  });
});
