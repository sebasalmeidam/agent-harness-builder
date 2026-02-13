import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cloneRepository } from "./git-service.js";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "git-service-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("cloneRepository", () => {
  it("returns error when gitUrl is empty string", async () => {
    const targetDir = join(tempDir, "repo");
    const result = await cloneRepository("", targetDir);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Git URL must be a non-empty string");
  });

  it("returns error when gitUrl is whitespace only", async () => {
    const targetDir = join(tempDir, "repo");
    const result = await cloneRepository("   ", targetDir);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Git URL must be a non-empty string");
  });

  it("returns error for an invalid git URL", async () => {
    const targetDir = join(tempDir, "repo");
    const result = await cloneRepository(
      "https://invalid-host-that-does-not-exist.example.com/repo.git",
      targetDir,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("successfully clones a valid public repository", async () => {
    // Use a small, well-known public repo for testing
    const targetDir = join(tempDir, "repo");
    const result = await cloneRepository(
      "https://github.com/octocat/Hello-World.git",
      targetDir,
    );
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Verify the clone created files
    const files = await readdir(targetDir);
    expect(files.length).toBeGreaterThan(0);
  }, 30_000);

  it("returns error when target directory already has content", async () => {
    const targetDir = join(tempDir, "repo");
    // Clone once
    await cloneRepository(
      "https://github.com/octocat/Hello-World.git",
      targetDir,
    );
    // Clone again to same directory
    const result = await cloneRepository(
      "https://github.com/octocat/Hello-World.git",
      targetDir,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  }, 30_000);
});
