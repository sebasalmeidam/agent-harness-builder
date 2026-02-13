import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cloneRepository } from "../services/git-service.js";

vi.mock("../services/git-service.js", () => ({
  cloneRepository: vi.fn().mockResolvedValue({ success: true }),
}));

const mockCloneRepository = vi.mocked(cloneRepository);

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "harness-test-"));
  process.env["HARNESS_DATA_DIR"] = tempDir;
  mockCloneRepository.mockResolvedValue({ success: true });
});

afterEach(async () => {
  delete process.env["HARNESS_DATA_DIR"];
  await rm(tempDir, { recursive: true, force: true });
  mockCloneRepository.mockClear();
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
    expect(res.body[0].emoji).toBe("\uD83D\uDCE6");
    expect(res.body[0].teamId).toBeNull();
    expect(res.body[0].runCount).toBe(0);
    expect(res.body[0].createdAt).toBeDefined();
  });

  it("returns correct runCount when .runs/ directory has json files", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Run Count Project", description: "Has runs" });

    // Manually create .runs/ directory with some JSON files
    const runsDir = join(tempDir, "projects", "run-count-project", ".runs");
    await mkdir(runsDir, { recursive: true });
    await writeFile(join(runsDir, "run-1.json"), "{}", "utf-8");
    await writeFile(join(runsDir, "run-2.json"), "{}", "utf-8");
    await writeFile(join(runsDir, "not-a-run.txt"), "ignored", "utf-8");

    const res = await request(app).get("/api/projects");
    const project = res.body.find((p: { id: string }) => p.id === "run-count-project");
    expect(project.runCount).toBe(2);
  });

  it("returns emoji in project list summaries with custom emoji", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Emoji List", description: "Custom emoji", emoji: "\uD83D\uDE80" });

    const res = await request(app).get("/api/projects");
    const project = res.body.find((p: { id: string }) => p.id === "emoji-list");
    expect(project.emoji).toBe("\uD83D\uDE80");
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
    expect(res.body.emoji).toBe("\uD83D\uDCE6");
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

  it("persists emoji when provided", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Emoji Project", description: "Has emoji", emoji: "\uD83D\uDE80" });

    expect(res.status).toBe(201);
    expect(res.body.emoji).toBe("\uD83D\uDE80");
  });

  it("defaults emoji to package emoji when not provided", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Default Emoji", description: "No emoji field" });

    expect(res.status).toBe(201);
    expect(res.body.emoji).toBe("\uD83D\uDCE6");
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
    expect(res.body.emoji).toBe("\uD83D\uDCE6");
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

describe("PATCH /api/projects/:id", () => {
  it("updates only the name field and preserves other fields", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Patch Name", description: "Original description" });

    // Set a teamId first so we can verify it is preserved
    await request(app)
      .put("/api/projects/patch-name")
      .send({ teamId: "my-team", spec: "Original spec" });

    const res = await request(app)
      .patch("/api/projects/patch-name")
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.description).toBe("Original description");
    expect(res.body.teamId).toBe("my-team");
    expect(res.body.spec).toBe("Original spec");
    expect(res.body.id).toBe("patch-name");
  });

  it("updates only the teamId field and preserves other fields", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Patch Team", description: "Team test" });

    const res = await request(app)
      .patch("/api/projects/patch-team")
      .send({ teamId: "new-team" });

    expect(res.status).toBe(200);
    expect(res.body.teamId).toBe("new-team");
    expect(res.body.name).toBe("Patch Team");
    expect(res.body.description).toBe("Team test");
  });

  it("returns 400 when name is a number", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Type Check", description: "" });

    const res = await request(app)
      .patch("/api/projects/type-check")
      .send({ name: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("name must be a non-empty string");
  });

  it("returns 400 when description is a boolean", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Bool Check", description: "" });

    const res = await request(app)
      .patch("/api/projects/bool-check")
      .send({ description: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("description must be a string");
  });

  it("returns 404 for a nonexistent project", async () => {
    const res = await request(app)
      .patch("/api/projects/nonexistent")
      .send({ name: "Ghost" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });

  it("returns 400 when body is empty object", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Empty Body", description: "" });

    const res = await request(app)
      .patch("/api/projects/empty-body")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("at least one updatable field");
  });

  it("returns 400 when name is an empty string", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Empty Name", description: "" });

    const res = await request(app)
      .patch("/api/projects/empty-name")
      .send({ name: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("name must be a non-empty string");
  });

  it("strips non-updatable fields like id and createdAt", async () => {
    const createRes = await request(app)
      .post("/api/projects")
      .send({ name: "Strip Fields", description: "Original" });

    const originalCreatedAt = createRes.body.createdAt;

    const res = await request(app)
      .patch("/api/projects/strip-fields")
      .send({ name: "New Name", id: "hacked-id", createdAt: "2000-01-01" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("strip-fields");
    expect(res.body.name).toBe("New Name");
    expect(res.body.createdAt).toBe(originalCreatedAt);
  });

  it("updates the emoji field via PATCH", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Patch Emoji", description: "Emoji test" });

    const res = await request(app)
      .patch("/api/projects/patch-emoji")
      .send({ emoji: "\uD83C\uDF1F" });

    expect(res.status).toBe(200);
    expect(res.body.emoji).toBe("\uD83C\uDF1F");
    expect(res.body.name).toBe("Patch Emoji");
  });

  it("returns 400 when emoji is not a string", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Emoji Type Check", description: "" });

    const res = await request(app)
      .patch("/api/projects/emoji-type-check")
      .send({ emoji: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("emoji must be a string");
  });

  it("ignores unknown fields and processes valid ones", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Unknown Fields", description: "Original" });

    const res = await request(app)
      .patch("/api/projects/unknown-fields")
      .send({ name: "Changed", unknownField: "ignored" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Changed");
  });

  it("returns 400 when body only contains non-updatable fields", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Only Non Updatable", description: "" });

    const res = await request(app)
      .patch("/api/projects/only-non-updatable")
      .send({ id: "hacked", createdAt: "2000-01-01" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("at least one updatable field");
  });
});

describe("POST /api/projects with gitUrl", () => {
  it("stores the git URL when provided and clone succeeds", async () => {
    mockCloneRepository.mockResolvedValue({ success: true });

    const res = await request(app).post("/api/projects").send({
      name: "Git Project",
      description: "Has a repo",
      gitUrl: "https://github.com/octocat/Hello-World.git",
    });

    expect(res.status).toBe(201);
    expect(res.body.gitUrl).toBe(
      "https://github.com/octocat/Hello-World.git",
    );
    expect(res.body.cloneWarning).toBeUndefined();
    expect(mockCloneRepository).toHaveBeenCalledOnce();
  });

  it("creates project without gitUrl when not provided", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "No Git", description: "No repo" });

    expect(res.status).toBe(201);
    expect(res.body.gitUrl).toBeNull();
    expect(res.body.cloneWarning).toBeUndefined();
    expect(mockCloneRepository).not.toHaveBeenCalled();
  });

  it("creates project but includes cloneWarning when clone fails", async () => {
    mockCloneRepository.mockResolvedValue({
      success: false,
      error: "Repository not found",
    });

    const res = await request(app).post("/api/projects").send({
      name: "Bad Git",
      description: "Invalid repo",
      gitUrl: "https://invalid.example.com/repo.git",
    });

    expect(res.status).toBe(201);
    expect(res.body.gitUrl).toBe("https://invalid.example.com/repo.git");
    expect(res.body.cloneWarning).toBe("Repository not found");
    expect(mockCloneRepository).toHaveBeenCalledOnce();
  });

  it("ignores empty gitUrl string", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Empty Git", description: "Empty URL", gitUrl: "" });

    expect(res.status).toBe(201);
    expect(res.body.gitUrl).toBeNull();
    expect(res.body.cloneWarning).toBeUndefined();
    expect(mockCloneRepository).not.toHaveBeenCalled();
  });
});
