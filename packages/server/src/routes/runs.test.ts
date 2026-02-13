import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as executionService from "../services/execution-service.js";
import * as projectService from "../services/project-service.js";
import * as teamService from "../services/team-service.js";

// Mock git-service to prevent real clone attempts
vi.mock("../services/git-service.js", () => ({
  cloneRepository: vi.fn().mockResolvedValue({ success: true }),
}));

let tempDir: string;

/**
 * Creates a project with a team assigned and a non-empty spec
 * for testing run endpoints.
 */
async function setupProjectWithTeam(): Promise<void> {
  // Create a team with agents and edges
  await teamService.create({ name: "Test Team", description: "A test team" });
  const team = await teamService.get("test-team");
  if (!team) {
    throw new Error("Failed to create test team");
  }

  await teamService.update("test-team", {
    ...team,
    agents: [
      {
        id: "agent-1",
        name: "Lead Agent",
        emoji: "👨‍💼",
        role: "Tech Lead",
        goal: "Coordinate the team",
        skills: ["architecture", "code review"],
        practices: ["clean code"],
        position: { x: 0, y: 0 },
      },
      {
        id: "agent-2",
        name: "Dev Agent",
        emoji: "👨‍💻",
        role: "Developer",
        goal: "Write code",
        skills: ["typescript", "react"],
        practices: ["TDD"],
        position: { x: 200, y: 0 },
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "agent-1",
        target: "agent-2",
        type: "passes-work-to",
        label: "Delegates to",
        failureRouting: null,
        gate: null,
      },
      {
        id: "edge-2",
        source: "agent-2",
        target: "agent-1",
        type: "escalates-to",
        label: "Escalates to",
        failureRouting: null,
        gate: null,
      },
    ],
  });

  // Create a project with team and spec
  await projectService.create({
    name: "Test Project",
    description: "A test project",
  });
  await projectService.update("test-project", {
    teamId: "test-team",
    spec: "Build a todo app with TypeScript",
  } as Partial<projectService.Project>);
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "runs-test-"));
  process.env["HARNESS_DATA_DIR"] = tempDir;
  process.env["ANTHROPIC_API_KEY"] = "test-api-key-not-real";
  executionService._clearActiveRuns();
});

afterEach(async () => {
  delete process.env["HARNESS_DATA_DIR"];
  delete process.env["ANTHROPIC_API_KEY"];
  executionService._clearActiveRuns();
  await rm(tempDir, { recursive: true, force: true });
});

describe("POST /api/projects/:id/runs", () => {
  it("triggers a run and returns 201 with run ID", async () => {
    await setupProjectWithTeam();

    const res = await request(app).post("/api/projects/test-project/runs");

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(typeof res.body.id).toBe("string");
    expect(res.body.status).toBe("running");
    expect(res.body.startedAt).toBeDefined();
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await request(app).post("/api/projects/nonexistent/runs");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });

  it("returns 400 when project has no team assigned", async () => {
    // Create project without team
    await projectService.create({
      name: "No Team",
      description: "Has no team",
    });

    const res = await request(app).post("/api/projects/no-team/runs");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Project has no team assigned" });
  });

  it("returns 400 when project has empty spec", async () => {
    // Create team first
    await teamService.create({ name: "Some Team", description: "A team" });
    const team = await teamService.get("some-team");
    await teamService.update("some-team", {
      ...team!,
      agents: [
        {
          id: "a1",
          name: "Agent",
          emoji: "🤖",
          role: "Dev",
          goal: "Code",
          skills: [],
          practices: [],
          position: { x: 0, y: 0 },
        },
      ],
    });

    await projectService.create({
      name: "No Spec",
      description: "Has team but no spec",
    });
    await projectService.update("no-spec", {
      teamId: "some-team",
      spec: "",
    } as Partial<projectService.Project>);

    const res = await request(app).post("/api/projects/no-spec/runs");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Project spec is empty" });
  });

  it("returns 201 and starts simulation when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env["ANTHROPIC_API_KEY"];
    await setupProjectWithTeam();

    const res = await request(app).post("/api/projects/test-project/runs");

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(typeof res.body.id).toBe("string");
    expect(res.body.status).toBe("running");
    expect(res.body.startedAt).toBeDefined();
  });
});

