import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
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
let projectPath: string;

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
        skillIds: [],
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
        skillIds: [],
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
    path: projectPath,
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
  // Create a valid project directory for testing
  projectPath = join(tempDir, "test-project");
  await mkdir(projectPath, { recursive: true });
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
      path: projectPath,
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
          skillIds: [],
          practices: [],
          position: { x: 0, y: 0 },
        },
      ],
    });

    await projectService.create({
      name: "Empty Spec Project",
      description: "Has a team but no spec",
      path: projectPath,
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
    // Remove API key to force simulation path
    const originalKey = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];

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

    // Restore API key for other tests
    if (originalKey) {
      process.env["ANTHROPIC_API_KEY"] = originalKey;
    }
  });

  it("records file changes during simulation", async () => {
    // Remove API key to force simulation path
    const originalKey = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];

    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");

    // Wait for simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();

    // The simulation creates file entries for each teammate's work
    expect(run!.files.length).toBeGreaterThan(0);

    // Restore API key for other tests
    if (originalKey) {
      process.env["ANTHROPIC_API_KEY"] = originalKey;
    }
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
    // Remove API key to force simulation path
    const originalKey = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];

    await setupProjectWithTeam();

    const { runId } = await executionService.startRun("test-project");

    // Wait for simulated execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();

    const handoffs = run!.activityLog.filter((e) => e.type === "handoff");
    expect(handoffs.length).toBeGreaterThan(0);

    // Restore API key for other tests
    if (originalKey) {
      process.env["ANTHROPIC_API_KEY"] = originalKey;
    }
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
    expect(capturedPrompt).toContain("After completing your work, verify each checklist item");
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
    const expectedTools = resolveTools(["architecture", "code review"], true);
    expect(capturedTools).toEqual(expectedTools);
  });
});

describe("Phase 4: Error Handling and API Key Validation", () => {
  it("falls back to simulation when ANTHROPIC_API_KEY is not set", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Clear mock call history before this test
    executeWithSdkMock.mockClear();

    // Remove API key to trigger simulation path
    const originalKey = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // SDK should not have been called (simulation path used instead)
    expect(executeWithSdkMock).not.toHaveBeenCalled();

    // Run should complete successfully with simulation
    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("completed");

    // Restore API key for other tests
    if (originalKey) {
      process.env["ANTHROPIC_API_KEY"] = originalKey;
    }
  });

  it("creates error ActivityEntry when SDK throws rate limit error", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to throw rate limit error
    async function* mockGenerator() {
      throw new Error("Rate limit exceeded for requests. Please try again in 429 seconds.");
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("failed");

    // Should have an error activity entry with rate limit message
    const errorEntries = run!.activityLog.filter((e) => e.type === "error");
    expect(errorEntries.length).toBeGreaterThan(0);
    expect(errorEntries[0]!.message).toContain("Rate limit exceeded");
  });

  it("creates error ActivityEntry when SDK throws network error", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to throw network error
    async function* mockGenerator() {
      throw new Error("Network error: ECONNREFUSED");
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("failed");

    // Should have an error activity entry with network error message
    const errorEntries = run!.activityLog.filter((e) => e.type === "error");
    expect(errorEntries.length).toBeGreaterThan(0);
    expect(errorEntries[0]!.message).toContain("Network error");
  });

  it("creates error ActivityEntry when SDK throws invalid API key error", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to throw API key error
    async function* mockGenerator() {
      throw new Error("Authentication failed: invalid API key");
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("failed");

    // Should have an error activity entry with API key error message
    const errorEntries = run!.activityLog.filter((e) => e.type === "error");
    expect(errorEntries.length).toBeGreaterThan(0);
    expect(errorEntries[0]!.message).toContain("Invalid or missing Anthropic API key");
  });

  it("marks run as failed and sets agent status to blocked on SDK error", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to throw generic error
    async function* mockGenerator() {
      throw new Error("SDK internal error occurred");
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project");

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const run = await runService.get("test-project", runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("failed");
    expect(run!.error).toBeDefined();

    // Lead agent should be in blocked state
    const leadStatus = run!.agentStatuses["Lead Agent"];
    expect(leadStatus).toBe("blocked");
  });

  it("supports concurrent execution with independent run state", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Clear mock call history and set up fresh implementation
    executeWithSdkMock.mockClear();

    // Track how many times SDK is called in THIS test
    let callCount = 0;

    // Mock SDK to return success for each call
    executeWithSdkMock.mockImplementation(() => {
      callCount++;
      async function* mockGenerator() {
        yield {
          type: "result",
          subtype: "success",
          result: `Task ${callCount} completed`,
          duration_ms: 1000,
          duration_api_ms: 800,
          is_error: false,
          num_turns: 1,
          stop_reason: "end_turn",
          total_cost_usd: 0.01,
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          modelUsage: {},
          permission_denials: [],
          uuid: `uuid-${callCount}`,
          session_id: `session-${callCount}`,
        };
      }
      return mockGenerator() as never;
    });

    await setupProjectWithTeam();

    // Start two concurrent runs
    const run1Promise = executionService.startRun("test-project");
    const run2Promise = executionService.startRun("test-project");

    const [result1, result2] = await Promise.all([run1Promise, run2Promise]);

    // Should have different run IDs
    expect(result1.runId).not.toBe(result2.runId);

    // Wait for both executions to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Both runs should be persisted
    const run1 = await runService.get("test-project", result1.runId);
    const run2 = await runService.get("test-project", result2.runId);

    expect(run1).not.toBeNull();
    expect(run2).not.toBeNull();

    // Both should complete successfully
    expect(run1!.status).toBe("completed");
    expect(run2!.status).toBe("completed");

    // SDK should have been called exactly twice (once per run in this test)
    expect(callCount).toBe(2);
    expect(executeWithSdkMock).toHaveBeenCalledTimes(2);

    // Each run should have independent state
    expect(run1!.id).toBe(result1.runId);
    expect(run2!.id).toBe(result2.runId);
    expect(run1!.activityLog.length).toBeGreaterThan(0);
    expect(run2!.activityLog.length).toBeGreaterThan(0);
  });
});

