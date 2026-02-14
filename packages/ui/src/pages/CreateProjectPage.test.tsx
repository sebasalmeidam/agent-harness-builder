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
            path: body.path,
            emoji: body.emoji ?? "\u{1F4E6}",
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
    expect(screen.getByLabelText(/Emoji/)).toBeTruthy();
    expect(screen.getByLabelText(/Project Name/)).toBeTruthy();
    expect(screen.getByLabelText(/Description/)).toBeTruthy();
    expect(screen.getByLabelText(/Project Path/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  test("emoji field has default package emoji", () => {
    renderCreateProject();

    const emojiTrigger = screen.getByTestId("emoji-picker-trigger");
    expect(emojiTrigger.textContent).toBe("\u{1F4E6}");
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

  test("validates path is required on submit", async () => {
    renderCreateProject();

    const nameInput = screen.getByLabelText(/Project Name/);
    fireEvent.change(nameInput, { target: { value: "My Project" } });

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Project path is required")).toBeTruthy();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("successful creation navigates to project detail", async () => {
    const { router } = renderCreateProject();

    const nameInput = screen.getByLabelText(/Project Name/);
    fireEvent.change(nameInput, { target: { value: "My New Project" } });

    const descInput = screen.getByLabelText(/Description/);
    fireEvent.change(descInput, {
      target: { value: "A great project" },
    });

    const pathInput = screen.getByLabelText(/Project Path/);
    fireEvent.change(pathInput, {
      target: { value: "/home/user/projects/my-app" },
    });

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/projects/my-new-project");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My New Project",
        description: "A great project",
        emoji: "\u{1F4E6}",
        path: "/home/user/projects/my-app",
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

    const pathInput = screen.getByLabelText(/Project Path/);
    fireEvent.change(pathInput, { target: { value: "/home/user/dup" } });

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

  test("shows server error for invalid path", async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/projects") && method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: "Path must be an absolute path",
              }),
              {
                status: 400,
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
    fireEvent.change(nameInput, { target: { value: "Bad Path Project" } });

    const pathInput = screen.getByLabelText(/Project Path/);
    fireEvent.change(pathInput, { target: { value: "relative/path" } });

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Path must be an absolute path"),
      ).toBeTruthy();
    });
  });

  test("cancel link navigates to projects list", () => {
    renderCreateProject();

    const cancelLink = screen.getByText("Cancel");
    expect(cancelLink.closest("a")?.getAttribute("href")).toBe("/projects");
  });

  test("renders the path field with helper text", () => {
    renderCreateProject();

    expect(screen.getByLabelText(/Project Path/)).toBeTruthy();
    expect(
      screen.getByPlaceholderText("/home/user/projects/my-app"),
    ).toBeTruthy();
    expect(
      screen.getByText("Absolute path to the local project directory"),
    ).toBeTruthy();
  });

  test("submission includes custom emoji when changed", async () => {
    const { router } = renderCreateProject();

    const emojiTrigger = screen.getByTestId("emoji-picker-trigger");
    fireEvent.click(emojiTrigger);

    await waitFor(() => {
      expect(screen.getByTestId("emoji-picker-popover")).toBeTruthy();
    });

    const rocketEmoji = screen.getByTestId("emoji-\u{1F680}");
    fireEvent.click(rocketEmoji);

    const nameInput = screen.getByLabelText(/Project Name/);
    fireEvent.change(nameInput, { target: { value: "Rocket Project" } });

    const pathInput = screen.getByLabelText(/Project Path/);
    fireEvent.change(pathInput, { target: { value: "/home/user/rocket" } });

    const submitButton = screen.getByText("Create Project", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/projects/rocket-project");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Rocket Project",
        description: "",
        emoji: "\u{1F680}",
        path: "/home/user/rocket",
      }),
    });
  });
});
