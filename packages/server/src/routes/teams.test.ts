import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { mkdtemp, rm } from "node:fs/promises";
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

describe("GET /api/teams", () => {
  it("returns an empty array when no teams exist", async () => {
    const res = await request(app).get("/api/teams");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns team summaries after creating teams", async () => {
    await request(app)
      .post("/api/teams")
      .send({ name: "My Team", description: "A test team" });

    const res = await request(app).get("/api/teams");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      id: "my-team",
      name: "My Team",
      description: "A test team",
      agentCount: 0,
    });
  });
});

describe("POST /api/teams", () => {
  it("creates a team and returns 201 with the team object", async () => {
    const res = await request(app)
      .post("/api/teams")
      .send({ name: "Full Stack Team", description: "Builds full stack apps" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: "full-stack-team",
      name: "Full Stack Team",
      description: "Builds full stack apps",
      agents: [],
      edges: [],
    });
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/teams")
      .send({ description: "No name" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Team name is required" });
  });

  it("returns 400 when name is empty string", async () => {
    const res = await request(app)
      .post("/api/teams")
      .send({ name: "   ", description: "Blank name" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Team name is required" });
  });

  it("returns 409 when creating a team with a duplicate name", async () => {
    await request(app)
      .post("/api/teams")
      .send({ name: "Duplicate Team", description: "First" });

    const res = await request(app)
      .post("/api/teams")
      .send({ name: "Duplicate Team", description: "Second" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "A team with this name already exists" });
  });

  it("defaults description to empty string when not provided", async () => {
    const res = await request(app)
      .post("/api/teams")
      .send({ name: "No Desc" });

    expect(res.status).toBe(201);
    expect(res.body.description).toBe("");
  });
});

describe("GET /api/teams/:id", () => {
  it("returns the full team object for an existing team", async () => {
    await request(app)
      .post("/api/teams")
      .send({ name: "Detail Team", description: "For detail test" });

    const res = await request(app).get("/api/teams/detail-team");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: "detail-team",
      name: "Detail Team",
      description: "For detail test",
      agents: [],
      edges: [],
    });
  });

  it("returns 404 for a nonexistent team", async () => {
    const res = await request(app).get("/api/teams/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Team not found" });
  });
});

describe("PUT /api/teams/:id", () => {
  it("updates an existing team and returns the updated object", async () => {
    await request(app)
      .post("/api/teams")
      .send({ name: "Update Me", description: "Original" });

    const res = await request(app)
      .put("/api/teams/update-me")
      .send({
        id: "update-me",
        name: "Update Me",
        description: "Updated",
        agents: [],
        edges: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe("Updated");
  });

  it("returns 404 when updating a nonexistent team", async () => {
    const res = await request(app)
      .put("/api/teams/nonexistent")
      .send({
        id: "nonexistent",
        name: "Ghost",
        description: "",
        agents: [],
        edges: [],
      });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Team not found" });
  });

  it("preserves the original ID even if body contains different ID", async () => {
    await request(app)
      .post("/api/teams")
      .send({ name: "Id Test", description: "" });

    const res = await request(app)
      .put("/api/teams/id-test")
      .send({
        id: "different-id",
        name: "Id Test",
        description: "Changed",
        agents: [],
        edges: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("id-test");
  });
});

describe("DELETE /api/teams/:id", () => {
  it("deletes an existing team and returns 204", async () => {
    await request(app)
      .post("/api/teams")
      .send({ name: "Delete Me", description: "To be deleted" });

    const res = await request(app).delete("/api/teams/delete-me");
    expect(res.status).toBe(204);

    // Verify it is gone
    const getRes = await request(app).get("/api/teams/delete-me");
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting a nonexistent team", async () => {
    const res = await request(app).delete("/api/teams/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Team not found" });
  });
});
