import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import ProjectDetailPage from "./ProjectDetailPage";

const mockProject = {
  id: "test-project",
  name: "Test Project",
  description: "A test project description",
  path: "/home/user/projects/test",
  emoji: "\u{1F680}",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockProjectNoPath = {
  id: "no-path-project",
  name: "No Path Project",
  description: "Project without a path",
  path: "",
  emoji: "\u{1F4E6}",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockProjectNoEmoji = {
  id: "no-emoji-project",
  name: "No Emoji Project",
  description: "Project without emoji field",
  path: "/home/user/projects/no-emoji",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function renderProjectDetail(projectId: string) {
  const router = createMemoryRouter(
    [
      { path: "/projects/:id", element: <ProjectDetailPage /> },
      { path: "/projects", element: <div>Projects List Page</div> },
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

    // GET /api/projects/no-path-project
    if (
      urlStr.endsWith("/api/projects/no-path-project") &&
      method === "GET"
    ) {
      return Promise.resolve(
        new Response(JSON.stringify(mockProjectNoPath), {
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

  test("displays project path as read-only", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      const pathEl = screen.getByTestId("project-path");
      expect(pathEl).toBeTruthy();
      expect(pathEl.textContent).toBe("/home/user/projects/test");
    });
  });

  test("shows path not configured for projects without path", async () => {
    renderProjectDetail("no-path-project");

    await waitFor(() => {
      expect(screen.getByText("Path not configured")).toBeTruthy();
    });
  });

  test("renders Project Path heading", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Project Path" }),
      ).toBeTruthy();
    });
  });

  test("renders Tasks section with empty state", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Tasks" }),
      ).toBeTruthy();
    });

    expect(screen.getByTestId("tasks-empty-state")).toBeTruthy();
    expect(screen.getByText("No tasks yet")).toBeTruthy();
  });

  test("does not render spec editor or team section", async () => {
    renderProjectDetail("test-project");

    await waitFor(() => {
      expect(screen.getByLabelText("Project name")).toBeTruthy();
    });

    // Spec editor should not exist
    expect(screen.queryByLabelText(/Project Specification/)).toBeNull();
    expect(screen.queryByText("Save Spec")).toBeNull();

    // Team section should not exist
    expect(screen.queryByText("Assigned Team")).toBeNull();
    expect(screen.queryByText("Assign Team")).toBeNull();

    // Run button should not exist
    expect(screen.queryByText("Run Team")).toBeNull();

    // Past Executions should not exist
    expect(screen.queryByText("Past Executions")).toBeNull();
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
    fireEvent.blur(nameInput);

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

    await waitFor(() => {
      expect(nameInput.value).toBe("Test Project");
    });

    const patchCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "PATCH",
    );
    expect(patchCall).toBeUndefined();
  });
});
