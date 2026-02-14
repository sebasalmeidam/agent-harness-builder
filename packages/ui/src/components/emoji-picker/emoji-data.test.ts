import { describe, test, expect } from "vitest";
import {
  EMOJI_DATA,
  DEFAULT_EMOJIS,
  CATEGORIES,
} from "./emoji-data";

describe("emoji-data", () => {
  describe("EMOJI_DATA structure", () => {
    test("all entries have required fields", () => {
      EMOJI_DATA.forEach((entry, index) => {
        expect(
          entry.emoji,
          `Entry at index ${index} missing emoji field`,
        ).toBeTruthy();
        expect(
          entry.name,
          `Entry at index ${index} missing name field`,
        ).toBeTruthy();
        expect(
          entry.category,
          `Entry at index ${index} missing category field`,
        ).toBeTruthy();
        expect(typeof entry.emoji).toBe("string");
        expect(typeof entry.name).toBe("string");
        expect(typeof entry.category).toBe("string");
      });
    });

    test("all category values are valid", () => {
      const validCategories = new Set(CATEGORIES);
      EMOJI_DATA.forEach((entry, index) => {
        expect(
          validCategories.has(entry.category),
          `Entry at index ${index} has invalid category: ${entry.category}`,
        ).toBe(true);
      });
    });

    test("all 7 categories are represented", () => {
      const categoriesInData = new Set(EMOJI_DATA.map((e) => e.category));
      CATEGORIES.forEach((cat) => {
        expect(
          categoriesInData.has(cat),
          `Category "${cat}" is not present in EMOJI_DATA`,
        ).toBe(true);
      });
    });

    test("no duplicate emoji entries", () => {
      const emojisSeen = new Set<string>();
      EMOJI_DATA.forEach((entry) => {
        expect(
          emojisSeen.has(entry.emoji),
          `Duplicate emoji found: ${entry.emoji}`,
        ).toBe(false);
        emojisSeen.add(entry.emoji);
      });
    });

    test("dataset contains at least 500 emojis", () => {
      expect(EMOJI_DATA.length).toBeGreaterThanOrEqual(500);
    });

    test("each category has a reasonable number of emojis", () => {
      const categoryCounts = EMOJI_DATA.reduce(
        (acc, entry) => {
          acc[entry.category] = (acc[entry.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      CATEGORIES.forEach((cat) => {
        expect(
          categoryCounts[cat],
          `Category "${cat}" should have at least 10 emojis`,
        ).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe("DEFAULT_EMOJIS map", () => {
    test("has all 4 entity types", () => {
      expect(DEFAULT_EMOJIS.project).toBeTruthy();
      expect(DEFAULT_EMOJIS.agent).toBeTruthy();
      expect(DEFAULT_EMOJIS.skill).toBeTruthy();
      expect(DEFAULT_EMOJIS.team).toBeTruthy();
    });

    test("has correct default emoji values", () => {
      expect(DEFAULT_EMOJIS.project).toBe("📦");
      expect(DEFAULT_EMOJIS.agent).toBe("🤖");
      expect(DEFAULT_EMOJIS.skill).toBe("⚡");
      expect(DEFAULT_EMOJIS.team).toBe("👥");
    });
  });

  describe("search functionality", () => {
    test("emoji names are lowercase for consistent searching", () => {
      EMOJI_DATA.forEach((entry, index) => {
        expect(
          entry.name,
          `Entry at index ${index} has non-lowercase name: ${entry.name}`,
        ).toBe(entry.name.toLowerCase());
      });
    });

    test("can find emojis by partial name match", () => {
      const searchTerm = "heart";
      const matches = EMOJI_DATA.filter((e) => e.name.includes(searchTerm));
      expect(matches.length).toBeGreaterThan(0);
      matches.forEach((match) => {
        expect(match.name).toContain(searchTerm);
      });
    });

    test("can find rocket emoji by name", () => {
      const rocket = EMOJI_DATA.find((e) => e.name.includes("rocket"));
      expect(rocket).toBeTruthy();
      expect(rocket?.emoji).toBe("🚀");
    });

    test("can find fire emoji by name", () => {
      const fire = EMOJI_DATA.find((e) => e.name === "fire");
      expect(fire).toBeTruthy();
      expect(fire?.emoji).toBe("🔥");
    });
  });

  describe("CATEGORIES array", () => {
    test("contains exactly 7 categories", () => {
      expect(CATEGORIES).toHaveLength(7);
    });

    test("contains expected category names", () => {
      expect(CATEGORIES).toContain("smileys");
      expect(CATEGORIES).toContain("objects");
      expect(CATEGORIES).toContain("symbols");
      expect(CATEGORIES).toContain("animals");
      expect(CATEGORIES).toContain("food");
      expect(CATEGORIES).toContain("travel");
      expect(CATEGORIES).toContain("activities");
    });
  });
});
