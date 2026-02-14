import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import DashboardPage from "./DashboardPage";

const sampleProjects = [
  {
    id: "project-alpha",
    name: "Project Alpha",
    description: "First project",
    emoji: "\uD83D\uDE80",
    path: "/home/user/alpha",
    taskCount: 5,
    pathExists: true,
    createdAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "project-beta",
    name: "Project Beta",
    description: "Second project",
    emoji: "\uD83D\uDCE6",
    path: "/home/user/beta",
    taskCount: 0,
    pathExists: true,
    createdAt: "2025-01-02T00:00:00.000Z",
  },
];

const sampleTeams = [
  {
    id: "team-one",
    name: "Team One",
    description: "First team",
    agentCount: 3,
    agentEmojis: ["\uD83E\uDD16", "\uD83D\uDC7E", "\uD83E\uDDD1\u200D\uD83D\uDCBB"],
  },
  {
    id: "team-two",
    name: "Team Two",
    description: "Second team",
    agentCount: 1,
    agentEmojis: ["\uD83E\uDD16"],
  },
];

function renderDashboard() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <DashboardPage /> },
      { path: "/projects/new", element: <div>New Project Page</div> },
      { path: "/projects/:id", element: <div>Project Detail Page</div> },
      { path: "/teams/new", element: <div>New Team Page</div> },
      { path: "/teams/:id", element: <div>Team Detail Page</div> },
    ],
    { initialEntries: ["/"] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    if (urlStr.endsWith("/api/projects")) {
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    if (urlStr.endsWith("/api/teams")) {
      return Promise.resolve(
        new Response(JSON.stringify([]), {
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
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardPage", () => {
  test("renders welcome header", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Welcome back" }),
      ).toBeTruthy();
    });

    expect(
      screen.getByText("Here is an overview of your projects and teams."),
    ).toBeTruthy();
  });

  test("renders My Projects and My Teams section headings", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "My Projects" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("heading", { name: "My Teams" }),
      ).toBeTruthy();
    });
  });

  test("renders project cards when projects exist", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects")) {
        return Promise.resolve(
          new Response(JSON.stringify(sampleProjects), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (urlStr.endsWith("/api/teams")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Project Alpha")).toBeTruthy();
      expect(screen.getByText("First project")).toBeTruthy();
      expect(screen.getByText("Project Beta")).toBeTruthy();
      expect(screen.getByText("Second project")).toBeTruthy();
    });

    // Project cards show emoji
    expect(screen.getByText("\uD83D\uDE80")).toBeTruthy();
    expect(screen.getByText("\uD83D\uDCE6")).toBeTruthy();

    // Project cards show task count
    expect(screen.getByText("5 tasks")).toBeTruthy();
    expect(screen.getByText("0 tasks")).toBeTruthy();
  });

  test("renders team cards when teams exist", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (urlStr.endsWith("/api/teams")) {
        return Promise.resolve(
          new Response(JSON.stringify(sampleTeams), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Team One")).toBeTruthy();
      expect(screen.getByText("Team Two")).toBeTruthy();
    });

    // Team cards show agent emojis (robot emoji appears in both teams)
    expect(screen.getAllByText("\uD83E\uDD16").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("\uD83D\uDC7E")).toBeTruthy();

    // Team cards show agent count
    expect(screen.getByText("3 agents")).toBeTruthy();
    expect(screen.getByText("1 agent")).toBeTruthy();
  });

  test("team card shows overflow badge when more than 4 agents", async () => {
    const overflowTeams = [
      {
        id: "team-overflow",
        name: "Big Team",
        description: "A large team",
        agentCount: 6,
        agentEmojis: [
          "\uD83E\uDD16",
          "\uD83D\uDC7E",
          "\uD83E\uDDD1\u200D\uD83D\uDCBB",
          "\uD83E\uDDB8",
          "\uD83E\uDDD9",
          "\uD83E\uDDDA",
        ],
      },
    ];

    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (urlStr.endsWith("/api/teams")) {
        return Promise.resolve(
          new Response(JSON.stringify(overflowTeams), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Big Team")).toBeTruthy();
    });

    // First 3 emojis rendered
    expect(screen.getByText("\uD83E\uDD16")).toBeTruthy();
    expect(screen.getByText("\uD83D\uDC7E")).toBeTruthy();
    expect(screen.getByText("\uD83E\uDDD1\u200D\uD83D\uDCBB")).toBeTruthy();

    // Overflow badge: +3 (6 total - 3 shown)
    expect(screen.getByText("+3")).toBeTruthy();

    // Agent count still shown
    expect(screen.getByText("6 agents")).toBeTruthy();
  });

  test("shows empty state for projects section", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText("Create your first project"),
      ).toBeTruthy();
    });
  });

  test("shows empty state for teams section", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText("Create your first team"),
      ).toBeTruthy();
    });
  });

  test("project card links to /projects/:id", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects")) {
        return Promise.resolve(
          new Response(JSON.stringify(sampleProjects), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (urlStr.endsWith("/api/teams")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
    });

    const { router } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Project Alpha")).toBeTruthy();
    });

    screen.getByText("Project Alpha").click();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/projects/project-alpha");
    });
  });

  test("team card links to /teams/:id", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (urlStr.endsWith("/api/teams")) {
        return Promise.resolve(
          new Response(JSON.stringify(sampleTeams), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
    });

    const { router } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Team One")).toBeTruthy();
    });

    screen.getByText("Team One").click();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/teams/team-one");
    });
  });

  test("New Project button links to /projects/new", async () => {
    const { router } = renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Welcome back" }),
      ).toBeTruthy();
    });

    const newProjectLink = screen.getByRole("link", { name: /New Project/ });
    expect(newProjectLink).toBeTruthy();

    newProjectLink.click();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/projects/new");
    });
  });

  test("New Team button links to /teams/new", async () => {
    const { router } = renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Welcome back" }),
      ).toBeTruthy();
    });

    const newTeamLink = screen.getByRole("link", { name: /New Team/ });
    expect(newTeamLink).toBeTruthy();

    newTeamLink.click();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/teams/new");
    });
  });

  test("shows error for projects section when fetch fails", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects")) {
        return Promise.resolve(
          new Response(null, {
            status: 500,
            statusText: "Internal Server Error",
          }),
        );
      }

      if (urlStr.endsWith("/api/teams")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
    });

    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Failed to fetch projects: Internal Server Error",
        ),
      ).toBeTruthy();
    });

    // Teams section should still render its empty state
    expect(
      screen.getByText("Create your first team"),
    ).toBeTruthy();
  });

  test("shows error for teams section when fetch fails", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (urlStr.endsWith("/api/teams")) {
        return Promise.resolve(
          new Response(null, {
            status: 500,
            statusText: "Internal Server Error",
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
    });

    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to fetch teams: Internal Server Error"),
      ).toBeTruthy();
    });

    // Projects section should still render its empty state
    expect(
      screen.getByText("Create your first project"),
    ).toBeTruthy();
  });

  test("shows + New Project dashed card when projects exist", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects")) {
        return Promise.resolve(
          new Response(JSON.stringify(sampleProjects), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (urlStr.endsWith("/api/teams")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
    });

    const { router } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Project Alpha")).toBeTruthy();
    });

    // The "+ New Project" dashed card appears after project cards
    const newProjectCard = screen.getByText("+ New Project");
    expect(newProjectCard).toBeTruthy();

    // Clicking it navigates to /projects/new
    newProjectCard.click();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/projects/new");
    });
  });

  test("empty state project card does not show + New Project card", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText("Create your first project"),
      ).toBeTruthy();
    });

    // The "+ New Project" card should NOT appear in empty state
    expect(screen.queryByText("+ New Project")).toBeNull();
  });
});
