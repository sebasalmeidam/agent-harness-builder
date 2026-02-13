import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import ErrorCard from "./ErrorCard";

describe("ErrorCard", () => {
  test("renders the error message", () => {
    render(<ErrorCard message="Something went wrong" />);

    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  test("uses design system error classes", () => {
    render(<ErrorCard message="Error occurred" />);

    const container = screen.getByRole("alert");
    expect(container.className).toContain("border-error");
    expect(container.className).toContain("bg-error-light");

    const messageEl = screen.getByText("Error occurred");
    expect(messageEl.className).toContain("text-error");
  });

  test("does not render retry button when onRetry is not provided", () => {
    render(<ErrorCard message="Error occurred" />);

    expect(screen.queryByText("Retry")).toBeNull();
  });

  test("renders retry button when onRetry is provided", () => {
    const handleRetry = vi.fn();
    render(<ErrorCard message="Error occurred" onRetry={handleRetry} />);

    const retryButton = screen.getByText("Retry");
    expect(retryButton).toBeTruthy();
    expect(retryButton.tagName).toBe("BUTTON");
  });

  test("calls onRetry when retry button is clicked", () => {
    const handleRetry = vi.fn();
    render(<ErrorCard message="Error occurred" onRetry={handleRetry} />);

    fireEvent.click(screen.getByText("Retry"));

    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  test("applies additional className when provided", () => {
    render(<ErrorCard message="Error occurred" className="mt-4" />);

    const container = screen.getByRole("alert");
    expect(container.className).toContain("mt-4");
  });

  test("has role=alert for accessibility", () => {
    render(<ErrorCard message="Error occurred" />);

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
