import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { test, expect, vi, beforeEach, afterEach, describe } from "vitest";
import TeamDetailPage, {
  nodesToAgents,
  flowEdgesToTeamEdges,
} from "./TeamDetailPage";
import type { Node, Edge } from "@xyflow/react";

// Mock ResizeObserver which React Flow requires
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock DOMMatrixReadOnly which React Flow requires for transforms
class DOMMatrixReadOnlyMock {
  m22: number;
  constructor() {
    this.m22 = 1;
  }
  inverse() {
    return new DOMMatrixReadOnlyMock();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).DOMMatrixReadOnly = DOMMatrixReadOnlyMock;

const mockTeam = {
  id: "test-team",
  name: "Test Team",
  description: "A test team",
  agents: [
    {
      id: "agent-1",
      name: "Architect",
      emoji: "\uD83D\uDC68\u200D\uD83D\uDCBB",
      role: "Lead Architect",
      goal: "Design systems",
      skills: ["design"],
      practices: ["review"],
      position: { x: 100, y: 200 },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "agent-1",
      target: "agent-2",
      type: "reviews",
      label: "reviews",
      failureRouting: "loop-back",
      gate: { type: "auto" },
    },
  ],
};

const emptyTeam = {
  id: "empty-team",
  name: "Empty Team",
  description: "An empty team",
  agents: [],
  edges: [],
};

function renderTeamDetail(teamId: string) {
  const router = createMemoryRouter(
    [
      { path: "teams/:id", element: <TeamDetailPage /> },
      { path: "teams", element: <div>Teams List</div> },
    ],
    { initialEntries: [`/teams/${teamId}`] },
  );
  return render(<RouterProvider router={router} />);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    if (urlStr.includes("/api/teams/test-team") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(mockTeam), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    if (urlStr.includes("/api/teams/test-team") && method === "PUT") {
      const body = JSON.parse(init?.body as string);
      return Promise.resolve(
        new Response(JSON.stringify({ ...body, id: "test-team" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    if (urlStr.includes("/api/teams/test-team") && method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (urlStr.includes("/api/teams/empty-team") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(emptyTeam), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    if (urlStr.includes("/api/teams/not-found")) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Team not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    if (urlStr.includes("/api/teams/save-error") && method === "GET") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "save-error",
            name: "Save Error Team",
            description: "",
            agents: [],
            edges: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    if (urlStr.includes("/api/teams/save-error") && method === "PUT") {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Server error" }), {
          status: 500,
          statusText: "Internal Server Error",
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

// --- Existing tests ---

test("displays loading state while fetching", () => {
  renderTeamDetail("test-team");

  expect(screen.getByText("Loading team...")).toBeTruthy();
});

test("renders team name in breadcrumb after loading", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    expect(screen.getByText("Teams")).toBeTruthy();
  });

  // Team name appears in breadcrumb
  await waitFor(() => {
    const breadcrumbSpan = screen.getByText("Test Team");
    expect(breadcrumbSpan).toBeTruthy();
  });
});

test("renders agent count in header", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    expect(screen.getByText(/1 agent/)).toBeTruthy();
  });
});

test("renders canvas container", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    expect(screen.getByTestId("team-canvas")).toBeTruthy();
  });
});

test("renders Add Agent button", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    expect(screen.getByText("Add Agent")).toBeTruthy();
  });
});

test("clicking Add Agent increments agent count", async () => {
  renderTeamDetail("test-team");

  await waitFor(() => {
    expect(screen.getByText(/1 agent/)).toBeTruthy();
  });

  fireEvent.click(screen.getByText("Add Agent"));

  await waitFor(() => {
    expect(screen.getByText(/2 agents/)).toBeTruthy();
  });
});

test("renders error message when team not found", async () => {
  renderTeamDetail("not-found");

  await waitFor(() => {
    expect(screen.getByText("Team not found")).toBeTruthy();
  });

  expect(screen.getByText("Back to Teams")).toBeTruthy();
});

test("renders empty canvas for team with no agents", async () => {
  renderTeamDetail("empty-team");

  await waitFor(() => {
    expect(screen.getByText(/0 agents/)).toBeTruthy();
  });

  expect(screen.getByTestId("team-canvas")).toBeTruthy();
});

test("adding agent to empty team updates count correctly", async () => {
  renderTeamDetail("empty-team");

  await waitFor(() => {
    expect(screen.getByText(/0 agents/)).toBeTruthy();
  });

  fireEvent.click(screen.getByText("Add Agent"));

  await waitFor(() => {
    expect(screen.getByText(/1 agent/)).toBeTruthy();
  });
});

