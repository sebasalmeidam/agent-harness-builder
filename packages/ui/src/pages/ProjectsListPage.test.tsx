import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import ProjectsListPage from "./ProjectsListPage";

function renderProjectsList(fetchImpl?: typeof fetch) {
  if (fetchImpl) {
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchImpl);
  }
  const router = createMemoryRouter(
    [
      { path: "/projects", element: <ProjectsListPage /> },
      { path: "/projects/new", element: <div>New Project Page</div> },
      { path: "/projects/:id", element: <div>Project Detail Page</div> },
    ],
    { initialEntries: ["/projects"] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    // GET /api/projects - return empty list by default
    if (urlStr.endsWith("/api/projects") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // DELETE /api/projects/:id - success
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectsListPage", () => {
  test("renders the heading", async () => {
    renderProjectsList();

    await waitFor(() => {
      expect(screen.getByText("Projects")).toBeTruthy();
    });
  });

  test("renders New Project card", async () => {
    renderProjectsList();

    await waitFor(() => {
      expect(screen.getByText("New Project")).toBeTruthy();
    });
  });

  test("renders empty state when no projects exist", async () => {
    renderProjectsList();

    await waitFor(() => {
      expect(
        screen.getByText(
          "No projects yet. Create your first project to get started.",
        ),
      ).toBeTruthy();
    });
  });

  test("renders project cards when projects exist", async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/projects") && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: "my-project",
                  name: "My Project",
                  description: "A test project",
                  teamId: null,
                  createdAt: "2025-01-01T00:00:00.000Z",
                },
                {
                  id: "another-project",
                  name: "Another Project",
                  description: "Another test",
                  teamId: "some-team",
                  createdAt: "2025-01-02T00:00:00.000Z",
                },
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
          }),
        );
      },
    );

    renderProjectsList();

    await waitFor(() => {
      expect(screen.getByText("My Project")).toBeTruthy();
      expect(screen.getByText("A test project")).toBeTruthy();
      expect(screen.getByText("Another Project")).toBeTruthy();
      expect(screen.getByText("Another test")).toBeTruthy();
    });

    // Check team status metadata
    expect(screen.getByText("No team assigned")).toBeTruthy();
    expect(screen.getByText("Team assigned")).toBeTruthy();
  });

  test("delete removes project from list after confirmation", async () => {
    // Mock window.confirm to return true
    vi.spyOn(window, "confirm").mockReturnValue(true);

    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/projects") && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: "delete-me",
                  name: "Delete Me",
                  description: "To be deleted",
                  teamId: null,
                  createdAt: "2025-01-01T00:00:00.000Z",
                },
              ]),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        if (
          urlStr.includes("/api/projects/delete-me") &&
          method === "DELETE"
        ) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        return Promise.resolve(
          new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
          }),
        );
      },
    );

    renderProjectsList();

    await waitFor(() => {
      expect(screen.getByText("Delete Me")).toBeTruthy();
    });

    // Click the delete button
    const deleteButton = screen.getByTitle("Delete project");
    deleteButton.click();

    await waitFor(() => {
      expect(screen.queryByText("Delete Me")).toBeNull();
    });
  });

  test("shows loading state", () => {
    renderProjectsList();
    expect(screen.getByText("Loading projects...")).toBeTruthy();
  });

  test("shows error state on fetch failure", async () => {
    fetchMock.mockImplementation(() => {
      return Promise.resolve(
        new Response(null, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );
    });

    renderProjectsList();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to fetch projects: Internal Server Error"),
      ).toBeTruthy();
    });

    // Should show Retry button
    expect(screen.getByText("Retry")).toBeTruthy();
  });
});