describe("Progress file integration", () => {
  it("creates progress.md at execution start with task description and checklist", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to return success
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "success",
        result: "Task completed",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        agent_outputs: [],
        errors: [],
        status: "success",
      };
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project", {
      taskDescription: "Build a todo app",
      checklist: ["Create UI", "Add backend", "Write tests"],
    });

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Read progress file
    const { readFile } = await import("node:fs/promises");
    const progressPath = join(
      tempDir,
      "projects",
      "test-project",
      ".runs",
      runId,
      "progress.md"
    );
    const content = await readFile(progressPath, "utf-8");

    expect(content).toContain("# Execution Progress");
    expect(content).toContain(`**Run ID:** ${runId}`);
    expect(content).toContain("**Status:** running");
    expect(content).toContain("## Task");
    expect(content).toContain("Build a todo app");
    expect(content).toContain("## Checklist");
    expect(content).toContain("- [ ] Create UI");
    expect(content).toContain("- [ ] Add backend");
    expect(content).toContain("- [ ] Write tests");
  });

  it("includes checklist validation instructions in prompt when checklist is provided", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to return success
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "success",
        result: "Task completed",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        agent_outputs: [],
        errors: [],
        status: "success",
      };
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    await executionService.startRun("test-project", {
      taskDescription: "Test task",
      checklist: ["Item 1", "Item 2"],
    });

    // Wait for SDK call
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify the prompt passed to SDK includes validation instructions
    expect(executeWithSdkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("verify each checklist item"),
      })
    );
    expect(executeWithSdkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("confirm it is done by checking the relevant files"),
      })
    );
  });

  it("does not include checklist validation instructions when checklist is empty", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to return success
    async function* mockGenerator() {
      yield {
        type: "result",
        subtype: "success",
        result: "Task completed",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        agent_outputs: [],
        errors: [],
        status: "success",
      };
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    await executionService.startRun("test-project", {
      taskDescription: "Test task",
      checklist: [],
    });

    // Wait for SDK call
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify the prompt does NOT include validation instructions
    const calls = executeWithSdkMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const promptArg = calls[0]![0]!.prompt;
    expect(promptArg).not.toContain("verify each checklist item");
  });

  it("appends progress updates to progress.md during execution", async () => {
    const { executeWithSdk } = await import("@agent-harness/runtime");
    const executeWithSdkMock = vi.mocked(executeWithSdk);

    // Mock SDK to yield tool_use in assistant message
    async function* mockGenerator() {
      yield {
        type: "assistant",
        message: {
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "Write",
              input: { file_path: "/test/file.ts", content: "code" },
            },
          ],
          model: "claude-3-opus-20240229",
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 20 },
        },
      } as never;
      yield {
        type: "result",
        subtype: "success",
        result: "Task completed",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        agent_outputs: [],
        errors: [],
        status: "success",
      };
    }
    executeWithSdkMock.mockReturnValue(mockGenerator() as never);

    await setupProjectWithTeam();
    const { runId } = await executionService.startRun("test-project", {
      taskDescription: "Test task",
      checklist: [],
    });

    // Wait for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Read progress file
    const { readFile } = await import("node:fs/promises");
    const progressPath = join(
      tempDir,
      "projects",
      "test-project",
      ".runs",
      runId,
      "progress.md"
    );
    const content = await readFile(progressPath, "utf-8");

    // Should contain tool completion update
    expect(content).toContain("Tool completed: Write");
    // Should contain final status update
    expect(content).toContain("Execution completed successfully");
  });
});
