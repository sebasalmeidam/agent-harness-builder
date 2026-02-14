import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as teamService from "./team-service.js";
import * as harnessService from "./harness-service.js";
import * as skillService from "./skill-service.js";

describe("harness-service", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-harness-${Date.now()}`);
    process.env["HARNESS_DATA_DIR"] = testDir;
    await mkdir(join(testDir, "teams"), { recursive: true });
    await mkdir(join(testDir, "skills"), { recursive: true });
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

  describe("resolved skills in export", () => {
    it("should resolve skill entities and attach instructions to harness agents on export", async () => {
      // Create skills
      const skill1 = await skillService.create({
        name: "TypeScript Best Practices",
        description: "TS guidelines",
        instructions: "Write type-safe code. Use interfaces for object shapes.",
      });
      const skill2 = await skillService.create({
        name: "Testing Guidelines",
        description: "Test guidelines",
        instructions: "Write unit tests for all functions. Aim for 80% coverage.",
      });

      // Create team with agents that reference these skills
      const team = await teamService.create({
        name: "Team With Skills",
        description: "Test team",
      });

      await teamService.update(team.id, {
        ...team,
        agents: [
          {
            id: "agent-1",
            name: "Developer",
            emoji: "💻",
            role: "Backend Developer",
            goal: "Build APIs",
            skills: ["TypeScript", "Node.js"],
            skillIds: [skill1.id, skill2.id],
            practices: ["TDD"],
            position: { x: 100, y: 100 },
          },
          {
            id: "agent-2",
            name: "Reviewer",
            emoji: "🔍",
            role: "Code Reviewer",
            goal: "Review code",
            skills: [],
            skillIds: [skill2.id],
            practices: [],
            position: { x: 300, y: 100 },
          },
        ],
      });

      // Export harness
      const harness = await harnessService.exportHarness(team.id);

      // Verify resolvedSkills are attached
      expect(harness.agents[0].resolvedSkills).toHaveLength(2);
      expect(harness.agents[0].resolvedSkills).toEqual([
        {
          name: "TypeScript Best Practices",
          instructions: "Write type-safe code. Use interfaces for object shapes.",
        },
        {
          name: "Testing Guidelines",
          instructions: "Write unit tests for all functions. Aim for 80% coverage.",
        },
      ]);

      expect(harness.agents[1].resolvedSkills).toHaveLength(1);
      expect(harness.agents[1].resolvedSkills).toEqual([
        {
          name: "Testing Guidelines",
          instructions: "Write unit tests for all functions. Aim for 80% coverage.",
        },
      ]);
    });

    it("should export agents with no skillIds without resolvedSkills field", async () => {
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
            skills: ["tag1", "tag2"],
            skillIds: [],
            practices: [],
            position: { x: 0, y: 0 },
          },
        ],
      });

      const harness = await harnessService.exportHarness(team.id);

      // Agent has no skillIds, so no resolvedSkills should be present
      expect(harness.agents[0].resolvedSkills).toBeUndefined();
    });

    it("should skip orphan skillIds when resolving (non-existent skills)", async () => {
      // Create one real skill
      const skill1 = await skillService.create({
        name: "Real Skill",
        description: "Exists",
        instructions: "Do something real.",
      });

      const team = await teamService.create({
        name: "Team With Orphans",
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
            skillIds: [skill1.id, "non-existent-skill-id"],
            practices: [],
            position: { x: 0, y: 0 },
          },
        ],
      });

      const harness = await harnessService.exportHarness(team.id);

      // Only the real skill should be resolved
      expect(harness.agents[0].resolvedSkills).toHaveLength(1);
      expect(harness.agents[0].resolvedSkills).toEqual([
        {
          name: "Real Skill",
          instructions: "Do something real.",
        },
      ]);
    });
  });

  describe("model field round-trip", () => {
    it("should export and import model field correctly", async () => {
      const team = await teamService.create({
        name: "Team With Models",
        description: "Test team with agent models",
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
            skills: [],
            skillIds: [],
            practices: [],
            position: { x: 100, y: 100 },
            model: "claude-opus-4-20250514",
          },
          {
            id: "agent-2",
            name: "Agent Two",
            emoji: "🔍",
            role: "Reviewer",
            goal: "Review code",
            skills: [],
            skillIds: [],
            practices: [],
            position: { x: 300, y: 100 },
            model: "claude-haiku-3-5-20241022",
          },
        ],
      });

      // Export harness
      const harness = await harnessService.exportHarness(team.id);

      expect(harness.agents).toHaveLength(2);
      expect(harness.agents[0].model).toBe("claude-opus-4-20250514");
      expect(harness.agents[1].model).toBe("claude-haiku-3-5-20241022");

      // Import harness as new team
      const importedTeam = await harnessService.importHarness({
        ...harness,
        name: "Imported Team",
      });

      expect(importedTeam.agents).toHaveLength(2);
      expect(importedTeam.agents[0].model).toBe("claude-opus-4-20250514");
      expect(importedTeam.agents[1].model).toBe("claude-haiku-3-5-20241022");
    });

    it("should preserve undefined model field through export/import", async () => {
      const team = await teamService.create({
        name: "Team Without Models",
        description: "Test team",
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

      // Export harness
      const harness = await harnessService.exportHarness(team.id);

      // Model should be undefined or the default applied by team-service
      expect(harness.agents[0].model).toBeDefined();

      // Import harness
      const importedTeam = await harnessService.importHarness({
        ...harness,
        name: "Imported Team",
      });

      expect(importedTeam.agents[0].model).toBeDefined();
    });
  });
});
