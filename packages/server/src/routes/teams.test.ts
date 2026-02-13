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
      agentEmojis: [],
    });
  });

  it("returns agentEmojis in team summaries when team has agents", async () => {
    await request(app)
      .post("/api/teams")
      .send({ name: "Emoji Team", description: "Has agents" });

    await request(app)
      .put("/api/teams/emoji-team")
      .send({
        id: "emoji-team",
        name: "Emoji Team",
        description: "Has agents",
        agents: [
          { id: "a1", name: "Dev", emoji: "\uD83D\uDC68\u200D\uD83D\uDCBB", role: "dev", goal: "", skills: [], practices: [], position: { x: 0, y: 0 } },
          { id: "a2", name: "QA", emoji: "\uD83D\uDD0D", role: "qa", goal: "", skills: [], practices: [], position: { x: 100, y: 0 } },
        ],
        edges: [],
      });

    const res = await request(app).get("/api/teams");
    const team = res.body.find((t: { id: string }) => t.id === "emoji-team");
    expect(team.agentEmojis).toEqual(["\uD83D\uDC68\u200D\uD83D\uDCBB", "\uD83D\uDD0D"]);
    expect(team.agentCount).toBe(2);
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

describe("GET /api/teams/:id/harness", () => {
  it("returns a harness with version 1.0 and correct agents and edges", async () => {
    // Create a team
    await request(app)
      .post("/api/teams")
      .send({ name: "Harness Team", description: "For harness export" });

    // Add agents and edges via update
    await request(app)
      .put("/api/teams/harness-team")
      .send({
        id: "harness-team",
        name: "Harness Team",
        description: "For harness export",
        agents: [
          {
            id: "agent-1",
            name: "Developer",
            emoji: "👨‍💻",
            role: "software-developer",
            goal: "Write clean code",
            skills: ["TypeScript", "React"],
            practices: ["TDD", "Code review"],
            position: { x: 100, y: 200 },
          },
          {
            id: "agent-2",
            name: "Reviewer",
            emoji: "🔍",
            role: "code-reviewer",
            goal: "Ensure quality",
            skills: ["Architecture"],
            practices: ["SOLID"],
            position: { x: 300, y: 200 },
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "agent-1",
            target: "agent-2",
            type: "passes-work-to",
            label: "Submit for review",
            failureRouting: null,
            gate: { type: "auto" },
          },
        ],
      });

    const res = await request(app).get("/api/teams/harness-team/harness");
    expect(res.status).toBe(200);
    expect(res.body.harnessVersion).toBe("1.0");
    expect(res.body.name).toBe("Harness Team");
    expect(res.body.description).toBe("For harness export");
    expect(res.body.agents).toHaveLength(2);
    expect(res.body.agents[0]).toEqual({
      id: "agent-1",
      name: "Developer",
      emoji: "👨‍💻",
      role: "software-developer",
      goal: "Write clean code",
      skills: ["TypeScript", "React"],
      practices: ["TDD", "Code review"],
      position: { x: 100, y: 200 },
    });
    expect(res.body.agents[1]).toEqual({
      id: "agent-2",
      name: "Reviewer",
      emoji: "🔍",
      role: "code-reviewer",
      goal: "Ensure quality",
      skills: ["Architecture"],
      practices: ["SOLID"],
      position: { x: 300, y: 200 },
    });
    expect(res.body.edges).toHaveLength(1);
    expect(res.body.edges[0]).toEqual({
      id: "edge-1",
      source: "agent-1",
      target: "agent-2",
      type: "passes-work-to",
      label: "Submit for review",
      failureRouting: null,
      gate: { type: "auto" },
    });
  });

  it("returns 404 for a nonexistent team", async () => {
    const res = await request(app).get("/api/teams/nonexistent/harness");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Team not found" });
  });

  it("returns 400 for a team with no agents", async () => {
    await request(app)
      .post("/api/teams")
      .send({ name: "Empty Team", description: "No agents here" });

    const res = await request(app).get("/api/teams/empty-team/harness");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Team has no agents" });
  });
});

describe("POST /api/teams/import", () => {
  const validHarness = {
    harnessVersion: "1.0",
    name: "Imported Team",
    description: "A team from harness import",
    agents: [
      {
        id: "agent-a",
        name: "Planner",
        emoji: "\uD83D\uDCCB",
        role: "project-planner",
        goal: "Plan the project",
        skills: ["Planning", "Coordination"],
        practices: ["Agile"],
        position: { x: 50, y: 100 },
      },
      {
        id: "agent-b",
        name: "Builder",
        emoji: "\uD83D\uDEE0\uFE0F",
        role: "software-developer",
        goal: "Build features",
        skills: ["TypeScript"],
        practices: ["TDD"],
        position: { x: 250, y: 100 },
      },
    ],
    edges: [
      {
        id: "edge-a",
        source: "agent-a",
        target: "agent-b",
        type: "passes-work-to",
        label: "Assign task",
        failureRouting: null,
        gate: { type: "manual" },
      },
    ],
  };

  it("creates a team from a valid harness and returns 201", async () => {
    const res = await request(app)
      .post("/api/teams/import")
      .send(validHarness);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("imported-team");
    expect(res.body.name).toBe("Imported Team");
    expect(res.body.description).toBe("A team from harness import");
    expect(res.body.agents).toHaveLength(2);
    expect(res.body.agents[0]).toEqual({
      id: "agent-a",
      name: "Planner",
      emoji: "\uD83D\uDCCB",
      role: "project-planner",
      goal: "Plan the project",
      skills: ["Planning", "Coordination"],
      practices: ["Agile"],
      position: { x: 50, y: 100 },
    });
    expect(res.body.agents[1]).toEqual({
      id: "agent-b",
      name: "Builder",
      emoji: "\uD83D\uDEE0\uFE0F",
      role: "software-developer",
      goal: "Build features",
      skills: ["TypeScript"],
      practices: ["TDD"],
      position: { x: 250, y: 100 },
    });
    expect(res.body.edges).toHaveLength(1);
    expect(res.body.edges[0]).toEqual({
      id: "edge-a",
      source: "agent-a",
      target: "agent-b",
      type: "passes-work-to",
      label: "Assign task",
      failureRouting: null,
      gate: { type: "manual" },
    });
  });

  it("returns 400 when harnessVersion is missing", async () => {
    const res = await request(app)
      .post("/api/teams/import")
      .send({
        name: "Bad Harness",
        description: "",
        agents: [{ id: "a", name: "Agent", emoji: "", role: "", goal: "", skills: [], practices: [], position: { x: 0, y: 0 } }],
        edges: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("harnessVersion");
  });

  it("returns 400 when agents array is empty", async () => {
    const res = await request(app)
      .post("/api/teams/import")
      .send({
        harnessVersion: "1.0",
        name: "No Agents Harness",
        description: "",
        agents: [],
        edges: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("at least one agent");
  });

  it("returns 409 when team name already exists", async () => {
    // Create a team first
    await request(app)
      .post("/api/teams")
      .send({ name: "Imported Team", description: "Already exists" });

    // Try to import a harness with the same name
    const res = await request(app)
      .post("/api/teams/import")
      .send(validHarness);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "A team with this name already exists" });
  });

  it("round-trip: export then import produces equivalent team data", async () => {
    // Step 1: Create a team with agents and edges
    await request(app)
      .post("/api/teams")
      .send({ name: "Round Trip Team", description: "Testing round-trip" });

    const agents = [
      {
        id: "rt-agent-1",
        name: "Analyst",
        emoji: "\uD83D\uDD0D",
        role: "business-analyst",
        goal: "Analyze requirements",
        skills: ["Analysis", "Documentation"],
        practices: ["BDD", "Story mapping"],
        position: { x: 100, y: 150 },
      },
      {
        id: "rt-agent-2",
        name: "Developer",
        emoji: "\uD83D\uDC68\u200D\uD83D\uDCBB",
        role: "software-developer",
        goal: "Implement features",
        skills: ["TypeScript", "React"],
        practices: ["TDD"],
        position: { x: 300, y: 150 },
      },
    ];

    const edges = [
      {
        id: "rt-edge-1",
        source: "rt-agent-1",
        target: "rt-agent-2",
        type: "passes-work-to",
        label: "Hand off specs",
        failureRouting: "loop-back",
        gate: { type: "auto" },
      },
    ];

    await request(app)
      .put("/api/teams/round-trip-team")
      .send({
        id: "round-trip-team",
        name: "Round Trip Team",
        description: "Testing round-trip",
        agents,
        edges,
      });

    // Step 2: Export the harness
    const exportRes = await request(app).get("/api/teams/round-trip-team/harness");
    expect(exportRes.status).toBe(200);
    const harness = exportRes.body;

    // Step 3: Import with a different name to avoid conflict
    harness.name = "Round Trip Imported";
    const importRes = await request(app)
      .post("/api/teams/import")
      .send(harness);

    expect(importRes.status).toBe(201);
    const importedTeam = importRes.body;

    // Step 4: Verify equivalent data (agents and edges match)
    expect(importedTeam.agents).toHaveLength(agents.length);
    for (let i = 0; i < agents.length; i++) {
      expect(importedTeam.agents[i]).toEqual(agents[i]);
    }

    expect(importedTeam.edges).toHaveLength(edges.length);
    for (let i = 0; i < edges.length; i++) {
      expect(importedTeam.edges[i]).toEqual(edges[i]);
    }

    // Verify the imported team has the new name but same structure
    expect(importedTeam.name).toBe("Round Trip Imported");
    expect(importedTeam.id).toBe("round-trip-imported");
  });
});
