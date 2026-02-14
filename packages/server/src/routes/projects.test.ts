import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;
let projectPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "harness-test-"));
  process.env["HARNESS_DATA_DIR"] = tempDir;
  // Create a valid project directory for testing
  projectPath = join(tempDir, "test-project");
  await mkdir(projectPath, { recursive: true });
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
      .send({ name: "My Project", description: "A test project", path: projectPath });

    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("my-project");
    expect(res.body[0].name).toBe("My Project");
    expect(res.body[0].description).toBe("A test project");
    expect(res.body[0].emoji).toBe("\uD83D\uDCE6");
    expect(res.body[0].path).toBe(projectPath);
    expect(res.body[0].taskCount).toBe(0);
    expect(res.body[0].pathExists).toBe(true);
    expect(res.body[0].createdAt).toBeDefined();
  });

  it("returns pathExists as false when directory is deleted", async () => {
    const deletedPath = join(tempDir, "deleted-project");
    await mkdir(deletedPath, { recursive: true });

    await request(app)
      .post("/api/projects")
      .send({ name: "Deleted Path Project", description: "Path will be deleted", path: deletedPath });

    // Delete the directory
    await rm(deletedPath, { recursive: true, force: true });

    const res = await request(app).get("/api/projects");
    const project = res.body.find((p: { id: string }) => p.id === "deleted-path-project");
    expect(project.pathExists).toBe(false);
  });

  it("returns emoji in project list summaries with custom emoji", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Emoji List", description: "Custom emoji", emoji: "\uD83D\uDE80", path: projectPath });

    const res = await request(app).get("/api/projects");
    const project = res.body.find((p: { id: string }) => p.id === "emoji-list");
    expect(project.emoji).toBe("\uD83D\uDE80");
  });
});

describe("POST /api/projects", () => {
  it("creates a project and returns 201 with the project object", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Full Stack Project", description: "Builds full stack apps", path: projectPath });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("full-stack-project");
    expect(res.body.name).toBe("Full Stack Project");
    expect(res.body.description).toBe("Builds full stack apps");
    expect(res.body.emoji).toBe("\uD83D\uDCE6");
    expect(res.body.path).toBe(projectPath);
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.updatedAt).toBeDefined();
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ description: "No name", path: projectPath });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Project name is required" });
  });

  it("returns 400 when name is empty string", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "   ", description: "Blank name", path: projectPath });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Project name is required" });
  });

  it("returns 400 when path is missing", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "No Path", description: "Missing path" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Project path is required" });
  });

  it("returns 400 when path is not absolute", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Relative Path", description: "Bad path", path: "relative/path" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Path must be an absolute path");
  });

  it("returns 400 when path does not exist", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Nonexistent Path", description: "Bad path", path: "/nonexistent/directory" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Path does not exist");
  });

  it("returns 400 when path is a file not a directory", async () => {
    const filePath = join(tempDir, "test-file.txt");
    await writeFile(filePath, "content", "utf-8");

    const res = await request(app)
      .post("/api/projects")
      .send({ name: "File Path", description: "Path is a file", path: filePath });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Path must be a directory");
  });

  it("returns 409 when creating a project with a duplicate name", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Duplicate Project", description: "First", path: projectPath });

    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Duplicate Project", description: "Second", path: projectPath });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "A project with this name already exists",
    });
  });

  it("defaults description to empty string when not provided", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "No Desc", path: projectPath });

    expect(res.status).toBe(201);
    expect(res.body.description).toBe("");
  });

  it("persists emoji when provided", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Emoji Project", description: "Has emoji", emoji: "\uD83D\uDE80", path: projectPath });

    expect(res.status).toBe(201);
    expect(res.body.emoji).toBe("\uD83D\uDE80");
  });

  it("defaults emoji to package emoji when not provided", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Default Emoji", description: "No emoji field", path: projectPath });

    expect(res.status).toBe(201);
    expect(res.body.emoji).toBe("\uD83D\uDCE6");
  });
});

