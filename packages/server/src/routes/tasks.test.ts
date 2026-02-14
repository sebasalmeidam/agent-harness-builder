import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;
let projectPath: string;
let projectId: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "harness-test-"));
  process.env["HARNESS_DATA_DIR"] = tempDir;
  projectPath = join(tempDir, "test-project");
  await mkdir(projectPath, { recursive: true });

  // Create a project for task tests
  const createRes = await request(app)
    .post("/api/projects")
    .send({ name: "Test Project", description: "For task tests", path: projectPath });
  projectId = createRes.body.id;
});

afterEach(async () => {
  delete process.env["HARNESS_DATA_DIR"];
  await rm(tempDir, { recursive: true, force: true });
});

describe("GET /api/projects/:id/tasks", () => {
  it("returns an empty array when no tasks exist", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/tasks`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 404 when project does not exist", async () => {
    const res = await request(app).get("/api/projects/nonexistent/tasks");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });

  it("returns tasks after creating them", async () => {
    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "First Task" });

    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Second Task" });

    const res = await request(app).get(`/api/projects/${projectId}/tasks`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe("First Task");
    expect(res.body[1].title).toBe("Second Task");
  });
});

describe("POST /api/projects/:id/tasks", () => {
  it("creates a task and returns 201 with the task object", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "My Task", description: "Task description" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.title).toBe("My Task");
    expect(res.body.description).toBe("Task description");
    expect(res.body.checklist).toEqual([]);
    expect(res.body.teamId).toBeNull();
    expect(res.body.status).toBe("pending");
  });

  it("creates a task with checklist items", async () => {
    const checklist = [
      { id: "1", description: "Step 1", completed: false },
      { id: "2", description: "Step 2", completed: true },
    ];

    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task with checklist", checklist });

    expect(res.status).toBe(201);
    expect(res.body.checklist).toHaveLength(2);
    expect(res.body.checklist[0].description).toBe("Step 1");
    expect(res.body.checklist[1].completed).toBe(true);
  });

  it("defaults description to empty string when not provided", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "No Description" });

    expect(res.status).toBe(201);
    expect(res.body.description).toBe("");
  });

  it("defaults checklist to empty array when not provided", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "No Checklist" });

    expect(res.status).toBe(201);
    expect(res.body.checklist).toEqual([]);
  });

  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ description: "No title" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Task title is required" });
  });

  it("returns 400 when title is empty string", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "   " });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Task title is required" });
  });

  it("returns 404 when project does not exist", async () => {
    const res = await request(app)
      .post("/api/projects/nonexistent/tasks")
      .send({ title: "Task" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });

  it("trims whitespace from title and description", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "  Trimmed Title  ", description: "  Trimmed Desc  " });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Trimmed Title");
    expect(res.body.description).toBe("Trimmed Desc");
  });
});

describe("GET /api/projects/:id/tasks/:taskId", () => {
  it("returns the task object for an existing task", async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Detail Task", description: "For detail test" });

    const taskId = createRes.body.id;

    const res = await request(app).get(`/api/projects/${projectId}/tasks/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(taskId);
    expect(res.body.title).toBe("Detail Task");
    expect(res.body.description).toBe("For detail test");
  });

  it("returns 404 for a nonexistent task", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/tasks/nonexistent-id`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
  });
});

describe("PUT /api/projects/:id/tasks/:taskId", () => {
  it("updates the title of a task", async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Original Title" });

    const taskId = createRes.body.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .send({ title: "Updated Title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
    expect(res.body.id).toBe(taskId);
  });

  it("updates the description of a task", async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task", description: "Original" });

    const taskId = createRes.body.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .send({ description: "Updated Description" });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe("Updated Description");
    expect(res.body.title).toBe("Task");
  });

  it("updates the checklist of a task", async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task", checklist: [] });

    const taskId = createRes.body.id;

    const newChecklist = [
      { id: "1", description: "New item", completed: false },
    ];

    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .send({ checklist: newChecklist });

    expect(res.status).toBe(200);
    expect(res.body.checklist).toHaveLength(1);
    expect(res.body.checklist[0].description).toBe("New item");
  });

  it("updates the team assignment of a task", async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task" });

    const taskId = createRes.body.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .send({ teamId: "team-123" });

    expect(res.status).toBe(200);
    expect(res.body.teamId).toBe("team-123");
  });

  it("returns 404 when updating a nonexistent task", async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/nonexistent-id`)
      .send({ title: "Updated" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
  });

  it("returns 400 when request body is missing", async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task" });

    const taskId = createRes.body.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Request body is required" });
  });

  it("ignores status field in PUT (managed by execution engine)", async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task" });

    const taskId = createRes.body.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .send({ status: "done", title: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
    expect(res.body.title).toBe("Updated");
  });

  it("preserves original id and projectId", async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task" });

    const taskId = createRes.body.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .send({ id: "different-id", projectId: "different-project", title: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(taskId);
    expect(res.body.projectId).toBe(projectId);
  });
});

describe("DELETE /api/projects/:id/tasks/:taskId", () => {
  it("deletes a task and returns 204", async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Delete Me" });

    const taskId = createRes.body.id;

    const res = await request(app).delete(`/api/projects/${projectId}/tasks/${taskId}`);
    expect(res.status).toBe(204);

    // Verify it is gone
    const getRes = await request(app).get(`/api/projects/${projectId}/tasks/${taskId}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting a nonexistent task", async () => {
    const res = await request(app).delete(`/api/projects/${projectId}/tasks/nonexistent-id`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found" });
  });
});

describe("Task count integration", () => {
  it("project list returns correct task count", async () => {
    // Create tasks for the project
    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task 1" });

    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task 2" });

    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task 3" });

    // Get project list
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);

    const project = res.body.find((p: { id: string }) => p.id === projectId);
    expect(project.taskCount).toBe(3);
  });

  it("project list returns 0 task count for project with no tasks", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);

    const project = res.body.find((p: { id: string }) => p.id === projectId);
    expect(project.taskCount).toBe(0);
  });

  it("task count updates when tasks are deleted", async () => {
    // Create tasks
    const createRes1 = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task 1" });

    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: "Task 2" });

    // Verify count is 2
    let res = await request(app).get("/api/projects");
    let project = res.body.find((p: { id: string }) => p.id === projectId);
    expect(project.taskCount).toBe(2);

    // Delete one task
    await request(app).delete(`/api/projects/${projectId}/tasks/${createRes1.body.id}`);

    // Verify count is now 1
    res = await request(app).get("/api/projects");
    project = res.body.find((p: { id: string }) => p.id === projectId);
    expect(project.taskCount).toBe(1);
  });
});
