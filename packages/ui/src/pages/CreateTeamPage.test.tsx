import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import CreateTeamPage from "./CreateTeamPage";

function renderCreateTeam() {
  const router = createMemoryRouter(
    [
      { path: "/teams/new", element: <CreateTeamPage /> },
      { path: "/teams", element: <div>Teams List Page</div> },
      { path: "/teams/:id", element: <div>Team Detail Page</div> },
    ],
    { initialEntries: ["/teams/new"] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    // POST /api/teams - success by default
    if (urlStr.endsWith("/api/teams") && method === "POST") {
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
            agents: [],
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

describe("CreateTeamPage", () => {
  test("(1) renders the form with correct fields", () => {
    renderCreateTeam();

    expect(screen.getByRole("heading", { name: "Create Team" })).toBeTruthy();
    expect(screen.getByLabelText(/Team Name/)).toBeTruthy();
    expect(screen.getByLabelText(/Description/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Team" })).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  test("(2) submitting with empty name shows inline error text and red border class", async () => {
    renderCreateTeam();

    const submitButton = screen.getByText("Create Team", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Team name is required")).toBeTruthy();
    });

    // Verify the input has the border-error class
    const nameInput = screen.getByLabelText(/Team Name/);
    expect(nameInput.className).toContain("border-error");

    // Fetch should not have been called
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("(3) submitting with whitespace-only name shows inline error", async () => {
    renderCreateTeam();

    const nameInput = screen.getByLabelText(/Team Name/);
    fireEvent.change(nameInput, { target: { value: "   " } });

    const submitButton = screen.getByText("Create Team", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Team name is required")).toBeTruthy();
    });

    expect(nameInput.className).toContain("border-error");
  });

  test("(4) form does not call fetch when validation fails", async () => {
    renderCreateTeam();

    const submitButton = screen.getByText("Create Team", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Team name is required")).toBeTruthy();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("(5) successful creation navigates to team detail", async () => {
    const { router } = renderCreateTeam();

    const nameInput = screen.getByLabelText(/Team Name/);
    fireEvent.change(nameInput, { target: { value: "My New Team" } });

    const descInput = screen.getByLabelText(/Description/);
    fireEvent.change(descInput, {
      target: { value: "A great team" },
    });

    const submitButton = screen.getByText("Create Team", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/teams/my-new-team");
    });

    // Verify the correct data was sent
    expect(fetchMock).toHaveBeenCalledWith("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My New Team",
        description: "A great team",
      }),
    });
  });

  test("(6) server error (409 duplicate) displays in the banner", async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.endsWith("/api/teams") && method === "POST") {
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

    renderCreateTeam();

    const nameInput = screen.getByLabelText(/Team Name/);
    fireEvent.change(nameInput, { target: { value: "Duplicate Team" } });

    const submitButton = screen.getByText("Create Team", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("A team with this name already exists"),
      ).toBeTruthy();
    });

    // The error should be in the ErrorCard banner, not inline
    const errorBanner = screen.getByText("A team with this name already exists");
    expect(errorBanner.className).toContain("text-error");
  });

  test("(7) cancel link points to /teams", () => {
    renderCreateTeam();

    const cancelLink = screen.getByText("Cancel");
    expect(cancelLink.closest("a")?.getAttribute("href")).toBe("/teams");
  });

  test("(8) typing in the name field after validation failure clears the inline error text and removes the red border class", async () => {
    renderCreateTeam();

    // First trigger the validation error
    const submitButton = screen.getByText("Create Team", {
      selector: "button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Team name is required")).toBeTruthy();
    });

    const nameInput = screen.getByLabelText(/Team Name/);
    expect(nameInput.className).toContain("border-error");

    // Now type in the field
    fireEvent.change(nameInput, { target: { value: "A" } });

    // The error text should be gone
    await waitFor(() => {
      expect(screen.queryByText("Team name is required")).toBeNull();
    });

    // The border-error class should be removed
    expect(nameInput.className).not.toContain("border-error");
    expect(nameInput.className).toContain("border-border");
  });
});
