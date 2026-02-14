import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock git-service to prevent real clone attempts when project-service is used
vi.mock("./git-service.js", () => ({
  cloneRepository: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock the runtime package to prevent real SDK calls
vi.mock("@agent-harness/runtime", async () => {
  const actual = await vi.importActual("@agent-harness/runtime");
  return {
    ...actual,
    executeWithSdk: vi.fn(),
  };
});

import * as executionService from "./execution-service.js";
import * as runService from "./run-service.js";
import * as projectService from "./project-service.js";
import * as teamService from "./team-service.js";

let tempDir: string;

/**
 * Creates a project with a team assigned and a non-empty spec
 * in the temp directory for testing.
 */
async function setupProjectWithTeam(): Promise<void> {
  // Create a team
  await teamService.create({ name: "Test Team", description: "A test team" });
  const team = await teamService.get("test-team");
  if (!team) {
    throw new Error("Failed to create test team");
  }

  // Add agents and edges to the team
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
  tempDir = await mkdtemp(join(tmpdir(), "execution-service-test-"));
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

describe("startRun", () => {
  it("rejects when project does not exist", async () => {
    await expect(
      executionService.startRun("nonexistent-project")
    ).rejects.toThrow("Project not found");

    try {
      await executionService.startRun("nonexistent-project");
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe("NOT_FOUND");
    }
  });

  it("rejects when project has no team assigned", async () => {
    // Create project without team
    await projectService.create({
      name: "No Team Project",
      description: "Has no team",
    });

    await expect(
      executionService.startRun("no-team-project")
    ).rejects.toThrow("Project has no team assigned");

    try {
      await executionService.startRun("no-team-project");
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe("NO_TEAM");
    }
  });

  it("rejects when project has empty spec", async () => {
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
      name: "Empty Spec Project",
      description: "Has a team but no spec",
    });
    await projectService.update("empty-spec-project", {
      teamId: "some-team",
      spec: "",
    } as Partial<projectService.Project>);

    await expect(
      executionService.startRun("empty-spec-project")
    ).rejects.toThrow("Project spec is empty");

    try {
      await executionService.startRun("empty-spec-project");
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe("NO_SPEC");
    }
  });

  it("succeeds with simulation when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env["ANTHROPIC_API_KEY"];

    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");
    expect(runId).toBeDefined();
    expect(typeof runId).toBe("string");

    // Subscribe to events to verify simulation produces expected output
    const events: executionService.RunEvent[] = [];
    const callback: executionService.RunEventCallback = (event) => {
      events.push(event);
    };
    executionService.onRunEvent(runId, callback);

    // Wait for simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should have received agent-status events
    const statusEvents = events.filter((e) => e.type === "agent-status");
    expect(statusEvents.length).toBeGreaterThan(0);

    // Should have received activity events
    const activityEvents = events.filter((e) => e.type === "activity");
    expect(activityEvents.length).toBeGreaterThan(0);

    // Should have received a run-status event (completion summary)
    const runStatusEvents = events.filter((e) => e.type === "run-status");
    expect(runStatusEvents.length).toBe(1);
    expect(runStatusEvents[0]!.data["status"]).toBe("completed");

    executionService.offRunEvent(runId, callback);
  });

  it("creates a run record with status running and all agents idle", async () => {
    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");
    expect(runId).toBeDefined();
    expect(typeof runId).toBe("string");

    // Check the run was persisted
    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("running");
    expect(run!.projectId).toBe("test-project");
    expect(run!.teamId).toBe("test-team");
    expect(run!.startedAt).toBeDefined();
    expect(run!.completedAt).toBeNull();
    expect(run!.error).toBeNull();

    // All agents should start as idle
    const statuses = Object.values(run!.agentStatuses);
    for (const status of statuses) {
      expect(status).toBe("idle");
    }
  });

  it("returns the run in active runs after starting", async () => {
    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");
    const activeRun = executionService.getActiveRun(runId);
    expect(activeRun).not.toBeNull();
    expect(activeRun!.id).toBe(runId);
  });
});

describe("getActiveRun", () => {
  it("returns null for a nonexistent run", () => {
    const result = executionService.getActiveRun("nonexistent");
    expect(result).toBeNull();
  });
});

describe("event subscriptions", () => {
  it("receives events when subscribed to a run", async () => {
    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");

    const events: executionService.RunEvent[] = [];
    const callback: executionService.RunEventCallback = (event) => {
      events.push(event);
    };

    executionService.onRunEvent(runId, callback);

    // Wait for the simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should have received events (agent-status, activity, file-change, run-status)
    expect(events.length).toBeGreaterThan(0);

    // Should have received at least one agent-status event
    const statusEvents = events.filter((e) => e.type === "agent-status");
    expect(statusEvents.length).toBeGreaterThan(0);

    // Should have received at least one activity event
    const activityEvents = events.filter((e) => e.type === "activity");
    expect(activityEvents.length).toBeGreaterThan(0);

    // Should have received a run-status event at completion
    const runStatusEvents = events.filter((e) => e.type === "run-status");
    expect(runStatusEvents.length).toBeGreaterThan(0);

    // Cleanup
    executionService.offRunEvent(runId, callback);
  });

  it("does not receive events after unsubscribing", async () => {
    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");

    const events: executionService.RunEvent[] = [];
    const callback: executionService.RunEventCallback = (event) => {
      events.push(event);
    };

    executionService.onRunEvent(runId, callback);
    executionService.offRunEvent(runId, callback);

    // Wait for the simulated execution
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should not have received events after unsubscribing
    expect(events.length).toBe(0);
  });
});

describe("simulated execution completion", () => {
  it("completes the run with a summary after simulation", async () => {
    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");

    // Wait for simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check the run was persisted with completion data
    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("completed");
    expect(run!.completedAt).not.toBeNull();
    expect(run!.error).toBeNull();

    // Summary should be populated
    expect(run!.summary).not.toBeNull();
    expect(run!.summary!.filesChanged).toBeGreaterThanOrEqual(0);
    expect(run!.summary!.totalTime).toBeGreaterThanOrEqual(0);
    expect(run!.summary!.iterations).toBeGreaterThan(0);
    expect(run!.summary!.errors).toBe(0);

    // All agents should be in terminal state (done)
    for (const status of Object.values(run!.agentStatuses)) {
      expect(status).toBe("done");
    }

    // Activity log should have entries
    expect(run!.activityLog.length).toBeGreaterThan(0);
  });

  it("records file changes during simulation", async () => {
    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");

    // Wait for simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();

    // The simulation creates file entries for each teammate's work
    expect(run!.files.length).toBeGreaterThan(0);
  });

  it("activity log entries have required fields", async () => {
    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");

    // Wait for simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();

    for (const entry of run!.activityLog) {
      expect(entry.timestamp).toBeDefined();
      expect(entry.agentId).toBeDefined();
      expect(typeof entry.agentEmoji).toBe("string");
      expect(entry.agentName).toBeDefined();
      expect(entry.message).toBeDefined();
      expect(["action", "handoff", "error", "complete"]).toContain(entry.type);
    }
  });

  it("includes handoff entries in the activity log", async () => {
    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");

    // Wait for simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();

    const handoffs = run!.activityLog.filter((e) => e.type === "handoff");
    expect(handoffs.length).toBeGreaterThan(0);
  });
});

describe("SDK message mapping", () => {
  it("creates ActivityEntry for assistant message with text content", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to return an assistant message with text
    async function* mockGenerator() {
      yield {
        type: "assistant",
        message: {
          id: "msg_1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Analyzing the task..." }],
          model: "claude-sonnet-4-20250514",
          stop_reason: null,
          usage: { input_tokens: 10, output_tokens: 20 },
        },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };
      yield {
        type: "result",
        subtype: "success",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        result: "Task completed",
        stop_reason: "end_turn",
        total_cost_usd: 0.01,
        usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid-2",
        session_id: "session-1",
      };
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();

    // Should have action entries from the assistant message
    const actionEntries = run!.activityLog.filter((e) => e.type === "action");
    expect(actionEntries.length).toBeGreaterThan(0);
    expect(actionEntries.some((e) => e.message.includes("Analyzing"))).toBe(true);
  });

  it("adds file to run.files when tool_use is Write", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to return tool_use for Write tool
    async function* mockGenerator() {
      yield {
        type: "assistant",
        message: {
          id: "msg_1",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "Write",
              input: { file_path: "/test/output.ts", content: "console.log('test');" },
            },
          ],
          model: "claude-sonnet-4-20250514",
          stop_reason: null,
          usage: { input_tokens: 10, output_tokens: 20 },
        },
        parent_tool_use_id: null,
        uuid: "uuid-1",
        session_id: "session-1",
      };
      yield {
        type: "result",
        subtype: "success",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        result: "File written",
        stop_reason: "end_turn",
        total_cost_usd: 0.01,
        usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid-2",
        session_id: "session-1",
      };
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.files).toContain("/test/output.ts");
  });

  it("completes run as completed when result message has subtype success", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to return success result
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "success",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        result: "All tasks completed successfully",
        stop_reason: "end_turn",
        total_cost_usd: 0.05,
        usage: { input_tokens: 100, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid-1",
        session_id: "session-1",
      };
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("completed");
    expect(run!.error).toBeNull();
    expect(run!.costUsd).toBe(0.05);
  });

  it("completes run as failed when result message has error subtype", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to return error result
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "error_during_execution",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: true,
        num_turns: 2,
        stop_reason: "error",
        total_cost_usd: 0.03,
        usage: { input_tokens: 50, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        errors: ["Tool execution failed", "Permission denied"],
        uuid: "uuid-1",
        session_id: "session-1",
      };
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("failed");
    expect(run!.error).toContain("Tool execution failed");
    expect(run!.error).toContain("Permission denied");
    expect(run!.costUsd).toBe(0.03);

    // Should have an error activity entry
    const errorEntries = run!.activityLog.filter((e) => e.type === "error");
    expect(errorEntries.length).toBeGreaterThan(0);
  });
});

