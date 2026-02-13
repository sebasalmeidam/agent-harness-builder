import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import ProjectDetailPage from "./ProjectDetailPage";

const mockProject = {
  id: "test-project",
  name: "Test Project",
  description: "A test project description",
  spec: "Build a web application",
  teamId: "my-team",
  gitUrl: null,
  emoji: "\u{1F680}",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockProjectNoTeam = {
  id: "no-team-project",
  name: "No Team Project",
  description: "Project without a team",
  spec: "",
  teamId: null,
  gitUrl: null,
  emoji: "\u{1F4E6}",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockProjectNoEmoji = {
  id: "no-emoji-project",
  name: "No Emoji Project",
  description: "Project without emoji field",
  spec: "",
  teamId: null,
  gitUrl: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockTeam = {
  id: "my-team",
  name: "My Team",
  description: "A great team",
  agents: [
    {
      id: "agent-1",
      name: "Dev",
      emoji: "",
      role: "Developer",
      goal: "Build",
      skills: [],
      practices: [],
      position: { x: 0, y: 0 },
    },
    {
      id: "agent-2",
      name: "QA",
      emoji: "",
      role: "Tester",
      goal: "Test",
      skills: [],
      practices: [],
      position: { x: 0, y: 0 },
    },
  ],
  edges: [],
};

const mockTeamsList = [
  { id: "my-team", name: "My Team", description: "A great team", agentCount: 2 },
  {
    id: "other-team",
    name: "Other Team",
    description: "Another team",
    agentCount: 3,
  },
];

function renderProjectDetail(projectId: string) {
  const router = createMemoryRouter(
    [
      { path: "/projects/:id", element: <ProjectDetailPage /> },
      { path: "/projects", element: <div>Projects List Page</div> },
      { path: "/teams/:id", element: <div>Team Detail Page</div> },
    ],
    { initialEntries: [`/projects/${projectId}`] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    // GET /api/projects/test-project
    if (urlStr.endsWith("/api/projects/test-project") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockProject), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/projects/no-team-project
    if (
      urlStr.endsWith("/api/projects/no-team-project") &&
      method === "GET"
    ) {
      return Promise.resolve(
        new Response(JSON.stringify(mockProjectNoTeam), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/projects/no-emoji-project
    if (
      urlStr.endsWith("/api/projects/no-emoji-project") &&
      method === "GET"
    ) {
      return Promise.resolve(
        new Response(JSON.stringify(mockProjectNoEmoji), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // GET /api/projects/not-found
    if (urlStr.endsWith("/api/projects/not-found") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
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

    // PATCH /api/projects/:id
    if (urlStr.includes("/api/projects/") && method === "PATCH") {
      const patchBody = JSON.parse(init?.body as string);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...mockProject,
            ...patchBody,
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

    // GET /api/teams/my-team
    if (urlStr.endsWith("/api/teams/my-team") && method === "GET") {
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

    // GET /api/projects/:id/runs (list runs)
    if (urlStr.match(/\/api\/projects\/[^/]+\/runs$/) && method === "GET") {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            {
              id: "run-hist-1",
              status: "completed",
              startedAt: "2025-06-15T10:00:00.000Z",
              completedAt: "2025-06-15T10:02:30.000Z",
              error: null,
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
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProjectDetailPage", () => {
  test("shows loading state while fetching", () => {
    renderProjectDetail("test-project");
    expect(screen.getByText("Loading project...")).toBeTruthy();
  });

  test("renders project data after loading", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      const nameInput = screen.getByLabelText(
        "Project name",
      ) as HTMLInputElement;
      expect(nameInput.value).toBe("Test Project");
    });

    const descInput = screen.getByLabelText(
      "Project description",
    ) as HTMLInputElement;
    expect(descInput.value).toBe("A test project description");
    expect(screen.getByText("Projects")).toBeTruthy();
  });

  test("renders breadcrumb with project name", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByText("Projects")).toBeTruthy();
      // Project name in breadcrumb (non-link span)
      expect(screen.getByText("Test Project")).toBeTruthy();
    });
  });

  test("renders error when project not found", async () => {
    renderProjectDetail("not-found");

    await waitFor(() => {
      expect(screen.getByText("Project not found")).toBeTruthy();
    });

    expect(screen.getByText("Back to Projects")).toBeTruthy();
  });

  test("renders project emoji in header next to the project name", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      const emojiEl = screen.getByTestId("project-emoji");
      expect(emojiEl).toBeTruthy();
      expect(emojiEl.textContent).toBe("\u{1F680}");
      expect(emojiEl.className).toContain("text-[32px]");
    });
  });

  test("renders default package emoji when project has no emoji field", async () => {
    renderProjectDetail("no-emoji-project");

    await waitFor(() => {
      const emojiEl = screen.getByTestId("project-emoji");
      expect(emojiEl).toBeTruthy();
      expect(emojiEl.textContent).toBe("\u{1F4E6}");
    });
  });

  test("renders spec textarea with existing spec value", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      const textarea = screen.getByLabelText(
        /Project Specification/,
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe("Build a web application");
    });
  });
});

describe("Spec editor", () => {
  test("spec textarea saves on button click", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByLabelText(/Project Specification/)).toBeTruthy();
    });

    const textarea = screen.getByLabelText(
      /Project Specification/,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: "Updated spec content" },
    });

    // Dirty indicator should appear
    await waitFor(() => {
      expect(screen.getByTestId("dirty-indicator")).toBeTruthy();
    });

    // Click Save Spec button
    fireEvent.click(screen.getByText("Save Spec"));

    await waitFor(() => {
      expect(screen.getByText("Spec saved successfully")).toBeTruthy();
    });

    // Verify PUT was called with correct spec
    const putCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    const body = JSON.parse(putCall![1]!.body as string);
    expect(body.spec).toBe("Updated spec content");
  });

  test("save button is disabled when spec is not dirty", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByText("Save Spec")).toBeTruthy();
    });

    const saveButton = screen.getByText("Save Spec").closest("button")!;
    expect(saveButton.disabled).toBe(true);
  });

  test("dirty indicator disappears after saving", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByLabelText(/Project Specification/)).toBeTruthy();
    });

    const textarea = screen.getByLabelText(/Project Specification/);
    fireEvent.change(textarea, {
      target: { value: "Changed spec" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("dirty-indicator")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Save Spec"));

    await waitFor(() => {
      expect(screen.queryByTestId("dirty-indicator")).toBeFalsy();
    });
  });
});

