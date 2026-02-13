import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import TeamsListPage from "./TeamsListPage";

function renderTeamsList() {
  const router = createMemoryRouter(
    [
      { path: "/teams", element: <TeamsListPage /> },
      { path: "/teams/new", element: <div>New Team Page</div> },
      { path: "/teams/:id", element: <div>Team Detail Page</div> },
    ],
    { initialEntries: ["/teams"] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    // GET /api/teams - return empty list by default
    if (urlStr.endsWith("/api/teams") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // POST /api/teams/import - success by default
    if (urlStr.endsWith("/api/teams/import") && method === "POST") {
      const body = JSON.parse(init?.body as string);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "imported-team",
            name: body.name,
            description: body.description ?? "",
            agents: body.agents ?? [],
            edges: body.edges ?? [],
          }),
          {
            status: 201,
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

describe("TeamsListPage Import", () => {
  test("renders Import Harness button", async () => {
    renderTeamsList();

    await waitFor(() => {
      expect(screen.getByText("Import Harness")).toBeTruthy();
    });
  });

  test("renders hidden file input for import", async () => {
    renderTeamsList();

    await waitFor(() => {
      expect(screen.getByTestId("import-file-input")).toBeTruthy();
    });

    const input = screen.getByTestId("import-file-input") as HTMLInputElement;
    expect(input.type).toBe("file");
    expect(input.accept).toBe(".json,.harness.json");
  });

  test("successful import navigates to new team page", async () => {
    const { router } = renderTeamsList();

    await waitFor(() => {
      expect(screen.getByText("Import Harness")).toBeTruthy();
    });

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;

    const validHarness = {
      harnessVersion: "1.0",
      name: "My Imported Team",
      description: "A test import",
      agents: [
        {
          id: "agent-1",
          name: "Dev",
          emoji: "",
          role: "developer",
          goal: "Build",
          skills: [],
          practices: [],
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    };

    const file = new File(
      [JSON.stringify(validHarness)],
      "test.harness.json",
      { type: "application/json" },
    );

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/teams/imported-team");
    });
  });

  test("409 error shows duplicate team name message", async () => {
    // Override import endpoint to return 409
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/teams") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify([]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (urlStr.endsWith("/api/teams/import") && method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: "A team with this name already exists",
              }),
              {
                status: 409,
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

    renderTeamsList();

    await waitFor(() => {
      expect(screen.getByText("Import Harness")).toBeTruthy();
    });

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;

    const harness = {
      harnessVersion: "1.0",
      name: "Duplicate Team",
      description: "",
      agents: [
        {
          id: "a1",
          name: "Agent",
          emoji: "",
          role: "",
          goal: "",
          skills: [],
          practices: [],
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    };

    const file = new File(
      [JSON.stringify(harness)],
      "dup.harness.json",
      { type: "application/json" },
    );

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("A team with this name already exists")).toBeTruthy();
    });
  });

  test("invalid JSON file shows error message", async () => {
    renderTeamsList();

    await waitFor(() => {
      expect(screen.getByText("Import Harness")).toBeTruthy();
    });

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;

    const file = new File(
      ["this is not valid json {{{"],
      "bad.json",
      { type: "application/json" },
    );

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Invalid JSON file")).toBeTruthy();
    });
  });
});