describe("GET /api/projects/:id", () => {
  it("returns the full project object for an existing project", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Detail Project", description: "For detail test", path: projectPath });

    const res = await request(app).get("/api/projects/detail-project");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("detail-project");
    expect(res.body.name).toBe("Detail Project");
    expect(res.body.description).toBe("For detail test");
    expect(res.body.emoji).toBe("\uD83D\uDCE6");
    expect(res.body.path).toBe(projectPath);
  });

  it("returns 404 for a nonexistent project", async () => {
    const res = await request(app).get("/api/projects/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });
});

describe("PUT /api/projects/:id", () => {
  it("updates the name field of an existing project", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Update Me", description: "Original", path: projectPath });

    const res = await request(app)
      .put("/api/projects/update-me")
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.id).toBe("update-me");
  });

  it("returns 404 when updating a nonexistent project", async () => {
    const res = await request(app)
      .put("/api/projects/nonexistent")
      .send({ name: "Something" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });

  it("preserves the original ID even if body contains different ID", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Id Test", description: "", path: projectPath });

    const res = await request(app)
      .put("/api/projects/id-test")
      .send({ id: "different-id", name: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("id-test");
  });

  it("does not change createdAt on update", async () => {
    const createRes = await request(app)
      .post("/api/projects")
      .send({ name: "Timestamp Test", description: "", path: projectPath });

    const originalCreatedAt = createRes.body.createdAt;

    const res = await request(app)
      .put("/api/projects/timestamp-test")
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.createdAt).toBe(originalCreatedAt);
  });
});

describe("DELETE /api/projects/:id", () => {
  it("deletes an existing project and returns 204", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Delete Me", description: "To be deleted", path: projectPath });

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
      .send({ name: "Patch Name", description: "Original description", path: projectPath });

    const res = await request(app)
      .patch("/api/projects/patch-name")
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.description).toBe("Original description");
    expect(res.body.path).toBe(projectPath);
    expect(res.body.id).toBe("patch-name");
  });

  it("updates only the description field and preserves other fields", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Patch Desc", description: "Original", path: projectPath });

    const res = await request(app)
      .patch("/api/projects/patch-desc")
      .send({ description: "Updated description" });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe("Updated description");
    expect(res.body.name).toBe("Patch Desc");
    expect(res.body.path).toBe(projectPath);
  });

  it("returns 400 when name is a number", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Type Check", description: "", path: projectPath });

    const res = await request(app)
      .patch("/api/projects/type-check")
      .send({ name: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("name must be a non-empty string");
  });

  it("returns 400 when description is a boolean", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Bool Check", description: "", path: projectPath });

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
      .send({ name: "Empty Body", description: "", path: projectPath });

    const res = await request(app)
      .patch("/api/projects/empty-body")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("at least one updatable field");
  });

  it("returns 400 when name is an empty string", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Empty Name", description: "", path: projectPath });

    const res = await request(app)
      .patch("/api/projects/empty-name")
      .send({ name: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("name must be a non-empty string");
  });

  it("strips non-updatable fields like id and createdAt", async () => {
    const createRes = await request(app)
      .post("/api/projects")
      .send({ name: "Strip Fields", description: "Original", path: projectPath });

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
      .send({ name: "Patch Emoji", description: "Emoji test", path: projectPath });

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
      .send({ name: "Emoji Type Check", description: "", path: projectPath });

    const res = await request(app)
      .patch("/api/projects/emoji-type-check")
      .send({ emoji: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("emoji must be a string");
  });

  it("ignores unknown fields and processes valid ones", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Unknown Fields", description: "Original", path: projectPath });

    const res = await request(app)
      .patch("/api/projects/unknown-fields")
      .send({ name: "Changed", unknownField: "ignored" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Changed");
  });

  it("returns 400 when body only contains non-updatable fields", async () => {
    await request(app)
      .post("/api/projects")
      .send({ name: "Only Non Updatable", description: "", path: projectPath });

    const res = await request(app)
      .patch("/api/projects/only-non-updatable")
      .send({ id: "hacked", createdAt: "2000-01-01" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("at least one updatable field");
  });
});