describe("Assigned team", () => {
  test("displays assigned team when teamId is set", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByText("My Team")).toBeTruthy();
    });

    expect(screen.getByText("2 agents")).toBeTruthy();
  });

  test("displays empty state when no team assigned", async () => {
    renderProjectDetail("no-team-project");

    await waitFor(() => {
      expect(
        screen.getByText("No team assigned to this project."),
      ).toBeTruthy();
    });
  });

  test("shows Assign Team button when no team", async () => {
    renderProjectDetail("no-team-project");

    await waitFor(() => {
      expect(screen.getByText("Assign Team")).toBeTruthy();
    });
  });

  test("shows Change Team button when team is assigned", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByText("Change Team")).toBeTruthy();
    });
  });

  test("Assign Team button opens modal", async () => {
    renderProjectDetail("no-team-project");

    await waitFor(() => {
      expect(screen.getByText("Assign Team")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Assign Team"));

    await waitFor(() => {
      expect(screen.getByTestId("assign-team-modal")).toBeTruthy();
    });
  });
});

describe("Delete project", () => {
  test("renders Delete button", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeTruthy();
    });
  });

  test("delete with confirmation navigates to /projects", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { router } = renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/projects");
    });

    // Verify DELETE was called
    const deleteCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "DELETE",
    );
    expect(deleteCall).toBeTruthy();
  });

  test("delete cancelled does not call DELETE API", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Delete"));

    const deleteCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "DELETE",
    );
    expect(deleteCall).toBeFalsy();
  });
});

