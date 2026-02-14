import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as progressService from "./progress-service.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "progress-service-test-"));
  process.env["HARNESS_DATA_DIR"] = tempDir;

  // Create the project directory and runs directory
  await mkdir(join(tempDir, "projects", "test-project", ".runs"), {
    recursive: true,
  });
});

afterEach(async () => {
  delete process.env["HARNESS_DATA_DIR"];
  await rm(tempDir, { recursive: true, force: true });
});

describe("initProgressFile", () => {
  it("creates progress.md with correct initial content", async () => {
    const taskDescription = "Build a todo list application";
    const checklist = ["Create UI", "Add backend API", "Write tests"];

    await progressService.initProgressFile(
      "test-project",
      "run-001",
      taskDescription,
      checklist
    );

    const filePath = progressService.getProgressFilePath(
      "test-project",
      "run-001"
    );
    const content = await readFile(filePath, "utf-8");

    // Verify basic structure
    expect(content).toContain("# Execution Progress");
    expect(content).toContain("**Run ID:** run-001");
    expect(content).toContain("**Status:** running");
    expect(content).toContain("**Started:**");
    expect(content).toContain("## Task");
    expect(content).toContain(taskDescription);
    expect(content).toContain("## Checklist");
    expect(content).toContain("- [ ] Create UI");
    expect(content).toContain("- [ ] Add backend API");
    expect(content).toContain("- [ ] Write tests");
    expect(content).toContain("## Activity Log");
    expect(content).toContain("(execution starting)");
  });

  it("creates progress.md without checklist section when checklist is empty", async () => {
    const taskDescription = "Simple task";
    const checklist: string[] = [];

    await progressService.initProgressFile(
      "test-project",
      "run-002",
      taskDescription,
      checklist
    );

    const filePath = progressService.getProgressFilePath(
      "test-project",
      "run-002"
    );
    const content = await readFile(filePath, "utf-8");

    expect(content).toContain("# Execution Progress");
    expect(content).toContain("## Task");
    expect(content).toContain(taskDescription);
    expect(content).not.toContain("## Checklist");
    expect(content).toContain("## Activity Log");
  });

  it("creates the run directory if it does not exist", async () => {
    // Don't pre-create the run directory
    const taskDescription = "Test task";

    await progressService.initProgressFile(
      "test-project",
      "run-003",
      taskDescription,
      []
    );

    const filePath = progressService.getProgressFilePath(
      "test-project",
      "run-003"
    );
    const content = await readFile(filePath, "utf-8");

    expect(content).toContain("# Execution Progress");
  });

  it("does not throw if write fails", async () => {
    // Use an invalid project ID to cause a write failure
    // The function should log a warning but not throw
    await expect(
      progressService.initProgressFile(
        "/invalid/path/project",
        "run-004",
        "Task",
        []
      )
    ).resolves.toBeUndefined();
  });
});

describe("appendProgressUpdate", () => {
  it("appends timestamped entries to existing progress file", async () => {
    // Initialize the file first
    await progressService.initProgressFile(
      "test-project",
      "run-005",
      "Test task",
      []
    );

    // Append first update
    await progressService.appendProgressUpdate(
      "test-project",
      "run-005",
      "Tool completed: Write file"
    );

    // Append second update
    await progressService.appendProgressUpdate(
      "test-project",
      "run-005",
      "Checklist item completed"
    );

    const filePath = progressService.getProgressFilePath(
      "test-project",
      "run-005"
    );
    const content = await readFile(filePath, "utf-8");

    // Verify both updates are present
    expect(content).toContain("### 20"); // Timestamp starts with year
    expect(content).toContain("Tool completed: Write file");
    expect(content).toContain("Checklist item completed");

    // Count the number of timestamp headers (should be 2)
    const timestampCount = (content.match(/^### \d{4}-/gm) || []).length;
    expect(timestampCount).toBe(2);
  });

  it("does not throw if append fails", async () => {
    // Try to append to a non-existent file
    // The function should log a warning but not throw
    await expect(
      progressService.appendProgressUpdate(
        "test-project",
        "nonexistent-run",
        "Some message"
      )
    ).resolves.toBeUndefined();
  });
});

describe("getProgressFilePath", () => {
  it("returns the correct path format", () => {
    const path = progressService.getProgressFilePath(
      "test-project",
      "run-123"
    );
    expect(path).toContain("projects");
    expect(path).toContain("test-project");
    expect(path).toContain(".runs");
    expect(path).toContain("run-123");
    expect(path).toContain("progress.md");
  });
});