describe("GET /api/projects/:id/runs", () => {
  it("returns an empty array when no runs exist", async () => {
    await projectService.create({
      name: "Empty Project",
      description: "No runs yet",
    });

    const res = await request(app).get("/api/projects/empty-project/runs");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await request(app).get("/api/projects/nonexistent/runs");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });

  it("returns run summaries after triggering a run", async () => {
    await setupProjectWithTeam();

    // Trigger a run
    const triggerRes = await request(app).post("/api/projects/test-project/runs");
    expect(triggerRes.status).toBe(201);

    // Wait for simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const res = await request(app).get("/api/projects/test-project/runs");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBeDefined();
    expect(res.body[0].status).toBeDefined();
    expect(res.body[0].startedAt).toBeDefined();
  });
});

describe("GET /api/projects/:id/runs/:runId", () => {
  it("returns full run data for an existing run", async () => {
    await setupProjectWithTeam();

    const triggerRes = await request(app).post("/api/projects/test-project/runs");
    const runId = triggerRes.body.id;

    // Wait for simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const res = await request(app).get(
      `/api/projects/test-project/runs/${runId}`
    );

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(runId);
    expect(res.body.projectId).toBe("test-project");
    expect(res.body.teamId).toBe("test-team");
    expect(res.body.status).toBeDefined();
    expect(res.body.startedAt).toBeDefined();
    expect(res.body.agentStatuses).toBeDefined();
    expect(res.body.activityLog).toBeDefined();
    expect(res.body.files).toBeDefined();
  });

  it("returns 404 for nonexistent run", async () => {
    await projectService.create({
      name: "Some Project",
      description: "For run lookup",
    });

    const res = await request(app).get(
      "/api/projects/some-project/runs/nonexistent-run-id"
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Run not found" });
  });

  it("returns active run data from memory for in-progress runs", async () => {
    await setupProjectWithTeam();

    const triggerRes = await request(app).post("/api/projects/test-project/runs");
    const runId = triggerRes.body.id;

    // Immediately fetch without waiting for completion
    const res = await request(app).get(
      `/api/projects/test-project/runs/${runId}`
    );

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(runId);
    expect(res.body.projectId).toBe("test-project");
  });
});

describe("GET /api/projects/:id/runs/:runId/events (SSE)", () => {
  it("sets the correct SSE content-type header", async () => {
    await setupProjectWithTeam();

    const triggerRes = await request(app).post("/api/projects/test-project/runs");
    const runId = triggerRes.body.id;

    // Wait for execution to complete so the SSE endpoint sends connected event and closes
    await new Promise((resolve) => setTimeout(resolve, 500));

    const res = await request(app).get(
      `/api/projects/test-project/runs/${runId}/events`
    );

    expect(res.headers["content-type"]).toContain("text/event-stream");
  });

  it("returns 404 for nonexistent run", async () => {
    await projectService.create({
      name: "SSE Project",
      description: "For SSE test",
    });

    const res = await request(app).get(
      "/api/projects/sse-project/runs/nonexistent-run-id/events"
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Run not found" });
  });

  it("sends a connected event with the current run state", async () => {
    await setupProjectWithTeam();

    const triggerRes = await request(app).post("/api/projects/test-project/runs");
    const runId = triggerRes.body.id;

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const res = await request(app).get(
      `/api/projects/test-project/runs/${runId}/events`
    );

    // Parse the SSE response text
    const text = res.text;
    expect(text).toContain("event: connected");
    expect(text).toContain("data: ");

    // Extract the data portion after "event: connected\ndata: "
    const lines = text.split("\n");
    const dataLineIndex = lines.findIndex((line: string) =>
      line.startsWith("data: ")
    );
    expect(dataLineIndex).toBeGreaterThanOrEqual(0);

    const dataJson = lines[dataLineIndex]!.slice(6); // Remove "data: " prefix
    const data = JSON.parse(dataJson);
    expect(data.status).toBeDefined();
    expect(data.agentStatuses).toBeDefined();
    expect(data.activityLog).toBeDefined();
    expect(data.files).toBeDefined();
  });

  it("closes the connection for completed runs after sending state", async () => {
    await setupProjectWithTeam();

    const triggerRes = await request(app).post("/api/projects/test-project/runs");
    const runId = triggerRes.body.id;

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const res = await request(app).get(
      `/api/projects/test-project/runs/${runId}/events`
    );

    // For completed runs, the response should be complete (connection closed)
    expect(res.status).toBe(200);
    expect(res.text).toContain("event: connected");
  });
});
