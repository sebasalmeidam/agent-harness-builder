import { render, screen, fireEvent } from "@testing-library/react";
import { test, expect, vi } from "vitest";
import TagList from "./TagList";

function renderTagList(tags: string[] = [], onChange = vi.fn()) {
  return { onChange, ...render(<TagList label="Skills" tags={tags} onChange={onChange} />) };
}

test("renders label", () => {
  renderTagList();
  expect(screen.getByText("Skills")).toBeTruthy();
});

test("renders existing tags as removable badges", () => {
  renderTagList(["TypeScript", "React"]);

  expect(screen.getByText("TypeScript")).toBeTruthy();
  expect(screen.getByText("React")).toBeTruthy();
  expect(screen.getByLabelText("Remove TypeScript")).toBeTruthy();
  expect(screen.getByLabelText("Remove React")).toBeTruthy();
});

test("adds a new tag on Enter key press", () => {
  const onChange = vi.fn();
  renderTagList(["existing"], onChange);

  const input = screen.getByTestId("tag-input");
  fireEvent.change(input, { target: { value: "NewTag" } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onChange).toHaveBeenCalledWith(["existing", "NewTag"]);
});

test("does not add empty tags", () => {
  const onChange = vi.fn();
  renderTagList([], onChange);

  const input = screen.getByTestId("tag-input");
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onChange).not.toHaveBeenCalled();
});

test("prevents duplicate tags (case-insensitive)", () => {
  const onChange = vi.fn();
  renderTagList(["React"], onChange);

  const input = screen.getByTestId("tag-input");
  fireEvent.change(input, { target: { value: "react" } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onChange).not.toHaveBeenCalled();
});

test("removes a tag when remove button is clicked", () => {
  const onChange = vi.fn();
  renderTagList(["TypeScript", "React", "Node"], onChange);

  fireEvent.click(screen.getByLabelText("Remove React"));

  expect(onChange).toHaveBeenCalledWith(["TypeScript", "Node"]);
});

test("clears input after adding a tag", () => {
  renderTagList([], vi.fn());

  const input = screen.getByTestId("tag-input") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "NewTag" } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(input.value).toBe("");
});

test("does not add tag on non-Enter key press", () => {
  const onChange = vi.fn();
  renderTagList([], onChange);

  const input = screen.getByTestId("tag-input");
  fireEvent.change(input, { target: { value: "test" } });
  fireEvent.keyDown(input, { key: "Tab" });

  expect(onChange).not.toHaveBeenCalled();
});

test("trims whitespace from tag input", () => {
  const onChange = vi.fn();
  renderTagList([], onChange);

  const input = screen.getByTestId("tag-input");
  fireEvent.change(input, { target: { value: "  spaced  " } });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onChange).toHaveBeenCalledWith(["spaced"]);
});
