import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as teamService from "./team-service.js";

describe("team-service", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-teams-${Date.now()}`);
    process.env["HARNESS_DATA_DIR"] = testDir;
    await mkdir(join(testDir, "teams"), { recursive: true });
  });

  afterEach(async () => {
    delete process.env["HARNESS_DATA_DIR"];
    await rm(testDir, { recursive: true, force: true });
  });

  describe("backward compatibility with skillIds", () => {
    it("should default skillIds to [] when reading a team JSON without skillIds field", async () => {
      const teamId = "test-team";
      const teamPath = join(testDir, "teams", `${teamId}.json`);

      // Create a team JSON without skillIds (simulating old format)
      const oldFormatTeam = {
        id: teamId,
        name: "Test Team",
        description: "Test description",
        agents: [
          {
            id: "agent-1",
            name: "Agent One",
            emoji: "🤖",
            role: "Developer",
            goal: "Build things",
            skills: ["TypeScript", "React"],
            practices: ["TDD"],
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      };

      await writeFile(teamPath, JSON.stringify(oldFormatTeam, null, 2), "utf-8");

      const team = await teamService.get(teamId);
      expect(team).not.toBeNull();
      expect(team!.agents).toHaveLength(1);
      expect(team!.agents[0].skillIds).toEqual([]);
    });

    it("should preserve existing skillIds when reading a team with skillIds", async () => {
      const teamId = "test-team-with-skills";
      const teamPath = join(testDir, "teams", `${teamId}.json`);

      const teamWithSkillIds = {
        id: teamId,
        name: "Test Team",
        description: "Test description",
        agents: [
          {
            id: "agent-1",
            name: "Agent One",
            emoji: "🤖",
            role: "Developer",
            goal: "Build things",
            skills: ["TypeScript"],
            skillIds: ["skill-uuid-1", "skill-uuid-2"],
            practices: ["TDD"],
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      };

      await writeFile(teamPath, JSON.stringify(teamWithSkillIds, null, 2), "utf-8");

      const team = await teamService.get(teamId);
      expect(team).not.toBeNull();
      expect(team!.agents[0].skillIds).toEqual(["skill-uuid-1", "skill-uuid-2"]);
    });

    it("should default skillIds to [] in list() for teams without skillIds", async () => {
      const teamId = "old-team";
      const teamPath = join(testDir, "teams", `${teamId}.json`);

      const oldFormatTeam = {
        id: teamId,
        name: "Old Team",
        description: "Old format",
        agents: [
          {
            id: "agent-1",
            name: "Agent",
            emoji: "🤖",
            role: "Role",
            goal: "Goal",
            skills: [],
            practices: [],
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      };

      await writeFile(teamPath, JSON.stringify(oldFormatTeam, null, 2), "utf-8");

      const teams = await teamService.list();
      expect(teams).toHaveLength(1);

      // Now fetch the full team to verify skillIds was defaulted
      const team = await teamService.get(teamId);
      expect(team!.agents[0].skillIds).toEqual([]);
    });
  });

  describe("skillIds field handling", () => {
    it("should create a new team agent with empty skillIds by default", async () => {
      const team = await teamService.create({
        name: "New Team",
        description: "Test",
      });

      expect(team.agents).toEqual([]);

      // Now manually add an agent and update
      const updatedTeam = await teamService.update(team.id, {
        ...team,
        agents: [
          {
            id: "agent-1",
            name: "Test Agent",
            emoji: "🤖",
            role: "Tester",
            goal: "Test",
            skills: [],
            skillIds: [],
            practices: [],
            position: { x: 0, y: 0 },
          },
        ],
      });

      expect(updatedTeam).not.toBeNull();
      expect(updatedTeam!.agents[0].skillIds).toEqual([]);
    });

    it("should persist skillIds when updating a team", async () => {
      const team = await teamService.create({
        name: "Team With Skills",
        description: "Test",
      });

      const updatedTeam = await teamService.update(team.id, {
        ...team,
        agents: [
          {
            id: "agent-1",
            name: "Agent",
            emoji: "🤖",
            role: "Role",
            goal: "Goal",
            skills: ["tag1"],
            skillIds: ["skill-abc", "skill-def"],
            practices: [],
            position: { x: 0, y: 0 },
          },
        ],
      });

      expect(updatedTeam).not.toBeNull();
      expect(updatedTeam!.agents[0].skillIds).toEqual(["skill-abc", "skill-def"]);

      // Read back to confirm persistence
      const fetched = await teamService.get(team.id);
      expect(fetched!.agents[0].skillIds).toEqual(["skill-abc", "skill-def"]);
    });
  });
});
