import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExecutionRun } from "@agent-harness/runtime";
import * as runService from "./run-service.js";

let tempDir: string;

function createTestRun(overrides: Partial<ExecutionRun> = {}): ExecutionRun {
  return {
    id: "run-001",
    projectId: "test-project",
    teamId: "test-team",
    taskId: null,
    status: "running",
    startedAt: "2025-01-15T10:00:00.000Z",
    completedAt: null,
    agentStatuses: { "Lead Agent": "idle", "Dev Agent": "idle" },
    activityLog: [],
    files: [],
    summary: null,
    error: null,
    ...overrides,
  };
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "run-service-test-"));
  process.env["HARNESS_DATA_DIR"] = tempDir;

  // Create the project directory (runs go inside project dirs)
  await mkdir(join(tempDir, "projects", "test-project"), { recursive: true });
});

afterEach(async () => {
  delete process.env["HARNESS_DATA_DIR"];
  await rm(tempDir, { recursive: true, force: true });
});

describe("save and get (round-trip)", () => {
  it("saves a run and reads it back with identical data", async () => {
    const run = createTestRun();
    await runService.save(run);

    const retrieved = await runService.get("test-project", "run-001");
    expect(retrieved).toEqual(run);
  });

  it("overwrites an existing run on save", async () => {
    const run = createTestRun();
    await runService.save(run);

    const updatedRun = createTestRun({
      status: "completed",
      completedAt: "2025-01-15T10:05:00.000Z",
    });
    await runService.save(updatedRun);

    const retrieved = await runService.get("test-project", "run-001");
    expect(retrieved?.status).toBe("completed");
    expect(retrieved?.completedAt).toBe("2025-01-15T10:05:00.000Z");
  });
});

describe("get", () => {
  it("returns null for a nonexistent run", async () => {
    const result = await runService.get("test-project", "nonexistent");
    expect(result).toBeNull();
  });

  it("returns null for a nonexistent project", async () => {
    const result = await runService.get("no-such-project", "run-001");
    expect(result).toBeNull();
  });
});

describe("list", () => {
  it("returns an empty array when no runs exist", async () => {
    const result = await runService.list("test-project");
    expect(result).toEqual([]);
  });

  it("returns an empty array for a nonexistent project", async () => {
    const result = await runService.list("no-such-project");
    expect(result).toEqual([]);
  });

  it("returns summaries sorted by startedAt descending", async () => {
    const run1 = createTestRun({
      id: "run-001",
      startedAt: "2025-01-15T10:00:00.000Z",
    });
    const run2 = createTestRun({
      id: "run-002",
      startedAt: "2025-01-15T12:00:00.000Z",
    });
    const run3 = createTestRun({
      id: "run-003",
      startedAt: "2025-01-15T11:00:00.000Z",
    });

    await runService.save(run1);
    await runService.save(run2);
    await runService.save(run3);

    const result = await runService.list("test-project");
    expect(result).toHaveLength(3);
    // Most recent first
    expect(result[0].id).toBe("run-002");
    expect(result[1].id).toBe("run-003");
    expect(result[2].id).toBe("run-001");
  });

  it("returns only summary fields", async () => {
    const run = createTestRun({
      activityLog: [
        {
          timestamp: "2025-01-15T10:01:00.000Z",
          agentId: "lead",
          agentEmoji: "👨‍💼",
          agentName: "Lead Agent",
          message: "Starting work",
          type: "action",
        },
      ],
      files: ["src/index.ts"],
    });
    await runService.save(run);

    const result = await runService.list("test-project");
    expect(result).toHaveLength(1);

    const summary = result[0];
    expect(summary.id).toBe("run-001");
    expect(summary.status).toBe("running");
    expect(summary.startedAt).toBe("2025-01-15T10:00:00.000Z");
    expect(summary.completedAt).toBeNull();
    expect(summary.error).toBeNull();

    // Ensure full run fields are NOT present in summary
    expect("activityLog" in summary).toBe(false);
    expect("files" in summary).toBe(false);
    expect("agentStatuses" in summary).toBe(false);
  });

  it("skips corrupted JSON files in list", async () => {
    // Save a valid run
    const run = createTestRun({ id: "run-valid" });
    await runService.save(run);

    // Write a corrupted file directly
    const runsDir = runService.getRunsDir("test-project");
    await writeFile(
      join(runsDir, "run-corrupt.json"),
      "this is not valid json{{{",
      "utf-8"
    );

    const result = await runService.list("test-project");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("run-valid");
  });
});

describe("remove", () => {
  it("removes an existing run and returns true", async () => {
    const run = createTestRun();
    await runService.save(run);

    const removed = await runService.remove("test-project", "run-001");
    expect(removed).toBe(true);

    const retrieved = await runService.get("test-project", "run-001");
    expect(retrieved).toBeNull();
  });

  it("returns false when run does not exist", async () => {
    const removed = await runService.remove("test-project", "nonexistent");
    expect(removed).toBe(false);
  });

  it("returns false for a nonexistent project", async () => {
    const removed = await runService.remove("no-such-project", "run-001");
    expect(removed).toBe(false);
  });
});
