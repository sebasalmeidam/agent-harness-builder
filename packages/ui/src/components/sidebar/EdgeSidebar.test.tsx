import { render, screen, fireEvent } from "@testing-library/react";
import { test, expect, vi, beforeEach } from "vitest";
import EdgeSidebar from "./EdgeSidebar";
import type { WorkflowEdgeData } from "../canvas/WorkflowEdge";

const defaultData: WorkflowEdgeData = {
  type: "passes-work-to",
  failureRouting: null,
  gate: null,
};

let mockOnChange: ReturnType<typeof vi.fn>;
let mockOnClose: ReturnType<typeof vi.fn>;
let mockOnDelete: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockOnChange = vi.fn();
  mockOnClose = vi.fn();
  mockOnDelete = vi.fn();
});

function renderEdgeSidebar(dataOverrides: Partial<WorkflowEdgeData> = {}) {
  const data = { ...defaultData, ...dataOverrides };
  return render(
    <EdgeSidebar
      data={data}
      onChange={mockOnChange}
      onClose={mockOnClose}
      onDelete={mockOnDelete}
    />,
  );
}

test("renders sidebar with title", () => {
  renderEdgeSidebar();

  expect(screen.getByText("Edge Properties")).toBeTruthy();
});

test("renders edge type radio buttons", () => {
  renderEdgeSidebar();

  expect(screen.getByText("Passes work to")).toBeTruthy();
  expect(screen.getByText("Reviews")).toBeTruthy();
  expect(screen.getByText("Escalates to")).toBeTruthy();
});

test("default type passes-work-to is selected", () => {
  renderEdgeSidebar();

  const radio = screen.getByTestId(
    "edge-type-passes-work-to",
  ) as HTMLInputElement;
  expect(radio.checked).toBe(true);
});

test("selecting reviews type calls onChange with correct data", () => {
  renderEdgeSidebar();

  fireEvent.click(screen.getByTestId("edge-type-reviews"));

  expect(mockOnChange).toHaveBeenCalledWith({
    ...defaultData,
    type: "reviews",
  });
});

test("selecting escalates-to type calls onChange with correct data", () => {
  renderEdgeSidebar();

  fireEvent.click(screen.getByTestId("edge-type-escalates-to"));

  expect(mockOnChange).toHaveBeenCalledWith({
    ...defaultData,
    type: "escalates-to",
  });
});

test("failure routing checkbox is unchecked by default", () => {
  renderEdgeSidebar();

  const checkbox = screen.getByTestId(
    "failure-routing-toggle",
  ) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
});

test("enabling failure routing calls onChange with loop-back", () => {
  renderEdgeSidebar();

  fireEvent.click(screen.getByTestId("failure-routing-toggle"));

  expect(mockOnChange).toHaveBeenCalledWith({
    ...defaultData,
    failureRouting: "loop-back",
  });
});

test("disabling failure routing calls onChange with null", () => {
  renderEdgeSidebar({ failureRouting: "loop-back" });

  fireEvent.click(screen.getByTestId("failure-routing-toggle"));

  expect(mockOnChange).toHaveBeenCalledWith({
    ...defaultData,
    failureRouting: null,
  });
});

test("gate select defaults to none", () => {
  renderEdgeSidebar();

  const select = screen.getByTestId("gate-select") as HTMLSelectElement;
  expect(select.value).toBe("none");
});

test("selecting auto gate calls onChange with gate data", () => {
  renderEdgeSidebar();

  fireEvent.change(screen.getByTestId("gate-select"), {
    target: { value: "auto" },
  });

  expect(mockOnChange).toHaveBeenCalledWith({
    ...defaultData,
    gate: { type: "auto" },
  });
});

test("selecting manual gate calls onChange with gate data", () => {
  renderEdgeSidebar();

  fireEvent.change(screen.getByTestId("gate-select"), {
    target: { value: "manual" },
  });

  expect(mockOnChange).toHaveBeenCalledWith({
    ...defaultData,
    gate: { type: "manual" },
  });
});

test("selecting none gate calls onChange with null gate", () => {
  renderEdgeSidebar({ gate: { type: "auto" } });

  fireEvent.change(screen.getByTestId("gate-select"), {
    target: { value: "none" },
  });

  expect(mockOnChange).toHaveBeenCalledWith({
    ...defaultData,
    gate: null,
  });
});

test("close button calls onClose", () => {
  renderEdgeSidebar();

  fireEvent.click(screen.getByTestId("close-sidebar"));

  expect(mockOnClose).toHaveBeenCalled();
});

test("delete button shows confirmation and calls onDelete on confirm", () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);

  renderEdgeSidebar();

  fireEvent.click(screen.getByTestId("delete-edge-button"));

  expect(window.confirm).toHaveBeenCalledWith(
    "Are you sure you want to delete this edge? This action cannot be undone.",
  );
  expect(mockOnDelete).toHaveBeenCalled();

  vi.restoreAllMocks();
});

test("delete button does not call onDelete when cancelled", () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);

  renderEdgeSidebar();

  fireEvent.click(screen.getByTestId("delete-edge-button"));

  expect(mockOnDelete).not.toHaveBeenCalled();

  vi.restoreAllMocks();
});

test("shows correct gate value when auto gate is set", () => {
  renderEdgeSidebar({ gate: { type: "auto" } });

  const select = screen.getByTestId("gate-select") as HTMLSelectElement;
  expect(select.value).toBe("auto");
});

test("shows correct gate value when manual gate is set", () => {
  renderEdgeSidebar({ gate: { type: "manual" } });

  const select = screen.getByTestId("gate-select") as HTMLSelectElement;
  expect(select.value).toBe("manual");
});

test("failure routing checkbox is checked when loop-back is set", () => {
  renderEdgeSidebar({ failureRouting: "loop-back" });

  const checkbox = screen.getByTestId(
    "failure-routing-toggle",
  ) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);
});

test("reviews radio is checked when type is reviews", () => {
  renderEdgeSidebar({ type: "reviews" });

  const radio = screen.getByTestId("edge-type-reviews") as HTMLInputElement;
  expect(radio.checked).toBe(true);
});

test("renders sidebar with correct test id", () => {
  renderEdgeSidebar();

  expect(screen.getByTestId("edge-sidebar")).toBeTruthy();
});
