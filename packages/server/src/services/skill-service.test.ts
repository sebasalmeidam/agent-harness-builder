import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as skillService from "./skill-service.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "harness-test-"));
  process.env["HARNESS_DATA_DIR"] = tempDir;
});

afterEach(async () => {
  delete process.env["HARNESS_DATA_DIR"];
  await rm(tempDir, { recursive: true, force: true });
});

describe("Skill Service - list", () => {
  it("returns an empty array when no skills exist", async () => {
    const skills = await skillService.list();
    expect(skills).toEqual([]);
  });

  it("returns skill summaries after creating skills", async () => {
    await skillService.create({
      name: "TypeScript Expert",
      description: "Deep knowledge of TypeScript",
      instructions: "Use TypeScript best practices",
    });

    await skillService.create({
      name: "Testing Guru",
      description: "Testing expertise",
      instructions: "Write comprehensive tests",
    });

    const skills = await skillService.list();
    expect(skills).toHaveLength(2);
    expect(skills[0]).toHaveProperty("id");
    expect(skills[0]).toHaveProperty("name");
    expect(skills[0]).toHaveProperty("description");
    expect(skills[0]).not.toHaveProperty("instructions");
  });

  it("auto-creates skills directory on first list call", async () => {
    const skills = await skillService.list();
    expect(skills).toEqual([]);
  });
});

describe("Skill Service - create", () => {
  it("creates a skill and returns it with a UUID", async () => {
    const skill = await skillService.create({
      name: "React Expert",
      description: "Expert in React",
      instructions: "Use React hooks and functional components",
    });

    expect(skill.id).toBeDefined();
    expect(typeof skill.id).toBe("string");
    expect(skill.id.length).toBeGreaterThan(0);
    expect(skill.name).toBe("React Expert");
    expect(skill.description).toBe("Expert in React");
    expect(skill.instructions).toBe("Use React hooks and functional components");
  });

  it("trims name and description", async () => {
    const skill = await skillService.create({
      name: "  Spaced Name  ",
      description: "  Spaced Desc  ",
      instructions: "Instructions",
    });

    expect(skill.name).toBe("Spaced Name");
    expect(skill.description).toBe("Spaced Desc");
  });

  it("throws DUPLICATE error when creating skill with duplicate name (case-insensitive)", async () => {
    await skillService.create({
      name: "Unique Skill",
      description: "First",
      instructions: "First instructions",
    });

    await expect(
      skillService.create({
        name: "unique skill",
        description: "Second",
        instructions: "Second instructions",
      })
    ).rejects.toThrow("A skill with this name already exists");

    await expect(
      skillService.create({
        name: "UNIQUE SKILL",
        description: "Third",
        instructions: "Third instructions",
      })
    ).rejects.toThrowError((err: Error & { code?: string }) => {
      expect(err.code).toBe("DUPLICATE");
      return true;
    });
  });
});

describe("Skill Service - get", () => {
  it("returns the full skill object for an existing skill", async () => {
    const created = await skillService.create({
      name: "Test Skill",
      description: "For testing",
      instructions: "Do something",
    });

    const fetched = await skillService.get(created.id);
    expect(fetched).toEqual(created);
  });

  it("returns null for a nonexistent skill", async () => {
    const skill = await skillService.get("nonexistent-id");
    expect(skill).toBeNull();
  });
});

