import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import TeamDetailPage from "./TeamDetailPage";

// Mock ResizeObserver which React Flow requires
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

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

const mockTeam = {
  id: "test-team",
  name: "Test Team",
  description: "A test team",
  agents: [
    {
      id: "agent-1",
      name: "Architect",
      emoji: "\uD83D\uDC68\u200D\uD83D\uDCBB",
      role: "Lead Architect",
      goal: "Design systems",
      skills: ["design"],
      practices: ["review"],
      position: { x: 100, y: 200 },
    },
  ],
  edges: [],
};

const emptyTeam = {
  id: "empty-team",
  name: "Empty Team",
  description: "An empty team",
  agents: [],
  edges: [],
};

function renderTeamDetail(teamId: string) {
  return render(
    <MemoryRouter initialEntries={[`/teams/${teamId}`]}>
      <Routes>
        <Route path="teams/:id" element={<TeamDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    if (urlStr.includes("/api/teams/test-team")) {
      return Promise.resolve(
        new Response(JSON.stringify(mockTeam), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    if (urlStr.includes("/api/teams/empty-team")) {
      return Promise.resolve(
        new Response(JSON.stringify(emptyTeam), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    if (urlStr.includes("/api/teams/not-found")) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Team not found" }), {
          status: 404,
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
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("displays loading state while fetching", () => {
  renderTeamDetail("test-team");

  expect(screen.getByText("Loading team...")).toBeTruthy();
});

test("renders team name in breadcrumb and header after loading", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    // Team name appears in both breadcrumb and header
    const teamNameElements = screen.getAllByText("Test Team");
    expect(teamNameElements.length).toBe(2);
  });

  // Breadcrumb contains "Teams" link
  expect(screen.getByText("Teams")).toBeTruthy();
});

test("renders agent count in header", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    expect(screen.getByText("1 agent")).toBeTruthy();
  });
});

test("renders canvas container", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    expect(screen.getByTestId("team-canvas")).toBeTruthy();
  });
});

test("renders Add Agent button", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    expect(screen.getByText("Add Agent")).toBeTruthy();
  });
});

test("clicking Add Agent increments agent count", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    expect(screen.getByText("1 agent")).toBeTruthy();
  });

  fireEvent.click(screen.getByText("Add Agent"));

  await waitFor(() => {
    expect(screen.getByText("2 agents")).toBeTruthy();
  });
});

test("renders error message when team not found", async () => {
  renderTeamDetail("not-found");

  await waitFor(() => {
    expect(screen.getByText("Team not found")).toBeTruthy();
  });

  expect(screen.getByText("Back to Teams")).toBeTruthy();
});

test("renders empty canvas for team with no agents", async () => {
  renderTeamDetail("empty-team");

  await waitFor(() => {
    expect(screen.getByText("0 agents")).toBeTruthy();
  });

  expect(screen.getByTestId("team-canvas")).toBeTruthy();
});

test("adding agent to empty team updates count correctly", async () => {
  renderTeamDetail("empty-team");

  await waitFor(() => {
    expect(screen.getByText("0 agents")).toBeTruthy();
  });

  fireEvent.click(screen.getByText("Add Agent"));

  await waitFor(() => {
    expect(screen.getByText("1 agent")).toBeTruthy();
  });
});
