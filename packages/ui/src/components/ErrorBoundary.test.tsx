import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { test, expect, vi, afterEach } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

afterEach(() => {
  vi.restoreAllMocks();
});

function ThrowingComponent(): never {
  throw new Error("Test error for boundary");
}

function GoodComponent() {
  return <p>Hello from child</p>;
}

test("renders children normally when no error occurs", () => {
  render(
    <MemoryRouter>
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    </MemoryRouter>,
  );

  expect(screen.getByText("Hello from child")).toBeTruthy();
});

test("catches a thrown error and shows the fallback message", () => {
  // Suppress console.error from ErrorBoundary and React's error logging
  vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <MemoryRouter>
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    </MemoryRouter>,
  );

  expect(screen.getByText("Something went wrong")).toBeTruthy();
  expect(
    screen.getByText("An unexpected error occurred. Please try again."),
  ).toBeTruthy();
});

test("shows a 'Go back to Dashboard' link that navigates to /", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <MemoryRouter>
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    </MemoryRouter>,
  );

  const link = screen.getByText("Go back to Dashboard");
  expect(link).toBeTruthy();
  expect(link.getAttribute("href")).toBe("/");
});

test("does not render stack trace text in the DOM", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const { container } = render(
    <MemoryRouter>
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    </MemoryRouter>,
  );

  const html = container.innerHTML;
  expect(html).not.toContain("at ThrowingComponent");
  expect(html).not.toContain("at Component");
  expect(html).not.toContain("Test error for boundary");
});

test("logs error to console via console.error", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  render(
    <MemoryRouter>
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    </MemoryRouter>,
  );

  // Find the call from our componentDidCatch (not React's internal calls)
  const boundaryCall = consoleErrorSpy.mock.calls.find(
    (call) =>
      typeof call[0] === "string" &&
      call[0].includes("ErrorBoundary caught an error"),
  );
  expect(boundaryCall).toBeTruthy();
});