describe("Phase 3: Task-Level Execution", () => {
  it("constructs prompt from taskDescription and checklist", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to capture the prompt parameter
    let capturedPrompt: string | undefined;
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "success",
        result: "Task completed",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        stop_reason: "end_turn",
        total_cost_usd: 0.01,
        usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid-1",
        session_id: "session-1",
      };
    }
    executeWithSdkMock.mockImplementation((params) => {
      capturedPrompt = params.prompt;
      return mockGenerator() as never;
    });

    await setupProjectWithTeam();
    await executionService.startRun("test-project", {
      taskDescription: "Implement user authentication",
      checklist: ["Add login form", "Add password validation", "Add session management"],
    });

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(capturedPrompt).toBeDefined();
    expect(capturedPrompt).toContain("Task: Implement user authentication");
    expect(capturedPrompt).toContain("Checklist:");
    expect(capturedPrompt).toContain("- [ ] Add login form");
    expect(capturedPrompt).toContain("- [ ] Add password validation");
    expect(capturedPrompt).toContain("- [ ] Add session management");
    expect(capturedPrompt).toContain("Complete all checklist items");
  });

  it("uses project spec as prompt when no taskDescription provided (backward compatible)", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to capture the prompt parameter
    let capturedPrompt: string | undefined;
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "success",
        result: "Task completed",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        stop_reason: "end_turn",
        total_cost_usd: 0.01,
        usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid-1",
        session_id: "session-1",
      };
    }
    executeWithSdkMock.mockImplementation((params) => {
      capturedPrompt = params.prompt;
      return mockGenerator() as never;
    });

    await setupProjectWithTeam();
    await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(capturedPrompt).toBeDefined();
    expect(capturedPrompt).toBe("Build a todo app with TypeScript");
  });

  it("resolves working directory to workspace subdirectory when it exists", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);
    const fs = await import("node:fs/promises");

    // Mock SDK to capture the cwd parameter
    let capturedCwd: string | undefined;
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "success",
        result: "Task completed",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        stop_reason: "end_turn",
        total_cost_usd: 0.01,
        usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid-1",
        session_id: "session-1",
      };
    }
    executeWithSdkMock.mockImplementation((params) => {
      capturedCwd = params.cwd;
      return mockGenerator() as never;
    });

    await setupProjectWithTeam();

    // Create workspace directory
    const projectDir = `${tempDir}/projects/test-project`;
    const workspaceDir = `${projectDir}/workspace`;
    await fs.mkdir(workspaceDir, { recursive: true });

    await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(capturedCwd).toBeDefined();
    expect(capturedCwd).toBe(workspaceDir);
  });

  it("resolves working directory to project directory when workspace does not exist", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to capture the cwd parameter
    let capturedCwd: string | undefined;
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "success",
        result: "Task completed",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        stop_reason: "end_turn",
        total_cost_usd: 0.01,
        usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid-1",
        session_id: "session-1",
      };
    }
    executeWithSdkMock.mockImplementation((params) => {
      capturedCwd = params.cwd;
      return mockGenerator() as never;
    });

    await setupProjectWithTeam();
    await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(capturedCwd).toBeDefined();
    expect(capturedCwd).toBe(`${tempDir}/projects/test-project`);
  });

  it("passes agent skills to resolveTools", async () => {
    const { executeWithSdk, resolveTools } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to capture the tools parameter
    let capturedTools: string[] | undefined;
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "success",
        result: "Task completed",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        stop_reason: "end_turn",
        total_cost_usd: 0.01,
        usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        uuid: "uuid-1",
        session_id: "session-1",
      };
    }
    executeWithSdkMock.mockImplementation((params) => {
      capturedTools = params.tools;
      return mockGenerator() as never;
    });

    await setupProjectWithTeam();
    await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(capturedTools).toBeDefined();
    // The lead agent has skills: ["architecture", "code review"]
    // These should be passed to resolveTools which returns the default tool set
    const expectedTools = resolveTools(["architecture", "code review"]);
    expect(capturedTools).toEqual(expectedTools);
  });
});
