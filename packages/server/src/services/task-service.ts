import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

// --- Data types ---

export interface ChecklistItem {
  id: string;
  description: string;
  completed: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  teamId: string | null;
  status: "pending" | "running" | "done" | "failed";
}

// --- Service ---

function getProjectsDir(): string {
  const baseDir =
    process.env["HARNESS_DATA_DIR"] ?? join(homedir(), ".agent-harness");
  return join(baseDir, "projects");
}

function tasksFilePath(projectId: string): string {
  return join(getProjectsDir(), projectId, "tasks.json");
}

async function ensureProjectDir(projectId: string): Promise<string> {
  const projectDir = join(getProjectsDir(), projectId);
  await mkdir(projectDir, { recursive: true });
  return projectDir;
}

async function readTasks(projectId: string): Promise<Task[]> {
  try {
    const content = await readFile(tasksFilePath(projectId), "utf-8");
    return JSON.parse(content) as Task[];
  } catch {
    // File does not exist or is malformed, return empty array
    return [];
  }
}

async function writeTasks(projectId: string, tasks: Task[]): Promise<void> {
  await ensureProjectDir(projectId);
  const filePath = tasksFilePath(projectId);
  // Atomic write: write to temp file then rename
  const tmpPath = filePath + ".tmp";
  await writeFile(tmpPath, JSON.stringify(tasks, null, 2), "utf-8");
  await rename(tmpPath, filePath);
}

export async function list(projectId: string): Promise<Task[]> {
  return await readTasks(projectId);
}

export async function get(
  projectId: string,
  taskId: string
): Promise<Task | null> {
  const tasks = await readTasks(projectId);
  return tasks.find((t) => t.id === taskId) ?? null;
}

export async function create(
  projectId: string,
  input: {
    title: string;
    description?: string;
    checklist?: ChecklistItem[];
  }
): Promise<Task> {
  const tasks = await readTasks(projectId);

  const task: Task = {
    id: randomUUID(),
    projectId,
    title: input.title,
    description: input.description ?? "",
    checklist: input.checklist ?? [],
    teamId: null,
    status: "pending",
  };

  tasks.push(task);
  await writeTasks(projectId, tasks);

  return task;
}

export async function update(
  projectId: string,
  taskId: string,
  updates: Partial<Task>
): Promise<Task | null> {
  const tasks = await readTasks(projectId);
  const index = tasks.findIndex((t) => t.id === taskId);

  if (index === -1) {
    return null;
  }

  const updatedTask: Task = {
    ...tasks[index],
    ...updates,
    id: taskId, // Preserve original ID
    projectId, // Preserve original projectId
  };

  tasks[index] = updatedTask;
  await writeTasks(projectId, tasks);

  return updatedTask;
}

export async function remove(
  projectId: string,
  taskId: string
): Promise<boolean> {
  const tasks = await readTasks(projectId);
  const filteredTasks = tasks.filter((t) => t.id !== taskId);

  if (filteredTasks.length === tasks.length) {
    // Task not found
    return false;
  }

  await writeTasks(projectId, filteredTasks);
  return true;
}

export async function reorder(
  projectId: string,
  taskIds: string[]
): Promise<Task[]> {
  const tasks = await readTasks(projectId);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Build reordered list: specified IDs first, then any remaining
  const reordered: Task[] = [];
  for (const id of taskIds) {
    const task = taskMap.get(id);
    if (task) {
      reordered.push(task);
      taskMap.delete(id);
    }
  }
  // Append any tasks not in the provided list (safety)
  for (const task of taskMap.values()) {
    reordered.push(task);
  }

  await writeTasks(projectId, reordered);
  return reordered;
}

export async function count(projectId: string): Promise<number> {
  const tasks = await readTasks(projectId);
  return tasks.length;
}
