import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import SkillsPage from "./SkillsPage";

function renderSkillsPage() {
  const router = createMemoryRouter(
    [{ path: "/skills", element: <SkillsPage /> }],
    { initialEntries: ["/skills"] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    // GET /api/skills - return empty list by default
    if (urlStr.endsWith("/api/skills") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // POST /api/skills - create skill
    if (urlStr.endsWith("/api/skills") && method === "POST") {
      const body = JSON.parse(init?.body as string);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "skill-1",
            name: body.name,
            description: body.description,
            instructions: body.instructions,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    // GET /api/skills/:id - return full skill
    const getSkillMatch = urlStr.match(/\/api\/skills\/([^/]+)$/);
    if (getSkillMatch && method === "GET") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: getSkillMatch[1],
            name: "TypeScript Expert",
            description: "Advanced TypeScript knowledge",
            instructions: "You are an expert in TypeScript",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    // PUT /api/skills/:id - update skill
    const putSkillMatch = urlStr.match(/\/api\/skills\/([^/]+)$/);
    if (putSkillMatch && method === "PUT") {
      const body = JSON.parse(init?.body as string);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: putSkillMatch[1],
            name: body.name ?? "TypeScript Expert",
            description: body.description ?? "Advanced TypeScript knowledge",
            instructions:
              body.instructions ?? "You are an expert in TypeScript",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    // DELETE /api/skills/:id - delete skill
    const deleteSkillMatch = urlStr.match(/\/api\/skills\/([^/]+)$/);
    if (deleteSkillMatch && method === "DELETE") {
      return Promise.resolve(
        new Response(null, {
          status: 204,
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

describe("SkillsPage", () => {
  test("renders empty state when no skills exist", async () => {
    renderSkillsPage();

    await waitFor(() => {
      expect(
        screen.getByText("No skills yet. Create your first skill to get started."),
      ).toBeTruthy();
    });
  });

  test("renders list of skills", async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/skills") && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: "skill-1",
                  name: "TypeScript Expert",
                  description: "Advanced TypeScript knowledge",
                },
                {
                  id: "skill-2",
                  name: "React Specialist",
                  description: "Deep React expertise",
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

    renderSkillsPage();

    await waitFor(() => {
      expect(screen.getByText("TypeScript Expert")).toBeTruthy();
      expect(screen.getByText("Advanced TypeScript knowledge")).toBeTruthy();
      expect(screen.getByText("React Specialist")).toBeTruthy();
      expect(screen.getByText("Deep React expertise")).toBeTruthy();
    });
  });

  test("shows loading state initially", () => {
    renderSkillsPage();
    expect(screen.getByText("Loading skills...")).toBeTruthy();
  });

  test("opens create form when Create Skill button clicked", async () => {
    renderSkillsPage();

    await waitFor(() => {
      expect(screen.getByText("Create Skill")).toBeTruthy();
    });

    const createButton = screen.getByText("Create Skill");
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toBeTruthy();
      expect(screen.getByLabelText("Description")).toBeTruthy();
      expect(screen.getByLabelText("Instructions")).toBeTruthy();
    });
  });

  test("creates a new skill successfully", async () => {
    renderSkillsPage();

    await waitFor(() => {
      expect(screen.getByText("Create Skill")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Create Skill"));

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Python Expert" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Advanced Python skills" },
    });
    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "You are a Python expert" },
    });

    const submitButton = screen.getByRole("button", { name: "Create Skill" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Python Expert")).toBeTruthy();
    });
  });

  test("shows error when creating skill with duplicate name", async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/skills") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify([]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (urlStr.endsWith("/api/skills") && method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({ error: "A skill with this name already exists" }),
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

    renderSkillsPage();

    await waitFor(() => {
      expect(screen.getByText("Create Skill")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Create Skill"));

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Duplicate Skill" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "This will fail" },
    });
    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "Instructions" },
    });

    const submitButton = screen.getByRole("button", { name: "Create Skill" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("A skill with this name already exists"),
      ).toBeTruthy();
    });
  });

  test("opens edit form with pre-populated values when skill clicked", async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/skills") && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: "skill-1",
                  name: "TypeScript Expert",
                  description: "Advanced TypeScript knowledge",
                },
              ]),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        const getSkillMatch = urlStr.match(/\/api\/skills\/([^/]+)$/);
        if (getSkillMatch && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "skill-1",
                name: "TypeScript Expert",
                description: "Advanced TypeScript knowledge",
                instructions: "You are an expert in TypeScript",
              }),
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

    renderSkillsPage();

    await waitFor(() => {
      expect(screen.getByText("TypeScript Expert")).toBeTruthy();
    });

    const editButton = screen.getByTitle("Edit skill");
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue("TypeScript Expert")).toBeTruthy();
      expect(
        screen.getByDisplayValue("Advanced TypeScript knowledge"),
      ).toBeTruthy();
      expect(
        screen.getByDisplayValue("You are an expert in TypeScript"),
      ).toBeTruthy();
    });
  });

  test("updates skill successfully", async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/skills") && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: "skill-1",
                  name: "TypeScript Expert",
                  description: "Advanced TypeScript knowledge",
                },
              ]),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        const getSkillMatch = urlStr.match(/\/api\/skills\/([^/]+)$/);
        if (getSkillMatch && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "skill-1",
                name: "TypeScript Expert",
                description: "Advanced TypeScript knowledge",
                instructions: "You are an expert in TypeScript",
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        const putSkillMatch = urlStr.match(/\/api\/skills\/([^/]+)$/);
        if (putSkillMatch && method === "PUT") {
          const body = JSON.parse(init?.body as string);
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "skill-1",
                name: body.name,
                description: body.description,
                instructions: body.instructions,
              }),
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

    renderSkillsPage();

    await waitFor(() => {
      expect(screen.getByText("TypeScript Expert")).toBeTruthy();
    });

    const editButton = screen.getByTitle("Edit skill");
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue("TypeScript Expert")).toBeTruthy();
    });

    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, {
      target: { value: "TypeScript Master" },
    });

    const submitButton = screen.getByRole("button", { name: "Save Changes" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("TypeScript Master")).toBeTruthy();
    });
  });

  test("deletes skill with confirmation", async () => {
    // Mock window.confirm
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);

    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/skills") && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: "skill-1",
                  name: "TypeScript Expert",
                  description: "Advanced TypeScript knowledge",
                },
              ]),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        const deleteSkillMatch = urlStr.match(/\/api\/skills\/([^/]+)$/);
        if (deleteSkillMatch && method === "DELETE") {
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        return Promise.resolve(
          new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
          }),
        );
      },
    );

    renderSkillsPage();

    await waitFor(() => {
      expect(screen.getByText("TypeScript Expert")).toBeTruthy();
    });

    const deleteButton = screen.getByTitle("Delete skill");
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete "TypeScript Expert"? This skill will be removed from all agents that use it. This cannot be undone.',
    );

    await waitFor(() => {
      expect(
        screen.getByText("No skills yet. Create your first skill to get started."),
      ).toBeTruthy();
    });

    confirmSpy.mockRestore();
  });

  test("cancels delete when confirmation declined", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);

    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/skills") && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: "skill-1",
                  name: "TypeScript Expert",
                  description: "Advanced TypeScript knowledge",
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

    renderSkillsPage();

    await waitFor(() => {
      expect(screen.getByText("TypeScript Expert")).toBeTruthy();
    });

    const deleteButton = screen.getByTitle("Delete skill");
    fireEvent.click(deleteButton);

    // Skill should still be visible
    expect(screen.getByText("TypeScript Expert")).toBeTruthy();

    confirmSpy.mockRestore();
  });

  test("shows error message on failed fetch", async () => {
    fetchMock.mockImplementation(() => {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Server error" }), {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    renderSkillsPage();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to fetch skills: Internal Server Error"),
      ).toBeTruthy();
    });
  });

  test("cancel button closes create form", async () => {
    renderSkillsPage();

    await waitFor(() => {
      expect(screen.getByText("Create Skill")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Create Skill"));

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toBeTruthy();
    });

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByLabelText("Name")).toBeNull();
    });
  });
});
