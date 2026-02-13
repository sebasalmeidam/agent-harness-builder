import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import CreateProjectPage from "./CreateProjectPage";

function renderCreateProject() {
  const router = createMemoryRouter(
    [
      { path: "/projects/new", element: <CreateProjectPage /> },
      { path: "/projects", element: <div>Projects List Page</div> },
      { path: "/projects/:id", element: <div>Project Detail Page</div> },
    ],
    { initialEntries: ["/projects/new"] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    // POST /api/projects - success by default
    if (urlStr.endsWith("/api/projects") && method === "POST") {
      const body = JSON.parse(init?.body as string);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: body.name
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9\s-]/g, "")
              .replace(/\s+/g, "-"),
            name: body.name,
            description: body.description ?? "",
            spec: "",
            teamId: null,
            gitUrl: null,
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
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

describe("CreateProjectPage", () => {
  test("renders the form with correct fields", () => {
    renderCreateProject();

    expect(screen.getByRole("heading", { name: "Create Project" })).toBeTruthy();
    expect(screen.getByLabelText(/Project Name/)).toBeTruthy();
    expect(screen.getByLabelText(/Description/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  test("validates name is required on submit", async () => {
    renderCreateProject();

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Project name is required")).toBeTruthy();
    });

    // Fetch should not have been called
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("validates name with only whitespace", async () => {
    renderCreateProject();

    const nameInput = screen.getByLabelText(/Project Name/);
    fireEvent.change(nameInput, { target: { value: "   " } });

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Project name is required")).toBeTruthy();
    });
  });

  test("successful creation navigates to project detail", async () => {
    const { router } = renderCreateProject();

    const nameInput = screen.getByLabelText(/Project Name/);
    fireEvent.change(nameInput, { target: { value: "My New Project" } });

    const descInput = screen.getByLabelText(/Description/);
    fireEvent.change(descInput, {
      target: { value: "A great project" },
    });

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/projects/my-new-project");
    });

    // Verify the correct data was sent
    expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My New Project",
        description: "A great project",
      }),
    });
  });

  test("shows server error on 409 duplicate", async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/projects") && method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: "A project with this name already exists",
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

    renderCreateProject();

    const nameInput = screen.getByLabelText(/Project Name/);
    fireEvent.change(nameInput, { target: { value: "Duplicate Project" } });

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("A project with this name already exists"),
      ).toBeTruthy();
    });
  });

  test("cancel link navigates to projects list", () => {
    renderCreateProject();

    const cancelLink = screen.getByText("Cancel");
    expect(cancelLink.closest("a")?.getAttribute("href")).toBe("/projects");
  });

  test("renders the git URL field", () => {
    renderCreateProject();

    expect(screen.getByLabelText(/Git Repository URL/)).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "https://github.com/user/repo (optional)",
      ),
    ).toBeTruthy();
  });

  test("submission includes gitUrl when provided", async () => {
    const { router } = renderCreateProject();

    const nameInput = screen.getByLabelText(/Project Name/);
    fireEvent.change(nameInput, { target: { value: "Git Project" } });

    const gitUrlInput = screen.getByLabelText(/Git Repository URL/);
    fireEvent.change(gitUrlInput, {
      target: { value: "https://github.com/octocat/Hello-World.git" },
    });

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/projects/git-project");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Git Project",
        description: "",
        gitUrl: "https://github.com/octocat/Hello-World.git",
      }),
    });
  });

  test("submission works without gitUrl", async () => {
    const { router } = renderCreateProject();

    const nameInput = screen.getByLabelText(/Project Name/);
    fireEvent.change(nameInput, { target: { value: "No Git" } });

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/projects/no-git");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "No Git",
        description: "",
      }),
    });
  });
});
