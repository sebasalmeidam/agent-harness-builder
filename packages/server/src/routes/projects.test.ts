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

describe("GET /api/projects", () => {
  it("returns an empty array when no projects exist", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns project summaries after creating projects", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "My Project", description: "A test project" });

    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("my-project");
    expect(res.body[0].name).toBe("My Project");
    expect(res.body[0].description).toBe("A test project");
    expect(res.body[0].teamId).toBeNull();
    expect(res.body[0].createdAt).toBeDefined();
  });
});

describe("POST /api/projects", () => {
  it("creates a project and returns 201 with the project object", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Full Stack Project", description: "Builds full stack apps" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("full-stack-project");
    expect(res.body.name).toBe("Full Stack Project");
    expect(res.body.description).toBe("Builds full stack apps");
    expect(res.body.spec).toBe("");
    expect(res.body.teamId).toBeNull();
    expect(res.body.gitUrl).toBeNull();
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.updatedAt).toBeDefined();
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ description: "No name" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Project name is required" });
  });

  it("returns 400 when name is empty string", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "   ", description: "Blank name" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Project name is required" });
  });

  it("returns 409 when creating a project with a duplicate name", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Duplicate Project", description: "First" });

    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Duplicate Project", description: "Second" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "A project with this name already exists",
    });
  });

  it("defaults description to empty string when not provided", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "No Desc" });

    expect(res.status).toBe(201);
    expect(res.body.description).toBe("");
  });
});

describe("GET /api/projects/:id", () => {
  it("returns the full project object for an existing project", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Detail Project", description: "For detail test" });

    const res = await request(app).get("/api/projects/detail-project");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("detail-project");
    expect(res.body.name).toBe("Detail Project");
    expect(res.body.description).toBe("For detail test");
    expect(res.body.spec).toBe("");
    expect(res.body.teamId).toBeNull();
    expect(res.body.gitUrl).toBeNull();
  });

  it("returns 404 for a nonexistent project", async () => {
    const res = await request(app).get("/api/projects/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });
});

describe("PUT /api/projects/:id", () => {
  it("updates the spec field of an existing project", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Update Me", description: "Original" });

    const res = await request(app)
      .put("/api/projects/update-me")
      .send({ spec: "Build a web application with React and Express" });

    expect(res.status).toBe(200);
    expect(res.body.spec).toBe("Build a web application with React and Express");
    expect(res.body.id).toBe("update-me");
    expect(res.body.name).toBe("Update Me");
  });

  it("updates the teamId field of an existing project", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Team Assign", description: "For team assignment" });

    const res = await request(app)
      .put("/api/projects/team-assign")
      .send({ teamId: "my-team" });

    expect(res.status).toBe(200);
    expect(res.body.teamId).toBe("my-team");
  });

  it("returns 404 when updating a nonexistent project", async () => {
    const res = await request(app)
      .put("/api/projects/nonexistent")
      .send({ spec: "Something" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });

  it("preserves the original ID even if body contains different ID", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Id Test", description: "" });

    const res = await request(app)
      .put("/api/projects/id-test")
      .send({ id: "different-id", spec: "New spec" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("id-test");
  });

  it("does not change createdAt on update", async () => {
    const createRes = await request(app)
      .post("/api/projects")
      .send({ name: "Timestamp Test", description: "" });

    const originalCreatedAt = createRes.body.createdAt;

    const res = await request(app)
      .put("/api/projects/timestamp-test")
      .send({ spec: "Updated spec" });

    expect(res.status).toBe(200);
    expect(res.body.createdAt).toBe(originalCreatedAt);
  });
});

describe("DELETE /api/projects/:id", () => {
  it("deletes an existing project and returns 204", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Delete Me", description: "To be deleted" });

    const res = await request(app).delete("/api/projects/delete-me");
    expect(res.status).toBe(204);

    // Verify it is gone
    const getRes = await request(app).get("/api/projects/delete-me");
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting a nonexistent project", async () => {
    const res = await request(app).delete("/api/projects/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });
});
