import { writeFile, appendFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getRunsDir } from "./run-service.js";

/**
 * Returns the path to the run directory for a given project and run ID.
 * This is where progress.md will be stored.
 */
export function getRunDir(projectId: string, runId: string): string {
  const runsDir = getRunsDir(projectId);
  return join(runsDir, runId);
}

/**
 * Returns the path to the progress.md file for a given run.
 */
export function getProgressFilePath(projectId: string, runId: string): string {
  return join(getRunDir(projectId, runId), "progress.md");
}

/**
 * Initializes a progress file for a run with task description, checklist, and initial status.
 * Creates the run directory if it doesn't exist.
 * Uses atomic write pattern (write to .tmp then rename).
 *
 * @param projectId - The project ID
 * @param runId - The run ID
 * @param taskDescription - The task description to include in the progress file
 * @param checklist - Array of checklist items
 */
export async function initProgressFile(
  projectId: string,
  runId: string,
  taskDescription: string,
  checklist: string[]
): Promise<void> {
  try {
    // Ensure run directory exists
    const runDir = getRunDir(projectId, runId);
    await mkdir(runDir, { recursive: true });

    // Build progress file content
    const lines: string[] = [];
    lines.push("# Execution Progress");
    lines.push("");
    lines.push(`**Run ID:** ${runId}`);
    lines.push(`**Status:** running`);
    lines.push(`**Started:** ${new Date().toISOString()}`);
    lines.push("");
    lines.push("## Task");
    lines.push(taskDescription);
    lines.push("");

    if (checklist.length > 0) {
      lines.push("## Checklist");
      checklist.forEach((item) => {
        lines.push(`- [ ] ${item}`);
      });
      lines.push("");
    }

    lines.push("## Activity Log");
    lines.push("(execution starting)");
    lines.push("");

    const content = lines.join("\n");

    // Atomic write: write to .tmp then rename
    const filePath = getProgressFilePath(projectId, runId);
    const tmpPath = filePath + ".tmp";
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, filePath);
  } catch (err: unknown) {
    // Log warning but don't fail execution
    console.warn(
      `Failed to initialize progress file for run ${runId}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Appends a timestamped update to the progress file.
 * Does not use atomic write pattern since this is append-only.
 *
 * @param projectId - The project ID
 * @param runId - The run ID
 * @param message - The message to append
 */
export async function appendProgressUpdate(
  projectId: string,
  runId: string,
  message: string
): Promise<void> {
  try {
    const filePath = getProgressFilePath(projectId, runId);
    const timestamp = new Date().toISOString();
    const entry = `### ${timestamp}\n${message}\n\n`;
    await appendFile(filePath, entry, "utf-8");
  } catch (err: unknown) {
    // Log warning but don't fail execution
    console.warn(
      `Failed to append progress update for run ${runId}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}
