import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import SuggestionDraftList from "./SuggestionDraftList";

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
    ],
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";

    if (
      urlStr.endsWith("/api/projects/project-1/tasks") &&
      method === "POST"
    ) {
      const body = JSON.parse(init?.body as string);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "new-task-id",
            projectId: "project-1",
            ...body,
            teamId: null,
            status: "pending",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
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

describe("SuggestionDraftList", () => {
  test("renders all suggestions", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    expect(screen.getByTestId("suggestion-draft-list")).toBeTruthy();
    expect(screen.getByText("Task Suggestions (2)")).toBeTruthy();
    expect(screen.getByTestId("suggestion-0")).toBeTruthy();
    expect(screen.getByTestId("suggestion-1")).toBeTruthy();
  });

  test("renders editable title, description, and checklist for each suggestion", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    const titleInput = screen.getByTestId(
      "suggestion-title-0"
    ) as HTMLInputElement;
    const descriptionInput = screen.getByTestId(
      "suggestion-description-0"
    ) as HTMLTextAreaElement;

    expect(titleInput.value).toBe("Implement authentication");
    expect(descriptionInput.value).toBe("Add user login and registration");

    // Check checklist items
    expect(screen.getByTestId("checklist-item-0-0")).toBeTruthy();
    expect(screen.getByTestId("checklist-item-0-1")).toBeTruthy();
    expect(screen.getByTestId("checklist-item-0-2")).toBeTruthy();
  });

  test("allows editing title", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    const titleInput = screen.getByTestId(
      "suggestion-title-0"
    ) as HTMLInputElement;
    fireEvent.change(titleInput, {
      target: { value: "Updated authentication" },
    });

    expect(titleInput.value).toBe("Updated authentication");
  });

  test("allows editing description", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    const descriptionInput = screen.getByTestId(
      "suggestion-description-0"
    ) as HTMLTextAreaElement;
    fireEvent.change(descriptionInput, {
      target: { value: "Updated description" },
    });

    expect(descriptionInput.value).toBe("Updated description");
  });

  test("allows editing checklist items", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    const checklistInput = screen.getByTestId(
      "checklist-input-0-0"
    ) as HTMLInputElement;
    fireEvent.change(checklistInput, {
      target: { value: "Updated checklist item" },
    });

    expect(checklistInput.value).toBe("Updated checklist item");
  });

  test("allows removing checklist items", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    expect(screen.getByTestId("checklist-item-0-0")).toBeTruthy();

    fireEvent.click(screen.getByTestId("remove-checklist-0-0"));

    expect(screen.queryByTestId("checklist-item-0-0")).toBeNull();
  });

  test("allows adding checklist items", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    const initialItems = screen
      .getByTestId("suggestion-0")
      .querySelectorAll('[data-testid^="checklist-item-0-"]');
    expect(initialItems.length).toBe(3);

    fireEvent.click(screen.getByTestId("add-checklist-item-0"));

    const updatedItems = screen
      .getByTestId("suggestion-0")
      .querySelectorAll('[data-testid^="checklist-item-0-"]');
    expect(updatedItems.length).toBe(4);
  });

  test("creates task when Accept is clicked", async () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByTestId("accept-button-0"));

    await waitFor(() => {
      expect(screen.queryByTestId("suggestion-0")).toBeNull();
    });

    // Verify POST was called
    const postCall = fetchMock.mock.calls.find(
      (call) => call[1]?.method === "POST"
    );
    expect(postCall).toBeTruthy();

    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.title).toBe("Implement authentication");
    expect(body.description).toBe("Add user login and registration");
    expect(body.checklist).toHaveLength(3);
    expect(body.checklist[0].id).toBeTruthy(); // UUID generated
    expect(body.checklist[0].completed).toBe(false);
  });

  test("removes suggestion when Reject is clicked", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    expect(screen.getByTestId("suggestion-0")).toBeTruthy();

    fireEvent.click(screen.getByTestId("reject-button-0"));

    expect(screen.queryByTestId("suggestion-0")).toBeNull();
    expect(screen.getByText("Task Suggestions (1)")).toBeTruthy();
  });

  test("calls onComplete when all suggestions are processed", async () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={[mockSuggestions[0]]}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByTestId("accept-button-0"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  test("shows error message on Accept failure", async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects/project-1/tasks")) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
      );
    });

    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByTestId("accept-button-0"));

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-error-0")).toBeTruthy();
    });

    expect(screen.getByText(/Failed to create task:/i)).toBeTruthy();
    expect(screen.getByTestId("suggestion-0")).toBeTruthy(); // Still visible
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("Accept All creates all remaining tasks", async () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByTestId("accept-all-button"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    // Verify 2 POST calls were made
    const postCalls = fetchMock.mock.calls.filter(
      (call) => call[1]?.method === "POST"
    );
    expect(postCalls.length).toBe(2);
  });

  test("Accept All shows error if any task fails", async () => {
    let callCount = 0;
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.endsWith("/api/projects/project-1/tasks")) {
        callCount++;
        if (callCount === 2) {
          // Fail on second task
          return Promise.resolve(
            new Response(JSON.stringify({ error: "Server error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ id: "task-id" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
      );
    });

    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByTestId("accept-all-button"));

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-error-1")).toBeTruthy();
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  test("disables buttons during processing", async () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    const acceptButton = screen.getByTestId(
      "accept-button-0"
    ) as HTMLButtonElement;
    const rejectButton = screen.getByTestId(
      "reject-button-0"
    ) as HTMLButtonElement;

    fireEvent.click(acceptButton);

    expect(acceptButton.disabled).toBe(true);
    expect(rejectButton.disabled).toBe(true);

    await waitFor(() => {
      expect(screen.queryByTestId("suggestion-0")).toBeNull();
    });
  });

  test("renders Accept All button", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={mockSuggestions}
        onComplete={onComplete}
      />
    );

    expect(screen.getByTestId("accept-all-button")).toBeTruthy();
    expect(screen.getByText("Accept All")).toBeTruthy();
  });

  test("does not render when suggestions array is empty", () => {
    const onComplete = vi.fn();
    render(
      <SuggestionDraftList
        projectId="project-1"
        suggestions={[]}
        onComplete={onComplete}
      />
    );

    expect(screen.queryByTestId("suggestion-draft-list")).toBeNull();
  });
});
