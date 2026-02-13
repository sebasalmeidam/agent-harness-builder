import { render, screen, fireEvent } from "@testing-library/react";
import { test, expect, vi } from "vitest";
import TextList from "./TextList";

function renderTextList(items: string[] = [], onChange = vi.fn()) {
  return { onChange, ...render(<TextList label="Practices" items={items} onChange={onChange} />) };
}

test("renders label", () => {
  renderTextList();
  expect(screen.getByText("Practices")).toBeTruthy();
});

test("renders existing items as a list with remove buttons", () => {
  renderTextList(["Code review", "TDD"]);

  expect(screen.getByText("Code review")).toBeTruthy();
  expect(screen.getByText("TDD")).toBeTruthy();
  expect(screen.getByLabelText("Remove Code review")).toBeTruthy();
  expect(screen.getByLabelText("Remove TDD")).toBeTruthy();
});

test("adds a new item on Enter key press", () => {
  const onChange = vi.fn();
  renderTextList(["existing"], onChange);

  const input = screen.getByTestId("text-list-input");
  fireEvent.change(input, { target: { value: "New practice" } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onChange).toHaveBeenCalledWith(["existing", "New practice"]);
});

test("does not add empty items", () => {
  const onChange = vi.fn();
  renderTextList([], onChange);

  const input = screen.getByTestId("text-list-input");
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onChange).not.toHaveBeenCalled();
});

test("removes an item when remove button is clicked", () => {
  const onChange = vi.fn();
  renderTextList(["Code review", "TDD", "Pair programming"], onChange);

  fireEvent.click(screen.getByLabelText("Remove TDD"));

  expect(onChange).toHaveBeenCalledWith(["Code review", "Pair programming"]);
});

test("clears input after adding an item", () => {
  renderTextList([], vi.fn());

  const input = screen.getByTestId("text-list-input") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "New item" } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(input.value).toBe("");
});

test("does not add item on non-Enter key press", () => {
  const onChange = vi.fn();
  renderTextList([], onChange);

  const input = screen.getByTestId("text-list-input");
  fireEvent.change(input, { target: { value: "test" } });
  fireEvent.keyDown(input, { key: "Tab" });

  expect(onChange).not.toHaveBeenCalled();
});

test("allows duplicate items (practices can repeat)", () => {
  const onChange = vi.fn();
  renderTextList(["Code review"], onChange);

  const input = screen.getByTestId("text-list-input");
  fireEvent.change(input, { target: { value: "Code review" } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onChange).toHaveBeenCalledWith(["Code review", "Code review"]);
});

test("trims whitespace from item input", () => {
  const onChange = vi.fn();
  renderTextList([], onChange);

  const input = screen.getByTestId("text-list-input");
  fireEvent.change(input, { target: { value: "  spaced  " } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onChange).toHaveBeenCalledWith(["spaced"]);
});