// --- Phase 6 Tests ---

describe("Save functionality", () => {
  test("renders Save button", async () => {
    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByText("Save")).toBeTruthy();
    });
  });

  test("Save button triggers PUT request with serialized data", async () => {
    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByText("Save")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Team saved successfully")).toBeTruthy();
    });

    // Verify PUT was called
    const putCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "PUT",
    );
    expect(putCall).toBeTruthy();

    const body = JSON.parse(putCall![1]!.body as string);
    expect(body.id).toBe("test-team");
    expect(body.agents).toBeInstanceOf(Array);
    expect(body.edges).toBeInstanceOf(Array);
  });

  test("displays error message when save fails", async () => {
    renderTeamDetail("save-error");

    await waitFor(() => {
      expect(screen.getByText("Save")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to save team: Internal Server Error"),
      ).toBeTruthy();
    });
  });

  test("shows Saving... while save is in progress", async () => {
    // Create a delayed PUT response
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const method = init?.method ?? "GET";

        if (urlStr.includes("/api/teams/test-team") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(mockTeam), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (urlStr.includes("/api/teams/test-team") && method === "PUT") {
          return new Promise((resolve) => {
            setTimeout(() => {
              const body = JSON.parse(init?.body as string);
              resolve(
                new Response(
                  JSON.stringify({ ...body, id: "test-team" }),
                  {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                  },
                ),
              );
            }, 100);
          });
        }

        return Promise.resolve(
          new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
          }),
        );
      },
    );

    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByText("Save")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Saving...")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Team saved successfully")).toBeTruthy();
    });
  });
});

describe("isDirty indicator", () => {
  test("isDirty indicator appears after adding an agent", async () => {
    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByText("Add Agent")).toBeTruthy();
    });

    // Wait for initial load to complete
    await new Promise((r) => setTimeout(r, 50));

    fireEvent.click(screen.getByText("Add Agent"));

    await waitFor(() => {
      expect(screen.getByTestId("dirty-indicator")).toBeTruthy();
    });
  });

  test("isDirty indicator disappears after saving", async () => {
    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByText("Add Agent")).toBeTruthy();
    });

    // Wait for initial load to complete
    await new Promise((r) => setTimeout(r, 50));

    fireEvent.click(screen.getByText("Add Agent"));

    await waitFor(() => {
      expect(screen.getByTestId("dirty-indicator")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.queryByTestId("dirty-indicator")).toBeFalsy();
    });
  });

  test("isDirty indicator appears when name is changed", async () => {
    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByLabelText("Team name")).toBeTruthy();
    });

    // Wait for initial load to complete
    await new Promise((r) => setTimeout(r, 50));

    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "Updated Name" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("dirty-indicator")).toBeTruthy();
    });
  });
});

describe("Team metadata editing", () => {
  test("renders editable name and description fields", async () => {
    renderTeamDetail("test-team");

    await waitFor(() => {
      const nameInput = screen.getByLabelText("Team name");
      expect(nameInput).toBeTruthy();
      expect((nameInput as HTMLInputElement).value).toBe("Test Team");
    });

    const descInput = screen.getByLabelText("Team description");
    expect(descInput).toBeTruthy();
    expect((descInput as HTMLTextAreaElement).value).toBe("A test team");
  });

  test("changing name updates the breadcrumb", async () => {
    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByLabelText("Team name")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "Updated Team" },
    });

    await waitFor(() => {
      expect(screen.getByText("Updated Team")).toBeTruthy();
    });
  });

  test("metadata changes are included in save payload", async () => {
    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByLabelText("Team name")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "New Name" },
    });

    fireEvent.change(screen.getByLabelText("Team description"), {
      target: { value: "New description" },
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Team saved successfully")).toBeTruthy();
    });

    const putCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "PUT",
    );
    const body = JSON.parse(putCall![1]!.body as string);
    expect(body.name).toBe("New Name");
    expect(body.description).toBe("New description");
  });
});

describe("Delete team from detail page", () => {
  test("renders Delete button", async () => {
    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeTruthy();
    });
  });

  test("delete with confirmation calls DELETE API and redirects", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      // Verify DELETE was called
      const deleteCall = fetchMock.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any[]) => call[1]?.method === "DELETE",
      );
      expect(deleteCall).toBeTruthy();
    });

    // Verify redirect to teams list
    await waitFor(() => {
      expect(screen.getByText("Teams List")).toBeTruthy();
    });
  });

  test("delete cancelled does not call DELETE API", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Delete"));

    // Verify DELETE was NOT called
    const deleteCall = fetchMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[1]?.method === "DELETE",
    );
    expect(deleteCall).toBeFalsy();
  });
});

