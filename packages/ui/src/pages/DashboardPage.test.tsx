import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import DashboardPage from "./DashboardPage";

const sampleProjects = [
  {
    id: "project-alpha",
    name: "Project Alpha",
    description: "First project",
    teamId: "team-one",
    createdAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "project-beta",
    name: "Project Beta",
    description: "Second project",
    teamId: null,
    createdAt: "2025-01-02T00:00:00.000Z",
  },
];

const sampleTeams = [
  {
    id: "team-one",
    name: "Team One",
    description: "First team",
    agentCount: 3,
  },
  {
    id: "team-two",
    name: "Team Two",
    description: "Second team",
    agentCount: 1,
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

    expect(screen.getByText("Team assigned")).toBeTruthy();
    expect(screen.getByText("No team assigned")).toBeTruthy();
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
      expect(screen.getByText("First team")).toBeTruthy();
      expect(screen.getByText("Team Two")).toBeTruthy();
      expect(screen.getByText("Second team")).toBeTruthy();
    });

    expect(screen.getByText("3 agents")).toBeTruthy();
    expect(screen.getByText("1 agent")).toBeTruthy();
  });

  test("shows empty state for projects section", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(
          "No projects yet. Create your first project to get started.",
        ),
      ).toBeTruthy();
    });
  });

  test("shows empty state for teams section", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(
          "No teams yet. Create your first team to get started.",
        ),
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
      screen.getByText(
        "No teams yet. Create your first team to get started.",
      ),
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
      screen.getByText(
        "No projects yet. Create your first project to get started.",
      ),
    ).toBeTruthy();
  });
});
