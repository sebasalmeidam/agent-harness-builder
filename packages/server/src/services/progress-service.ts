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

export interface ChecklistItemForProgress {
  description: string;
  completed: boolean;
}

export interface InitProgressOptions {
  projectId: string;
  runId: string;
  taskTitle: string;
  taskDescription: string;
  checklist: ChecklistItemForProgress[];
  projectDescription?: string;
  projectPath?: string;
  teamName?: string;
}

/**
 * Initializes a progress file for a run with structured sections.
 * Creates the run directory if it doesn't exist.
 * Uses atomic write pattern (write to .tmp then rename).
 *
 * Format:
 * # Execution Progress
 * ## Metadata
 * - Run ID, Status, Started, Project, Team
 * ## Task
 * Title and description
 * ## Checklist  
 * Items with checkboxes
 * ## Activity Log
 * Timestamped entries
 * ## Summary (added at completion)
 * Final stats
 */
export async function initProgressFile(
  projectId: string,
  runId: string,
  taskDescription: string,
  checklist: string[]
): Promise<void> {
  // Convert simple checklist array to options format
  const options: InitProgressOptions = {
    projectId,
    runId,
    taskTitle: "Task Execution",
    taskDescription,
    checklist: checklist.map((desc) => ({ description: desc, completed: false })),
  };
  
  return initProgressFileStructured(options);
}

/**
 * Initializes a progress file with full structured options.
 */
export async function initProgressFileStructured(
  options: InitProgressOptions
): Promise<void> {
  try {
    const { projectId, runId, taskTitle, taskDescription, checklist, projectDescription, projectPath, teamName } = options;
    
    // Ensure run directory exists
    const runDir = getRunDir(projectId, runId);
    await mkdir(runDir, { recursive: true });

    // Build progress file content with structured sections
    const lines: string[] = [];
    
    // Header
    lines.push("# Execution Progress");
    lines.push("");
    
    // Metadata section
    lines.push("## Metadata");
    lines.push("");
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Run ID | \`${runId}\` |`);
    lines.push(`| Status | 🔄 Running |`);
    lines.push(`| Started | ${new Date().toISOString()} |`);
    if (projectDescription) {
      lines.push(`| Project | ${projectDescription} |`);
    }
    if (projectPath) {
      lines.push(`| Path | \`${projectPath}\` |`);
    }
    if (teamName) {
      lines.push(`| Team | ${teamName} |`);
    }
    lines.push("");
    
    // Task section
    lines.push("## Task");
    lines.push("");
    lines.push(`### ${taskTitle}`);
    lines.push("");
    if (taskDescription) {
      lines.push(taskDescription);
      lines.push("");
    }

    // Checklist section
    if (checklist.length > 0) {
      lines.push("## Checklist");
      lines.push("");
      const completedCount = checklist.filter(item => item.completed).length;
      const percentage = Math.round((completedCount / checklist.length) * 100);
      lines.push(`Progress: ${completedCount}/${checklist.length} (${percentage}%)`);
      lines.push("");
      checklist.forEach((item, index) => {
        const checkbox = item.completed ? "[x]" : "[ ]";
        lines.push(`${index + 1}. ${checkbox} ${item.description}`);
      });
      lines.push("");
    }

    // Activity Log section
    lines.push("## Activity Log");
    lines.push("");
    lines.push("### Execution Started");
    lines.push(`*${new Date().toISOString()}*`);
    lines.push("");
    lines.push("Starting task execution...");
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
      `Failed to initialize progress file for run ${options.runId}:`,
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

export interface ExecutionSummaryForProgress {
  status: "completed" | "failed";
  completedAt: string;
  durationSeconds: number;
  filesChanged: number;
  checklistCompleted: number;
  checklistTotal: number;
  costUsd?: number | null;
  error?: string | null;
}

/**
 * Appends a final summary section to the progress file.
 * Called when execution completes.
 */
export async function appendProgressSummary(
  projectId: string,
  runId: string,
  summary: ExecutionSummaryForProgress
): Promise<void> {
  try {
    const filePath = getProgressFilePath(projectId, runId);
    
    const lines: string[] = [];
    lines.push("---");
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    
    const statusEmoji = summary.status === "completed" ? "✅" : "❌";
    const statusLabel = summary.status === "completed" ? "Completed" : "Failed";
    
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Status | ${statusEmoji} ${statusLabel} |`);
    lines.push(`| Completed | ${summary.completedAt} |`);
    lines.push(`| Duration | ${formatDuration(summary.durationSeconds)} |`);
    lines.push(`| Files Changed | ${summary.filesChanged} |`);
    
    if (summary.checklistTotal > 0) {
      const percentage = Math.round((summary.checklistCompleted / summary.checklistTotal) * 100);
      lines.push(`| Checklist | ${summary.checklistCompleted}/${summary.checklistTotal} (${percentage}%) |`);
    }
    
    if (summary.costUsd != null) {
      lines.push(`| Cost | $${summary.costUsd.toFixed(4)} |`);
    }
    
    if (summary.error) {
      lines.push("");
      lines.push("### Error");
      lines.push("");
      lines.push("```");
      lines.push(summary.error);
      lines.push("```");
    }
    
    lines.push("");
    
    await appendFile(filePath, lines.join("\n"), "utf-8");
  } catch (err: unknown) {
    console.warn(
      `Failed to append progress summary for run ${runId}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Formats duration in seconds to human-readable string.
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes < 60) {
    return `${minutes}m ${secs}s`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m ${secs}s`;
}
