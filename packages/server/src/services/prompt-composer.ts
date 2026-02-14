import type { Project } from "./project-service.js";
import type { Task } from "./task-service.js";
import type { Team } from "./team-service.js";

/**
 * Composes a rich execution prompt for task execution.
 * Includes project context, team process workflow, task details, and checklist.
 *
 * @param project - The project containing the task
 * @param task - The task to execute
 * @param team - The team assigned to the task (optional, for processWorkflow)
 * @returns The composed prompt string
 */
export function composeExecutionPrompt(
  project: Project,
  task: Task,
  team?: Team | null
): string {
  const lines: string[] = [];

  // Project Context section
  lines.push("# Project Context");
  if (project.description && project.description.trim().length > 0) {
    lines.push(`${project.description}.`);
  }
  if (project.path && project.path.trim().length > 0) {
    lines.push(`Directory: ${project.path}.`);
  }
  lines.push("");

  // Team Process section (if team has processWorkflow)
  // ADR-024 adds processWorkflow field - check if it exists
  const processWorkflow = (team as Team & { processWorkflow?: string })?.processWorkflow;
  if (processWorkflow && processWorkflow.trim().length > 0) {
    lines.push("# Team Process");
    lines.push(processWorkflow);
    lines.push("");
  }

  // Task section
  lines.push(`# Task: ${task.title}`);
  if (task.description && task.description.trim().length > 0) {
    lines.push(task.description);
  }
  lines.push("");

  // Checklist section
  if (task.checklist && task.checklist.length > 0) {
    lines.push("# Checklist");
    for (let i = 0; i < task.checklist.length; i++) {
      const item = task.checklist[i];
      const checkbox = item!.completed ? "[x]" : "[ ]";
      lines.push(`${i + 1}. ${checkbox} ${item!.description}`);
    }
    lines.push("");
  }

  // Instructions section
  lines.push("# Instructions");
  lines.push("Complete the unchecked items in the checklist above.");
  lines.push("Validate each item when done by checking the relevant files or outputs.");
  lines.push("Write progress to a progress file as you work.");

  return lines.join("\n");
}

/**
 * Generates a preview of the execution prompt for display in the UI.
 * This is the same as composeExecutionPrompt but can be called before execution
 * to show the user what will be sent to the agent.
 */
export function previewExecutionPrompt(
  project: Project,
  task: Task,
  team?: Team | null
): string {
  return composeExecutionPrompt(project, task, team);
}
