import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import RunHistoryList from "./RunHistoryList";

// --- Mock data ---

const mockRuns = [
  {
    id: "run-abc-123",
    status: "completed",
    startedAt: "2025-06-15T10:00:00.000Z",
    completedAt: "2025-06-15T10:02:30.000Z",
    error: null,
  },
  {
    id: "run-def-456",
    status: "failed",
    startedAt: "2025-06-14T09:00:00.000Z",
    completedAt: "2025-06-14T09:01:00.000Z",
    error: "SDK error",
  },
  {
    id: "run-ghi-789",
    status: "running",
    startedAt: "2025-06-16T12:00:00.000Z",
    completedAt: null,
    error: null,
  },
];

// --- Test helpers ---

let fetchMock: ReturnType<typeof vi.fn>;

function renderRunHistoryList(
  projectId: string,
  fetchImpl?: typeof fetchMock,
) {
  if (fetchImpl) {
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchImpl);
  }

  const router = createMemoryRouter(
    [
      {
        path: "/projects/:id",
        element: <RunHistoryList projectId={projectId} />,
      },
      {
        path: "/projects/:id/runs/:runId",
        element: <div data-testid="execution-page">Execution Page</div>,
      },
    ],
    { initialEntries: [`/projects/${projectId}`] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    // GET /api/projects/:id/runs (list)
    if (urlStr.includes("/api/projects/proj-1/runs") && !urlStr.includes("/runs/")) {
      return Promise.resolve(
        new Response(JSON.stringify(mockRuns), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/projects/proj-empty/runs (empty list)
    if (urlStr.includes("/api/projects/proj-empty/runs")) {
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/projects/proj-error/runs (server error)
    if (urlStr.includes("/api/projects/proj-error/runs")) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/projects/proj-corrupt/runs (corrupted data)
    if (urlStr.includes("/api/projects/proj-corrupt/runs")) {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            { id: "valid-run", status: "completed", startedAt: "2025-01-01T00:00:00.000Z", completedAt: "2025-01-01T00:01:00.000Z", error: null },
            { broken: true },
            null,
            { id: "another-valid", status: "failed", startedAt: "2025-01-02T00:00:00.000Z", completedAt: null, error: "err" },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
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

// --- RunHistoryList tests ---

describe("RunHistoryList", () => {
  test("shows loading state initially", () => {
    renderRunHistoryList("proj-1");
    expect(screen.getByTestId("run-history-loading")).toBeTruthy();
    expect(screen.getByText("Loading execution history...")).toBeTruthy();
  });

  test("renders run entries with status badges and dates", async () => {
    renderRunHistoryList("proj-1");

    await waitFor(() => {
      expect(screen.getByTestId("run-history-list")).toBeTruthy();
    });

    // Should render 3 entries
    expect(screen.getByTestId("run-entry-run-abc-123")).toBeTruthy();
    expect(screen.getByTestId("run-entry-run-def-456")).toBeTruthy();
    expect(screen.getByTestId("run-entry-run-ghi-789")).toBeTruthy();

    // Check status badges
    expect(screen.getByTestId("run-status-run-abc-123").textContent).toBe("Completed");
    expect(screen.getByTestId("run-status-run-def-456").textContent).toBe("Failed");
    expect(screen.getByTestId("run-status-run-ghi-789").textContent).toBe("Running");
  });

  test("shows truncated run IDs", async () => {
    renderRunHistoryList("proj-1");

    await waitFor(() => {
      expect(screen.getByTestId("run-history-list")).toBeTruthy();
    });

    // IDs should be truncated to 8 characters
    expect(screen.getByText("run-abc-")).toBeTruthy();
    expect(screen.getByText("run-def-")).toBeTruthy();
  });

  test("shows duration for completed runs", async () => {
    renderRunHistoryList("proj-1");

    await waitFor(() => {
      expect(screen.getByTestId("run-history-list")).toBeTruthy();
    });

    // run-abc-123: 2m 30s
    expect(screen.getByText("2m 30s")).toBeTruthy();
    // run-def-456: 1m 0s
    expect(screen.getByText("1m 0s")).toBeTruthy();
    // run-ghi-789: still running
    expect(screen.getByText("In progress")).toBeTruthy();
  });

  test("shows empty state when no runs exist", async () => {
    renderRunHistoryList("proj-empty");

    await waitFor(() => {
      expect(screen.getByTestId("run-history-empty")).toBeTruthy();
    });

    expect(screen.getByText("No past executions yet.")).toBeTruthy();
  });

  test("shows error state when fetch fails", async () => {
    renderRunHistoryList("proj-error");

    await waitFor(() => {
      expect(screen.getByTestId("run-history-error")).toBeTruthy();
    });
  });

  test("clicking an entry navigates to the run detail page", async () => {
    const { router } = renderRunHistoryList("proj-1");

    await waitFor(() => {
      expect(screen.getByTestId("run-entry-run-abc-123")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("run-entry-run-abc-123"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/projects/proj-1/runs/run-abc-123",
      );
    });
  });

  test("gracefully handles corrupted run data", async () => {
    renderRunHistoryList("proj-corrupt");

    await waitFor(() => {
      expect(screen.getByTestId("run-history-list")).toBeTruthy();
    });

    // Only valid entries should be rendered (2 out of 4)
    expect(screen.getByTestId("run-entry-valid-run")).toBeTruthy();
    expect(screen.getByTestId("run-entry-another-valid")).toBeTruthy();

    // Total entries should be 2
    const entries = screen.getAllByRole("button");
    expect(entries.length).toBe(2);
  });
});
