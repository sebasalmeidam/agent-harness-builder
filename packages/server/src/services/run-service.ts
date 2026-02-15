import { readdir, readFile, writeFile, rename, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExecutionRun, ExecutionRunSummary } from "@agent-harness/runtime";

// --- Service ---

function getProjectsDir(): string {
  const baseDir =
    process.env["HARNESS_DATA_DIR"] ?? join(homedir(), ".agent-harness");
  return join(baseDir, "projects");
}

/**
 * Returns the .runs/ directory path for a given project.
 * The runs directory lives inside the project directory.
 */
export function getRunsDir(projectId: string): string {
  return join(getProjectsDir(), projectId, ".runs");
}

async function ensureRunsDir(projectId: string): Promise<string> {
  const runsDir = getRunsDir(projectId);
  await mkdir(runsDir, { recursive: true });
  return runsDir;
}

function runFilePath(runsDir: string, runId: string): string {
  return join(runsDir, `${runId}.json`);
}

/**
 * Persists an execution run to disk using atomic write (temp-then-rename).
 * Creates the .runs/ directory if it does not exist.
 */
export async function save(run: ExecutionRun): Promise<void> {
  const runsDir = await ensureRunsDir(run.projectId);
  const filePath = runFilePath(runsDir, run.id);
  const tmpPath = filePath + ".tmp";
  await writeFile(tmpPath, JSON.stringify(run, null, 2), "utf-8");
  await rename(tmpPath, filePath);
}

/**
 * Reads a single execution run by project and run ID.
 * Returns null if the run does not exist or cannot be parsed.
 */
export async function get(
  projectId: string,
  runId: string
): Promise<ExecutionRun | null> {
  const runsDir = getRunsDir(projectId);
  const filePath = runFilePath(runsDir, runId);
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as ExecutionRun;
  } catch {
    return null;
  }
}

/**
 * Lists all execution runs for a project, returning lightweight summaries.
 * Sorted by startedAt descending (most recent first).
 * Corrupted or malformed JSON files are silently skipped.
 */
export async function list(
  projectId: string
): Promise<ExecutionRunSummary[]> {
  const runsDir = getRunsDir(projectId);
  let files: string[];
  try {
    files = await readdir(runsDir);
  } catch {
    return [];
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const summaries: ExecutionRunSummary[] = [];

  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(runsDir, file), "utf-8");
      const run: ExecutionRun = JSON.parse(content);
      summaries.push({
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        error: run.error,
      });
    } catch {
      // Skip corrupted or malformed JSON files
    }
  }

  // Sort by startedAt descending (most recent first)
  summaries.sort((a, b) => {
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  return summaries;
}

/**
 * Cleans up zombie runs: marks any "running" runs as "failed" on startup.
 * This handles cases where the server restarted while runs were in progress.
 */
export async function cleanupZombieRuns(): Promise<number> {
  const projectsDir = getProjectsDir();
  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return 0;
  }

  let cleaned = 0;
  for (const projectId of projectDirs) {
    const runsDir = getRunsDir(projectId);
    let files: string[];
    try {
      files = await readdir(runsDir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const filePath = join(runsDir, file);
        const content = await readFile(filePath, "utf-8");
        const run: ExecutionRun = JSON.parse(content);
        if (run.status === "running") {
          const duration = Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000);
          run.status = "failed";
          run.completedAt = new Date().toISOString();
          run.error = "Execution lost: server restarted while running";
          run.summary = {
            filesChanged: run.files.length,
            totalTime: duration,
            iterations: run.activityLog.length,
            errors: 1,
          };
          const tmpPath = filePath + ".tmp";
          await writeFile(tmpPath, JSON.stringify(run, null, 2), "utf-8");
          await rename(tmpPath, filePath);
          cleaned++;

          // Also update the associated task if any
          if (run.taskId) {
            try {
              const taskService = await import("./task-service.js");
              await taskService.update(run.projectId, run.taskId, { status: "failed" });
            } catch { /* ignore */ }
          }
        }
      } catch { /* skip corrupted files */ }
    }
  }

  return cleaned;
}

/**
 * Removes an execution run file from disk.
 * Returns true if the file was deleted, false if it did not exist.
 */
export async function remove(
  projectId: string,
  runId: string
): Promise<boolean> {
  const runsDir = getRunsDir(projectId);
  const filePath = runFilePath(runsDir, runId);
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