describe("Skill Service - update", () => {
  it("updates all fields when provided", async () => {
    const created = await skillService.create({
      name: "Original Name",
      description: "Original description",
      instructions: "Original instructions",
    });

    const updated = await skillService.update(created.id, {
      name: "Updated Name",
      description: "Updated description",
      instructions: "Updated instructions",
    });

    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(created.id);
    expect(updated!.name).toBe("Updated Name");
    expect(updated!.description).toBe("Updated description");
    expect(updated!.instructions).toBe("Updated instructions");
  });

  it("updates only name when provided", async () => {
    const created = await skillService.create({
      name: "Original",
      description: "Desc",
      instructions: "Inst",
    });

    const updated = await skillService.update(created.id, {
      name: "New Name",
    });

    expect(updated!.name).toBe("New Name");
    expect(updated!.description).toBe("Desc");
    expect(updated!.instructions).toBe("Inst");
  });

  it("updates only description when provided", async () => {
    const created = await skillService.create({
      name: "Name",
      description: "Desc",
      instructions: "Inst",
    });

    const updated = await skillService.update(created.id, {
      description: "New Desc",
    });

    expect(updated!.name).toBe("Name");
    expect(updated!.description).toBe("New Desc");
    expect(updated!.instructions).toBe("Inst");
  });

  it("updates only instructions when provided", async () => {
    const created = await skillService.create({
      name: "Name",
      description: "Desc",
      instructions: "Inst",
    });

    const updated = await skillService.update(created.id, {
      instructions: "New Instructions",
    });

    expect(updated!.name).toBe("Name");
    expect(updated!.description).toBe("Desc");
    expect(updated!.instructions).toBe("New Instructions");
  });

  it("returns null when updating a nonexistent skill", async () => {
    const updated = await skillService.update("nonexistent", {
      name: "New Name",
    });
    expect(updated).toBeNull();
  });

  it("throws DUPLICATE error when updating to a name that already exists", async () => {
    await skillService.create({
      name: "First Skill",
      description: "First",
      instructions: "First",
    });

    const second = await skillService.create({
      name: "Second Skill",
      description: "Second",
      instructions: "Second",
    });

    await expect(
      skillService.update(second.id, {
        name: "First Skill",
      })
    ).rejects.toThrowError((err: Error & { code?: string }) => {
      expect(err.code).toBe("DUPLICATE");
      return true;
    });
  });

  it("allows updating a skill to the same name (case-insensitive)", async () => {
    const created = await skillService.create({
      name: "My Skill",
      description: "Desc",
      instructions: "Inst",
    });

    const updated = await skillService.update(created.id, {
      name: "my skill",
      description: "New Desc",
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("my skill");
    expect(updated!.description).toBe("New Desc");
  });
});

describe("Skill Service - remove", () => {
  it("deletes an existing skill and returns true", async () => {
    const created = await skillService.create({
      name: "To Delete",
      description: "Will be deleted",
      instructions: "Delete me",
    });

    const deleted = await skillService.remove(created.id);
    expect(deleted).toBe(true);

    const fetched = await skillService.get(created.id);
    expect(fetched).toBeNull();
  });

  it("returns false when deleting a nonexistent skill", async () => {
    const deleted = await skillService.remove("nonexistent");
    expect(deleted).toBe(false);
  });
});

describe("Skill Service - getMany", () => {
  it("returns all found skills, skipping missing IDs", async () => {
    const skill1 = await skillService.create({
      name: "Skill 1",
      description: "First",
      instructions: "First instructions",
    });

    const skill2 = await skillService.create({
      name: "Skill 2",
      description: "Second",
      instructions: "Second instructions",
    });

    const skills = await skillService.getMany([
      skill1.id,
      "nonexistent-id",
      skill2.id,
      "another-nonexistent",
    ]);

    expect(skills).toHaveLength(2);
    expect(skills[0].id).toBe(skill1.id);
    expect(skills[1].id).toBe(skill2.id);
  });

  it("returns empty array when all IDs are missing", async () => {
    const skills = await skillService.getMany([
      "missing-1",
      "missing-2",
    ]);

    expect(skills).toEqual([]);
  });

  it("returns empty array when given empty array", async () => {
    const skills = await skillService.getMany([]);
    expect(skills).toEqual([]);
  });
});

describe("Skill Service - removeSkillFromAllTeams", () => {
  it("removes skill ID from all agents in all teams", async () => {
    const teamsDir = join(tempDir, "teams");
    await mkdir(teamsDir, { recursive: true });

    const skill = await skillService.create({
      name: "Removable Skill",
      description: "Will be removed",
      instructions: "Instructions",
    });

    // Create team 1 with agents that have the skill
    const team1 = {
      id: "team-1",
      name: "Team 1",
      description: "First team",
      agents: [
        {
          id: "agent-1",
          name: "Agent 1",
          emoji: "👤",
          role: "dev",
          goal: "Code",
          skills: [],
          skillIds: [skill.id, "other-skill-1"],
          practices: [],
          position: { x: 0, y: 0 },
        },
        {
          id: "agent-2",
          name: "Agent 2",
          emoji: "👤",
          role: "reviewer",
          goal: "Review",
          skills: [],
          skillIds: ["other-skill-2"],
          practices: [],
          position: { x: 100, y: 0 },
        },
      ],
      edges: [],
    };

    // Create team 2 with agent that has the skill
    const team2 = {
      id: "team-2",
      name: "Team 2",
      description: "Second team",
      agents: [
        {
          id: "agent-3",
          name: "Agent 3",
          emoji: "👤",
          role: "dev",
          goal: "Code",
          skills: [],
          skillIds: [skill.id],
          practices: [],
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    };

    await writeFile(
      join(teamsDir, "team-1.json"),
      JSON.stringify(team1, null, 2),
      "utf-8"
    );

    await writeFile(
      join(teamsDir, "team-2.json"),
      JSON.stringify(team2, null, 2),
      "utf-8"
    );

    // Remove skill from all teams
    await skillService.removeSkillFromAllTeams(skill.id);

    // Verify the skill was removed
    const { readFile } = await import("node:fs/promises");
    const updatedTeam1Content = await readFile(
      join(teamsDir, "team-1.json"),
      "utf-8"
    );
    const updatedTeam1 = JSON.parse(updatedTeam1Content);

    expect(updatedTeam1.agents[0].skillIds).toEqual(["other-skill-1"]);
    expect(updatedTeam1.agents[1].skillIds).toEqual(["other-skill-2"]);

    const updatedTeam2Content = await readFile(
      join(teamsDir, "team-2.json"),
      "utf-8"
    );
    const updatedTeam2 = JSON.parse(updatedTeam2Content);

    expect(updatedTeam2.agents[0].skillIds).toEqual([]);
  });

  it("does not modify teams without the skill", async () => {
    const teamsDir = join(tempDir, "teams");
    await mkdir(teamsDir, { recursive: true });

    const team = {
      id: "team-1",
      name: "Team 1",
      description: "First team",
      agents: [
        {
          id: "agent-1",
          name: "Agent 1",
          emoji: "👤",
          role: "dev",
          goal: "Code",
          skills: [],
          skillIds: ["other-skill-1"],
          practices: [],
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    };

    await writeFile(
      join(teamsDir, "team-1.json"),
      JSON.stringify(team, null, 2),
      "utf-8"
    );

    // Get original file content
    const { readFile } = await import("node:fs/promises");
    const originalContent = await readFile(
      join(teamsDir, "team-1.json"),
      "utf-8"
    );

    // Remove a nonexistent skill
    await skillService.removeSkillFromAllTeams("nonexistent-skill-id");

    // Verify file wasn't modified
    const newContent = await readFile(
      join(teamsDir, "team-1.json"),
      "utf-8"
    );
    expect(newContent).toBe(originalContent);
  });

  it("handles teams directory not existing", async () => {
    // Teams directory doesn't exist
    await expect(
      skillService.removeSkillFromAllTeams("some-skill-id")
    ).resolves.not.toThrow();
  });

  it("handles agents without skillIds field", async () => {
    const teamsDir = join(tempDir, "teams");
    await mkdir(teamsDir, { recursive: true });

    const team = {
      id: "team-1",
      name: "Team 1",
      description: "First team",
      agents: [
        {
          id: "agent-1",
          name: "Agent 1",
          emoji: "👤",
          role: "dev",
          goal: "Code",
          skills: [],
          // No skillIds field
          practices: [],
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    };

    await writeFile(
      join(teamsDir, "team-1.json"),
      JSON.stringify(team, null, 2),
      "utf-8"
    );

    await expect(
      skillService.removeSkillFromAllTeams("some-skill-id")
    ).resolves.not.toThrow();
  });
});
