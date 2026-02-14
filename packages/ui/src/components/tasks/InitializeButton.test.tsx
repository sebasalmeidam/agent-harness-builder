import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import InitializeButton from "./InitializeButton";

const mockSuggestions = [
  {
    title: "Implement authentication",
    description: "Add user login and registration",
    checklist: [
      { description: "Create login form" },
      { description: "Add JWT validation" },
      { description: "Write tests" },
    ],
  },
  {
    title: "Setup database",
    description: "Configure database connections",
    checklist: [
      { description: "Install database driver" },
      { description: "Create schema" },
      { description: "Add migrations" },
    ],
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    if (
      urlStr.endsWith("/api/projects/project-1/initialize") &&
      method === "POST"
    ) {
      return Promise.resolve(
        new Response(JSON.stringify({ suggestions: mockSuggestions }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InitializeButton", () => {
  test("renders button when task count is 0", () => {
    const onSuggestionsReceived = vi.fn();
    render(
      <InitializeButton
        projectId="project-1"
        taskCount={0}
        onSuggestionsReceived={onSuggestionsReceived}
      />
    );

    expect(screen.getByTestId("initialize-button")).toBeTruthy();
    expect(screen.getByText("Initialize Project")).toBeTruthy();
  });

  test("does not render when task count is greater than 0", () => {
    const onSuggestionsReceived = vi.fn();
    render(
      <InitializeButton
        projectId="project-1"
        taskCount={1}
        onSuggestionsReceived={onSuggestionsReceived}
      />
    );

    expect(screen.queryByTestId("initialize-button")).toBeNull();
  });

  test("shows loading state when clicked", async () => {
    const onSuggestionsReceived = vi.fn();
    render(
      <InitializeButton
        projectId="project-1"
        taskCount={0}
        onSuggestionsReceived={onSuggestionsReceived}
      />
    );

    const button = screen.getByTestId("initialize-button") as HTMLButtonElement;
    fireEvent.click(button);

    expect(screen.getByText("Analyzing project...")).toBeTruthy();
    expect(button.disabled).toBe(true);

    await waitFor(() => {
      expect(onSuggestionsReceived).toHaveBeenCalled();
    });
  });

  test("calls API and passes suggestions to callback on success", async () => {
    const onSuggestionsReceived = vi.fn();
    render(
      <InitializeButton
        projectId="project-1"
        taskCount={0}
        onSuggestionsReceived={onSuggestionsReceived}
      />
    );

    fireEvent.click(screen.getByTestId("initialize-button"));

    await waitFor(() => {
      expect(onSuggestionsReceived).toHaveBeenCalledWith(mockSuggestions);
    });

    const postCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === "POST"
    );
    expect(postCall).toBeTruthy();
    expect(postCall![0]).toContain("/api/projects/project-1/initialize");
  });

  test("shows error message when API key is missing (400)", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects/project-1/initialize")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          )
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
      );
    });

    const onSuggestionsReceived = vi.fn();
    render(
      <InitializeButton
        projectId="project-1"
        taskCount={0}
        onSuggestionsReceived={onSuggestionsReceived}
      />
    );

    fireEvent.click(screen.getByTestId("initialize-button"));

    await waitFor(() => {
      expect(screen.getByTestId("initialize-error")).toBeTruthy();
    });

    expect(
      screen.getByText("ANTHROPIC_API_KEY not configured")
    ).toBeTruthy();
    expect(onSuggestionsReceived).not.toHaveBeenCalled();
  });

  test("shows error message on timeout (504)", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects/project-1/initialize")) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Timeout" }), {
            status: 504,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
      );
    });

    const onSuggestionsReceived = vi.fn();
    render(
      <InitializeButton
        projectId="project-1"
        taskCount={0}
        onSuggestionsReceived={onSuggestionsReceived}
      />
    );

    fireEvent.click(screen.getByTestId("initialize-button"));

    await waitFor(() => {
      expect(screen.getByTestId("initialize-error")).toBeTruthy();
    });

    expect(
      screen.getByText("Request timeout - please try again")
    ).toBeTruthy();
    expect(onSuggestionsReceived).not.toHaveBeenCalled();
  });

  test("shows error message on generic server error", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects/project-1/initialize")) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
      );
    });

    const onSuggestionsReceived = vi.fn();
    render(
      <InitializeButton
        projectId="project-1"
        taskCount={0}
        onSuggestionsReceived={onSuggestionsReceived}
      />
    );

    fireEvent.click(screen.getByTestId("initialize-button"));

    await waitFor(() => {
      expect(screen.getByTestId("initialize-error")).toBeTruthy();
    });

    expect(
      screen.getByText(/Failed to initialize project:/i)
    ).toBeTruthy();
    expect(onSuggestionsReceived).not.toHaveBeenCalled();
  });

  test("button is disabled during loading", async () => {
    const onSuggestionsReceived = vi.fn();
    render(
      <InitializeButton
        projectId="project-1"
        taskCount={0}
        onSuggestionsReceived={onSuggestionsReceived}
      />
    );

    const button = screen.getByTestId("initialize-button") as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    expect(button.disabled).toBe(true);

    await waitFor(() => {
      expect(onSuggestionsReceived).toHaveBeenCalled();
    });

    expect(button.disabled).toBe(false);
  });
});