describe("Past Executions", () => {
  test("renders Past Executions heading on project detail page", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Past Executions" }),
      ).toBeTruthy();
    });
  });

  test("renders RunHistoryList with past runs", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByTestId("run-history-list")).toBeTruthy();
    });

    // Should show the mock run entry
    expect(screen.getByTestId("run-entry-run-hist-1")).toBeTruthy();
    expect(screen.getByTestId("run-status-run-hist-1").textContent).toBe(
      "Completed",
    );
  });

  test("renders empty state for project with no runs", async () => {
    // Override the fetch to return empty runs for no-team-project
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (
          urlStr.endsWith("/api/projects/no-team-project") &&
          method === "GET"
        ) {
          return Promise.resolve(
            new Response(JSON.stringify(mockProjectNoTeam), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (
          urlStr.match(/\/api\/projects\/[^/]+\/runs$/) &&
          method === "GET"
        ) {
          return Promise.resolve(
            new Response(JSON.stringify([]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (urlStr.endsWith("/api/teams") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(mockTeamsList), {
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

    renderProjectDetail("no-team-project");

    await waitFor(() => {
      expect(screen.getByTestId("run-history-empty")).toBeTruthy();
    });

    expect(screen.getByText("No past executions yet.")).toBeTruthy();
  });
});

describe("Inline editing", () => {
  test("name input renders with current project name value", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      const nameInput = screen.getByLabelText(
        "Project name",
      ) as HTMLInputElement;
      expect(nameInput.value).toBe("Test Project");
    });
  });

  test("description input renders with current project description value", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      const descInput = screen.getByLabelText(
        "Project description",
      ) as HTMLInputElement;
      expect(descInput.value).toBe("A test project description");
    });
  });

  test("editing name and blurring triggers PATCH call with only name field", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByLabelText("Project name")).toBeTruthy();
    });

    const nameInput = screen.getByLabelText(
      "Project name",
    ) as HTMLInputElement;
    fireEvent.change(nameInput, {
      target: { value: "Updated Project Name" },
    });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any[]) => call[1]?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse(patchCall![1]!.body as string);
      expect(body).toEqual({ name: "Updated Project Name" });
    });
  });

  test("editing description and blurring triggers PATCH call with only description field", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByLabelText("Project description")).toBeTruthy();
    });

    const descInput = screen.getByLabelText(
      "Project description",
    ) as HTMLInputElement;
    fireEvent.change(descInput, { target: { value: "New description" } });
    fireEvent.blur(descInput);

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any[]) => call[1]?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse(patchCall![1]!.body as string);
      expect(body).toEqual({ description: "New description" });
    });
  });

  test("breadcrumb updates when name changes", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByText("Test Project")).toBeTruthy();
    });

    const nameInput = screen.getByLabelText(
      "Project name",
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Renamed Project" } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      // After PATCH response, project.name updates and breadcrumb reflects it
      expect(screen.getByText("Renamed Project")).toBeTruthy();
    });
  });

  test("save error displays error message", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByLabelText("Project name")).toBeTruthy();
    });

    // Override fetch to return error for PATCH
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.includes("/api/projects/") && method === "PATCH") {
          return Promise.resolve(
            new Response(
              JSON.stringify({ error: "name must be a non-empty string" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        // Fallback for other requests
        if (
          urlStr.endsWith("/api/projects/test-project") &&
          method === "GET"
        ) {
          return Promise.resolve(
            new Response(JSON.stringify(mockProject), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (urlStr.endsWith("/api/teams/my-team") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(mockTeam), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (
          urlStr.match(/\/api\/projects\/[^/]+\/runs$/) &&
          method === "GET"
        ) {
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
      },
    );

    const nameInput = screen.getByLabelText(
      "Project name",
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Bad Name" } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
      expect(
        screen.getByText("name must be a non-empty string"),
      ).toBeTruthy();
    });
  });

  test("blurring name without changes does not trigger PATCH", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByLabelText("Project name")).toBeTruthy();
    });

    const nameInput = screen.getByLabelText(
      "Project name",
    ) as HTMLInputElement;
    // Blur without changing value
    fireEvent.blur(nameInput);

    // Wait a tick and verify no PATCH was made
    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any[]) => call[1]?.method === "PATCH",
      );
      expect(patchCall).toBeUndefined();
    });
  });

  test("empty name reverts to previous value on blur without calling PATCH", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByLabelText("Project name")).toBeTruthy();
    });

    const nameInput = screen.getByLabelText(
      "Project name",
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "  " } });
    fireEvent.blur(nameInput);

    // Should revert to original name
    await waitFor(() => {
      expect(nameInput.value).toBe("Test Project");
    });

    // No PATCH should have been called
    const patchCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "PATCH",
    );
    expect(patchCall).toBeUndefined();
  });
});
