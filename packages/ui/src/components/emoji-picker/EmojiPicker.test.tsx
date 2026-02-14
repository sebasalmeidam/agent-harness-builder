import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import EmojiPicker from "./EmojiPicker";

describe("EmojiPicker", () => {
  describe("trigger button", () => {
    test("renders with current emoji value", () => {
      render(<EmojiPicker value="🚀" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      expect(trigger.textContent).toBe("🚀");
    });

    test("renders defaultEmoji when value is empty", () => {
      render(
        <EmojiPicker value="" onChange={vi.fn()} defaultEmoji="📦" />,
      );
      const trigger = screen.getByTestId("emoji-picker-trigger");
      expect(trigger.textContent).toBe("📦");
    });

    test("renders fallback emoji when no value or defaultEmoji", () => {
      render(<EmojiPicker value="" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      expect(trigger.textContent).toBe("😀");
    });

    test("has correct accessibility attributes when closed", () => {
      render(<EmojiPicker value="🎉" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(trigger.getAttribute("aria-label")).toBe("Select emoji");
    });

    test("has correct accessibility attributes when open", () => {
      render(<EmojiPicker value="🎉" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
  });

  describe("popover open/close", () => {
    test("popover is closed by default", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      expect(screen.queryByTestId("emoji-picker-popover")).toBeFalsy();
    });

    test("clicking trigger opens popover", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);
      expect(screen.getByTestId("emoji-picker-popover")).toBeTruthy();
    });

    test("clicking trigger again closes popover", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);
      expect(screen.getByTestId("emoji-picker-popover")).toBeTruthy();
      fireEvent.click(trigger);
      expect(screen.queryByTestId("emoji-picker-popover")).toBeFalsy();
    });

    test("clicking outside closes popover", async () => {
      render(
        <div>
          <EmojiPicker value="🔥" onChange={vi.fn()} />
          <div data-testid="outside-element">Outside</div>
        </div>,
      );
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);
      expect(screen.getByTestId("emoji-picker-popover")).toBeTruthy();

      const outsideElement = screen.getByTestId("outside-element");
      fireEvent.mouseDown(outsideElement);

      await waitFor(() => {
        expect(screen.queryByTestId("emoji-picker-popover")).toBeFalsy();
      });
    });

    test("clicking inside popover does not close it", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      const popover = screen.getByTestId("emoji-picker-popover");
      fireEvent.mouseDown(popover);

      expect(screen.getByTestId("emoji-picker-popover")).toBeTruthy();
    });
  });

  describe("search functionality", () => {
    test("search input is present when popover is open", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);
      expect(screen.getByTestId("emoji-search-input")).toBeTruthy();
    });

    test("search filters emojis by name", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      const searchInput = screen.getByTestId("emoji-search-input");
      fireEvent.change(searchInput, { target: { value: "rocket" } });

      // Rocket emoji should be present
      expect(screen.getByTestId("emoji-🚀")).toBeTruthy();

      // Fire emoji should not be present (filtered out)
      expect(screen.queryByTestId("emoji-🔥")).toBeFalsy();
    });

    test("search is case insensitive", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      const searchInput = screen.getByTestId("emoji-search-input");
      fireEvent.change(searchInput, { target: { value: "ROCKET" } });

      expect(screen.getByTestId("emoji-🚀")).toBeTruthy();
    });

    test("shows no results message when search has no matches", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      const searchInput = screen.getByTestId("emoji-search-input");
      fireEvent.change(searchInput, {
        target: { value: "nonexistentemoji12345" },
      });

      expect(screen.getByText("No emojis found")).toBeTruthy();
    });

    test("search resets when reopening popover", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");

      // Open and search
      fireEvent.click(trigger);
      const searchInput = screen.getByTestId(
        "emoji-search-input",
      ) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "rocket" } });
      expect(searchInput.value).toBe("rocket");

      // Close
      fireEvent.click(trigger);

      // Reopen
      fireEvent.click(trigger);
      const newSearchInput = screen.getByTestId(
        "emoji-search-input",
      ) as HTMLInputElement;
      expect(newSearchInput.value).toBe("");
    });
  });

  describe("category filtering", () => {
    test("all category tabs are present", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      expect(screen.getByTestId("category-all")).toBeTruthy();
      expect(screen.getByTestId("category-smileys")).toBeTruthy();
      expect(screen.getByTestId("category-objects")).toBeTruthy();
      expect(screen.getByTestId("category-symbols")).toBeTruthy();
      expect(screen.getByTestId("category-animals")).toBeTruthy();
      expect(screen.getByTestId("category-food")).toBeTruthy();
      expect(screen.getByTestId("category-travel")).toBeTruthy();
      expect(screen.getByTestId("category-activities")).toBeTruthy();
    });

    test("all category is active by default", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      const allTab = screen.getByTestId("category-all");
      expect(allTab.className).toContain("bg-primary");
    });

    test("clicking a category filters emojis", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      const travelTab = screen.getByTestId("category-travel");
      fireEvent.click(travelTab);

      // Rocket (travel) should be present
      expect(screen.getByTestId("emoji-🚀")).toBeTruthy();

      // Robot (smileys) should not be present
      expect(screen.queryByTestId("emoji-🤖")).toBeFalsy();
    });

    test("clicking all category shows all emojis", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      // Filter by category
      const travelTab = screen.getByTestId("category-travel");
      fireEvent.click(travelTab);

      // Click All
      const allTab = screen.getByTestId("category-all");
      fireEvent.click(allTab);

      // Both travel and non-travel emojis should be present
      expect(screen.getByTestId("emoji-🚀")).toBeTruthy();
      expect(screen.getByTestId("emoji-🤖")).toBeTruthy();
    });

    test("active category tab has correct styling", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      const symbolsTab = screen.getByTestId("category-symbols");
      fireEvent.click(symbolsTab);

      expect(symbolsTab.className).toContain("bg-primary");
      expect(symbolsTab.className).toContain("text-white");
    });
  });

  describe("emoji selection", () => {
    test("clicking an emoji calls onChange with correct value", () => {
      const handleChange = vi.fn();
      render(<EmojiPicker value="🔥" onChange={handleChange} />);

      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      const rocketEmoji = screen.getByTestId("emoji-🚀");
      fireEvent.click(rocketEmoji);

      expect(handleChange).toHaveBeenCalledWith("🚀");
    });

    test("clicking an emoji closes the popover", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);

      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);
      expect(screen.getByTestId("emoji-picker-popover")).toBeTruthy();

      const rocketEmoji = screen.getByTestId("emoji-🚀");
      fireEvent.click(rocketEmoji);

      expect(screen.queryByTestId("emoji-picker-popover")).toBeFalsy();
    });

    test("emoji buttons have title attribute with emoji name", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);

      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      const rocketEmoji = screen.getByTestId("emoji-🚀");
      expect(rocketEmoji.getAttribute("title")).toBe("rocket");
    });
  });

  describe("emoji grid", () => {
    test("emoji grid is present when popover is open", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);
      expect(screen.getByTestId("emoji-grid")).toBeTruthy();
    });

    test("emoji grid displays multiple emojis", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      // Check for a few common emojis from different categories
      expect(screen.getByTestId("emoji-😀")).toBeTruthy();
      expect(screen.getByTestId("emoji-🚀")).toBeTruthy();
      expect(screen.getByTestId("emoji-🔥")).toBeTruthy();
      expect(screen.getByTestId("emoji-🐶")).toBeTruthy();
    });
  });

  describe("combined filters", () => {
    test("search works together with category filter", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      // Filter by travel category
      const travelTab = screen.getByTestId("category-travel");
      fireEvent.click(travelTab);

      // Search for "rocket"
      const searchInput = screen.getByTestId("emoji-search-input");
      fireEvent.change(searchInput, { target: { value: "rocket" } });

      // Rocket (travel + matches search) should be present
      expect(screen.getByTestId("emoji-🚀")).toBeTruthy();

      // Fire (not in travel category) should not be present
      expect(screen.queryByTestId("emoji-🔥")).toBeFalsy();
    });

    test("search overrides category when emoji not in active category", () => {
      render(<EmojiPicker value="🔥" onChange={vi.fn()} />);
      const trigger = screen.getByTestId("emoji-picker-trigger");
      fireEvent.click(trigger);

      // Filter by food category
      const foodTab = screen.getByTestId("category-food");
      fireEvent.click(foodTab);

      // Search for "rocket" (not in food)
      const searchInput = screen.getByTestId("emoji-search-input");
      fireEvent.change(searchInput, { target: { value: "rocket" } });

      // Rocket should not be present (travel category, not food)
      expect(screen.queryByTestId("emoji-🚀")).toBeFalsy();
      expect(screen.getByText("No emojis found")).toBeTruthy();
    });
  });
});
