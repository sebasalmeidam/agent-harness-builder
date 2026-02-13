import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import AssignTeamModal from "./AssignTeamModal";

const mockTeamsList = [
  {
    id: "team-alpha",
    name: "Team Alpha",
    description: "Alpha team",
    agentCount: 2,
  },
  {
    id: "team-beta",
    name: "Team Beta",
    description: "Beta team",
    agentCount: 5,
  },
];

function renderModal(props?: Partial<Parameters<typeof AssignTeamModal>[0]>) {
  const defaultProps = {
    projectId: "test-project",
    currentTeamId: null,
    onAssigned: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };

  // Wrap in router since the parent page uses it
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AssignTeamModal {...defaultProps} />,
      },
    ],
    { initialEntries: ["/"] },
  );

  return {
    ...defaultProps,
    ...render(<RouterProvider router={router} />),
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    // GET /api/teams
    if (urlStr.endsWith("/api/teams") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockTeamsList), {
          status: 200,
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
            id: "test-project",
            name: "Test Project",
            description: "",
            spec: "",
            teamId: body.teamId,
            gitUrl: null,
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: new Date().toISOString(),
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
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AssignTeamModal", () => {
  test("renders modal with heading", async () => {
    renderModal();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Assign Team" }),
      ).toBeTruthy();
    });
  });

  test("shows loading state while fetching teams", () => {
    renderModal();
    expect(screen.getByText("Loading teams...")).toBeTruthy();
  });

  test("renders team list after loading", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeTruthy();
      expect(screen.getByText("Team Beta")).toBeTruthy();
    });

    expect(screen.getByText("2 agents")).toBeTruthy();
    expect(screen.getByText("5 agents")).toBeTruthy();
  });

  test("shows empty state when no teams exist", async () => {
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

        return Promise.resolve(
          new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
          }),
        );
      },
    );

    renderModal();

    await waitFor(() => {
      expect(
        screen.getByText("No teams available. Create a team first."),
      ).toBeTruthy();
    });
  });

  test("selecting a team and confirming calls PUT with teamId", async () => {
    const onAssigned = vi.fn();
    renderModal({ onAssigned });

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeTruthy();
    });

    // Select Team Alpha
    const radioAlpha = screen.getByDisplayValue("team-alpha");
    fireEvent.click(radioAlpha);

    // Click Assign Team button
    const assignButton = screen.getByRole("button", { name: "Assign Team" });
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(onAssigned).toHaveBeenCalledWith("team-alpha");
    });

    // Verify PUT was called with correct teamId
    const putCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    const body = JSON.parse(putCall![1]!.body as string);
    expect(body.teamId).toBe("team-alpha");
  });

  test("cancel closes modal without saving", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeTruthy();
    });

    // Click Cancel button
    fireEvent.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalledOnce();

    // Verify no PUT was called
    const putCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "PUT",
    );
    expect(putCall).toBeFalsy();
  });

  test("close button (X) closes modal", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await waitFor(() => {
      expect(screen.getByTitle("Close")).toBeTruthy();
    });

    fireEvent.click(screen.getByTitle("Close"));

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("Assign Team button is disabled when no team selected", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeTruthy();
    });

    const assignButton = screen.getByRole("button", { name: "Assign Team" });
    expect(assignButton).toHaveProperty("disabled", true);
  });

  test("pre-selects current team when provided", async () => {
    renderModal({ currentTeamId: "team-beta" });

    await waitFor(() => {
      expect(screen.getByText("Team Beta")).toBeTruthy();
    });

    const radioBeta = screen.getByDisplayValue(
      "team-beta",
    ) as HTMLInputElement;
    expect(radioBeta.checked).toBe(true);
  });
});
