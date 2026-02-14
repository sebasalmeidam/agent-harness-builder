import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "harness-test-"));
  process.env["HARNESS_DATA_DIR"] = tempDir;
});

afterEach(async () => {
  delete process.env["HARNESS_DATA_DIR"];
  await rm(tempDir, { recursive: true, force: true });
});

describe("GET /api/skills", () => {
  it("returns an empty array when no skills exist", async () => {
    const res = await request(app).get("/api/skills");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns skill summaries after creating skills", async () => {
    await request(app)
      .post("/api/skills")
      .send({
        name: "TypeScript Expert",
        description: "Deep knowledge of TypeScript",
        instructions: "Use TypeScript best practices",
      });

    const res = await request(app).get("/api/skills");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name", "TypeScript Expert");
    expect(res.body[0]).toHaveProperty("description", "Deep knowledge of TypeScript");
    expect(res.body[0]).not.toHaveProperty("instructions");
  });

  it("auto-creates skills directory on first GET", async () => {
    const res = await request(app).get("/api/skills");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/skills", () => {
  it("creates a skill and returns 201 with the skill object", async () => {
    const res = await request(app)
      .post("/api/skills")
      .send({
        name: "React Expert",
        description: "Expert in React",
        instructions: "Use React hooks and functional components",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe("React Expert");
    expect(res.body.description).toBe("Expert in React");
    expect(res.body.instructions).toBe("Use React hooks and functional components");
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/skills")
      .send({
        description: "No name",
        instructions: "Instructions",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Skill name is required" });
  });

  it("returns 400 when name is empty string", async () => {
    const res = await request(app)
      .post("/api/skills")
      .send({
        name: "   ",
        description: "Blank name",
        instructions: "Instructions",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Skill name is required" });
  });

  it("returns 400 when description is missing", async () => {
    const res = await request(app)
      .post("/api/skills")
      .send({
        name: "Test",
        instructions: "Instructions",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Skill description is required" });
  });

  it("returns 400 when instructions are missing", async () => {
    const res = await request(app)
      .post("/api/skills")
      .send({
        name: "Test",
        description: "Description",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Skill instructions are required" });
  });

  it("returns 409 when creating a skill with a duplicate name", async () => {
    await request(app)
      .post("/api/skills")
      .send({
        name: "Duplicate Skill",
        description: "First",
        instructions: "First instructions",
      });

    const res = await request(app)
      .post("/api/skills")
      .send({
        name: "Duplicate Skill",
        description: "Second",
        instructions: "Second instructions",
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "A skill with this name already exists" });
  });

  it("returns 409 for duplicate names case-insensitively", async () => {
    await request(app)
      .post("/api/skills")
      .send({
        name: "Testing",
        description: "First",
        instructions: "First instructions",
      });

    const res = await request(app)
      .post("/api/skills")
      .send({
        name: "TESTING",
        description: "Second",
        instructions: "Second instructions",
      });

    expect(res.status).toBe(409);
  });
});

describe("GET /api/skills/:id", () => {
  it("returns the full skill object for an existing skill", async () => {
    const createRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Detail Skill",
        description: "For detail test",
        instructions: "Detailed instructions here",
      });

    const skillId = createRes.body.id;

    const res = await request(app).get(`/api/skills/${skillId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: skillId,
      name: "Detail Skill",
      description: "For detail test",
      instructions: "Detailed instructions here",
    });
  });

  it("returns 404 for a nonexistent skill", async () => {
    const res = await request(app).get("/api/skills/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Skill not found" });
  });
});

describe("PUT /api/skills/:id", () => {
  it("updates all fields and returns the updated skill", async () => {
    const createRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Original",
        description: "Original desc",
        instructions: "Original instructions",
      });

    const skillId = createRes.body.id;

    const res = await request(app)
      .put(`/api/skills/${skillId}`)
      .send({
        name: "Updated",
        description: "Updated desc",
        instructions: "Updated instructions",
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(skillId);
    expect(res.body.name).toBe("Updated");
    expect(res.body.description).toBe("Updated desc");
    expect(res.body.instructions).toBe("Updated instructions");
  });

  it("updates only name when provided", async () => {
    const createRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Original",
        description: "Original desc",
        instructions: "Original instructions",
      });

    const skillId = createRes.body.id;

    const res = await request(app)
      .put(`/api/skills/${skillId}`)
      .send({ name: "Updated Name Only" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name Only");
    expect(res.body.description).toBe("Original desc");
    expect(res.body.instructions).toBe("Original instructions");
  });

  it("updates only description when provided", async () => {
    const createRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Original",
        description: "Original desc",
        instructions: "Original instructions",
      });

    const skillId = createRes.body.id;

    const res = await request(app)
      .put(`/api/skills/${skillId}`)
      .send({ description: "Updated Desc Only" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Original");
    expect(res.body.description).toBe("Updated Desc Only");
    expect(res.body.instructions).toBe("Original instructions");
  });

  it("updates only instructions when provided", async () => {
    const createRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Original",
        description: "Original desc",
        instructions: "Original instructions",
      });

    const skillId = createRes.body.id;

    const res = await request(app)
      .put(`/api/skills/${skillId}`)
      .send({ instructions: "Updated Instructions Only" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Original");
    expect(res.body.description).toBe("Original desc");
    expect(res.body.instructions).toBe("Updated Instructions Only");
  });

  it("returns 400 when no fields are provided", async () => {
    const createRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Test",
        description: "Test",
        instructions: "Test",
      });

    const res = await request(app)
      .put(`/api/skills/${createRes.body.id}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "At least one field must be provided for update" });
  });

  it("returns 400 when name is empty string", async () => {
    const createRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Test",
        description: "Test",
        instructions: "Test",
      });

    const res = await request(app)
      .put(`/api/skills/${createRes.body.id}`)
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Skill name must be a non-empty string" });
  });

  it("returns 404 when updating a nonexistent skill", async () => {
    const res = await request(app)
      .put("/api/skills/nonexistent")
      .send({ name: "Ghost" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Skill not found" });
  });

  it("returns 409 when updating to a name that already exists", async () => {
    await request(app)
      .post("/api/skills")
      .send({
        name: "First Skill",
        description: "First",
        instructions: "First",
      });

    const secondRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Second Skill",
        description: "Second",
        instructions: "Second",
      });

    const res = await request(app)
      .put(`/api/skills/${secondRes.body.id}`)
      .send({ name: "First Skill" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "A skill with this name already exists" });
  });
});

describe("DELETE /api/skills/:id", () => {
  it("deletes an existing skill and returns 204", async () => {
    const createRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Delete Me",
        description: "To be deleted",
        instructions: "Instructions",
      });

    const skillId = createRes.body.id;

    const res = await request(app).delete(`/api/skills/${skillId}`);
    expect(res.status).toBe(204);

    // Verify it is gone
    const getRes = await request(app).get(`/api/skills/${skillId}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting a nonexistent skill", async () => {
    const res = await request(app).delete("/api/skills/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Skill not found" });
  });

  it("removes skill from all agents before deleting (cascade)", async () => {
    // Create a skill
    const skillRes = await request(app)
      .post("/api/skills")
      .send({
        name: "Cascade Skill",
        description: "Will be removed from agents",
        instructions: "Instructions",
      });

    const skillId = skillRes.body.id;

    // Create a team with agents that have the skill
    await request(app)
      .post("/api/teams")
      .send({ name: "Test Team", description: "For cascade test" });

    await request(app)
      .put("/api/teams/test-team")
      .send({
        id: "test-team",
        name: "Test Team",
        description: "For cascade test",
        agents: [
          {
            id: "agent-1",
            name: "Agent 1",
            emoji: "👤",
            role: "dev",
            goal: "Code",
            skills: [],
            skillIds: [skillId, "other-skill"],
            practices: [],
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      });

    // Delete the skill
    const deleteRes = await request(app).delete(`/api/skills/${skillId}`);
    expect(deleteRes.status).toBe(204);

    // Verify skill was removed from agent
    const teamRes = await request(app).get("/api/teams/test-team");
    expect(teamRes.body.agents[0].skillIds).toEqual(["other-skill"]);
  });
});

describe("Skills API - Performance", () => {
  it("lists 100 skills within 500ms (NFR-1)", async () => {
    // Create 100 skills
    const createPromises = [];
    for (let i = 0; i < 100; i++) {
      createPromises.push(
        request(app)
          .post("/api/skills")
          .send({
            name: `Skill ${i}`,
            description: `Description ${i}`,
            instructions: `Instructions ${i}`,
          })
      );
    }
    await Promise.all(createPromises);

    // Measure list time
    const start = Date.now();
    const res = await request(app).get("/api/skills");
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(100);
    expect(duration).toBeLessThan(500);
  });
});
