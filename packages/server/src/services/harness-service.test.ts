import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as teamService from "./team-service.js";
import * as harnessService from "./harness-service.js";

describe("harness-service", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-harness-${Date.now()}`);
    process.env["HARNESS_DATA_DIR"] = testDir;
    await mkdir(join(testDir, "teams"), { recursive: true });
  });

  afterEach(async () => {
    delete process.env["HARNESS_DATA_DIR"];
    await rm(testDir, { recursive: true, force: true });
  });

  describe("skillIds round-trip", () => {
    it("should export and import skillIds correctly", async () => {
      // Create a team with agents that have skillIds
      const team = await teamService.create({
        name: "Team With Skills",
        description: "Test team",
      });

      await teamService.update(team.id, {
        ...team,
        agents: [
          {
            id: "agent-1",
            name: "Agent One",
            emoji: "🤖",
            role: "Developer",
            goal: "Build features",
            skills: ["TypeScript", "React"],
            skillIds: ["skill-uuid-1", "skill-uuid-2"],
            practices: ["TDD", "Code Review"],
            position: { x: 100, y: 100 },
          },
          {
            id: "agent-2",
            name: "Agent Two",
            emoji: "🔍",
            role: "Reviewer",
            goal: "Review code",
            skills: [],
            skillIds: ["skill-uuid-3"],
            practices: [],
            position: { x: 300, y: 100 },
          },
        ],
      });

      // Export harness
      const harness = await harnessService.exportHarness(team.id);

      expect(harness.agents).toHaveLength(2);
      expect(harness.agents[0].skillIds).toEqual(["skill-uuid-1", "skill-uuid-2"]);
      expect(harness.agents[1].skillIds).toEqual(["skill-uuid-3"]);

      // Import harness as new team
      const importedTeam = await harnessService.importHarness({
        ...harness,
        name: "Imported Team",
      });

      expect(importedTeam.agents).toHaveLength(2);
      expect(importedTeam.agents[0].skillIds).toEqual(["skill-uuid-1", "skill-uuid-2"]);
      expect(importedTeam.agents[1].skillIds).toEqual(["skill-uuid-3"]);
    });

    it("should default skillIds to [] when importing harness without skillIds", async () => {
      // Create harness with old format (no skillIds)
      const oldHarness = {
        harnessVersion: "1.0",
        name: "Old Format Harness",
        description: "Legacy harness",
        agents: [
          {
            id: "agent-1",
            name: "Agent",
            emoji: "🤖",
            role: "Role",
            goal: "Goal",
            skills: ["skill1"],
            practices: [],
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      };

      // Import should succeed and default skillIds
      const importedTeam = await harnessService.importHarness(oldHarness as any);

      expect(importedTeam.agents).toHaveLength(1);
      expect(importedTeam.agents[0].skillIds).toEqual([]);
    });

    it("should export agents without skillIds as empty array", async () => {
      const team = await teamService.create({
        name: "Simple Team",
        description: "Test",
      });

      await teamService.update(team.id, {
        ...team,
        agents: [
          {
            id: "agent-1",
            name: "Agent",
            emoji: "🤖",
            role: "Role",
            goal: "Goal",
            skills: [],
            skillIds: [],
            practices: [],
            position: { x: 0, y: 0 },
          },
        ],
      });

      const harness = await harnessService.exportHarness(team.id);

      expect(harness.agents[0].skillIds).toEqual([]);
    });
  });

  describe("orphan skillIds handling", () => {
    it("should accept harness with orphan skillIds (non-existent skills)", async () => {
      const harnessWithOrphanIds = {
        harnessVersion: "1.0",
        name: "Harness With Orphans",
        description: "Has skillIds that don't exist",
        agents: [
          {
            id: "agent-1",
            name: "Agent",
            emoji: "🤖",
            role: "Role",
            goal: "Goal",
            skills: [],
            skillIds: ["non-existent-skill-1", "non-existent-skill-2"],
            practices: [],
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      };

      // Should import without error
      const importedTeam = await harnessService.importHarness(harnessWithOrphanIds);

      expect(importedTeam.agents[0].skillIds).toEqual([
        "non-existent-skill-1",
        "non-existent-skill-2",
      ]);
    });
  });
});