describe("beforeunload warning", () => {
  test("beforeunload handler is registered when isDirty", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    renderTeamDetail("test-team");

    await waitFor(() => {
      expect(screen.getByText("Add Agent")).toBeTruthy();
    });

    // Check that beforeunload listener was added
    const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
      (call) => call[0] === "beforeunload",
    );
    expect(beforeUnloadCalls.length).toBeGreaterThan(0);

    addEventListenerSpy.mockRestore();
  });
});

// --- Serialization unit tests ---

describe("nodesToAgents", () => {
  test("converts React Flow nodes to team agents array", () => {
    const nodes: Node[] = [
      {
        id: "agent-1",
        type: "agent",
        position: { x: 150, y: 300 },
        data: {
          name: "Architect",
          emoji: "\uD83D\uDC68\u200D\uD83D\uDCBB",
          role: "Lead",
          goal: "Design",
          skills: ["design"],
          practices: ["review"],
        },
      },
    ];

    const agents = nodesToAgents(nodes);

    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe("agent-1");
    expect(agents[0].name).toBe("Architect");
    expect(agents[0].emoji).toBe("\uD83D\uDC68\u200D\uD83D\uDCBB");
    expect(agents[0].role).toBe("Lead");
    expect(agents[0].goal).toBe("Design");
    expect(agents[0].skills).toEqual(["design"]);
    expect(agents[0].practices).toEqual(["review"]);
    expect(agents[0].position).toEqual({ x: 150, y: 300 });
  });

  test("preserves all agent properties in round-trip", () => {
    const nodes: Node[] = [
      {
        id: "test-id",
        type: "agent",
        position: { x: 42, y: 84 },
        data: {
          name: "Dev",
          emoji: "\uD83E\uDD16",
          role: "Developer",
          goal: "Build features",
          skills: ["ts", "react"],
          practices: ["tdd", "pairing"],
        },
      },
    ];

    const agents = nodesToAgents(nodes);
    expect(agents[0].position.x).toBe(42);
    expect(agents[0].position.y).toBe(84);
    expect(agents[0].skills).toEqual(["ts", "react"]);
    expect(agents[0].practices).toEqual(["tdd", "pairing"]);
  });
});

describe("flowEdgesToTeamEdges", () => {
  test("converts React Flow edges to team edges array", () => {
    const edges: Edge[] = [
      {
        id: "edge-1",
        source: "agent-1",
        target: "agent-2",
        type: "workflow",
        label: "reviews",
        data: {
          type: "reviews",
          failureRouting: "loop-back",
          gate: { type: "auto" },
        },
      },
    ];

    const teamEdges = flowEdgesToTeamEdges(edges);

    expect(teamEdges).toHaveLength(1);
    expect(teamEdges[0].id).toBe("edge-1");
    expect(teamEdges[0].source).toBe("agent-1");
    expect(teamEdges[0].target).toBe("agent-2");
    expect(teamEdges[0].type).toBe("reviews");
    expect(teamEdges[0].label).toBe("reviews");
    expect(teamEdges[0].failureRouting).toBe("loop-back");
    expect(teamEdges[0].gate).toEqual({ type: "auto" });
  });

  test("defaults edge type to passes-work-to when data is missing", () => {
    const edges: Edge[] = [
      {
        id: "edge-1",
        source: "a",
        target: "b",
        type: "workflow",
      },
    ];

    const teamEdges = flowEdgesToTeamEdges(edges);

    expect(teamEdges[0].type).toBe("passes-work-to");
    expect(teamEdges[0].failureRouting).toBeNull();
    expect(teamEdges[0].gate).toBeNull();
  });

  test("preserves all edge data types in conversion", () => {
    const edges: Edge[] = [
      {
        id: "e1",
        source: "a",
        target: "b",
        type: "workflow",
        label: "escalates to",
        data: {
          type: "escalates-to",
          failureRouting: null,
          gate: { type: "manual" },
        },
      },
    ];

    const teamEdges = flowEdgesToTeamEdges(edges);
    expect(teamEdges[0].type).toBe("escalates-to");
    expect(teamEdges[0].gate).toEqual({ type: "manual" });
    expect(teamEdges[0].failureRouting).toBeNull();
  });
});
