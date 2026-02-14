import { readdir, readFile, writeFile, rename, rm, mkdir, stat } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { slugify } from "./team-service.js";

const DEFAULT_PROJECT_EMOJI = "\uD83D\uDCE6"; // package emoji 📦

// --- Data types ---

export interface Project {
  id: string;
  name: string;
  description: string;
  emoji: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  // Deprecated fields kept for backward compatibility (removed in ADR-021)
  spec?: string;
  teamId?: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  emoji: string;
  path: string;
  taskCount: number;
  pathExists: boolean;
  createdAt: string;
}

// --- Path validation ---

export async function validateProjectPath(
  path: string
): Promise<{ valid: boolean; error?: string }> {
  // Check if path is absolute
  if (!isAbsolute(path)) {
    return {
      valid: false,
      error: "Path must be an absolute path",
    };
  }

  // Check if path exists
  let pathStat;
  try {
    pathStat = await stat(path);
  } catch {
    return {
      valid: false,
      error: "Path does not exist",
    };
  }

  // Check if path is a directory
  if (!pathStat.isDirectory()) {
    return {
      valid: false,
      error: "Path must be a directory",
    };
  }

  return { valid: true };
}

// --- Service ---

function getProjectsDir(): string {
  const baseDir =
    process.env["HARNESS_DATA_DIR"] ?? join(homedir(), ".agent-harness");
  return join(baseDir, "projects");
}

async function ensureProjectsDir(): Promise<string> {
  const projectsDir = getProjectsDir();
  await mkdir(projectsDir, { recursive: true });
  return projectsDir;
}

function projectDirPath(projectsDir: string, id: string): string {
  return join(projectsDir, id);
}

function projectFilePath(projectDir: string): string {
  return join(projectDir, "project.json");
}

export async function list(): Promise<ProjectSummary[]> {
  const projectsDir = await ensureProjectsDir();
  let entries: string[];
  try {
    entries = await readdir(projectsDir);
  } catch {
    return [];
  }

  const summaries: ProjectSummary[] = [];

  for (const entry of entries) {
    try {
      const filePath = projectFilePath(join(projectsDir, entry));
      const content = await readFile(filePath, "utf-8");
      const project = JSON.parse(content) as Record<string, unknown>;

      const projectPath = (project.path as string) || "";

      // Check if path exists (NFR-3: graceful handling)
      let pathExists = false;
      if (projectPath) {
        try {
          await stat(projectPath);
          pathExists = true;
        } catch {
          // Path does not exist or is not accessible
          pathExists = false;
        }
      }

      // Task count defaults to 0 (will be implemented in ADR-019)
      const taskCount = 0;

      summaries.push({
        id: project.id as string,
        name: project.name as string,
        description: project.description as string,
        emoji: (project.emoji as string) || DEFAULT_PROJECT_EMOJI,
        path: projectPath,
        taskCount,
        pathExists,
        createdAt: project.createdAt as string,
      });
    } catch {
      // Skip directories without valid project.json
    }
  }

  return summaries;
}

export async function get(id: string): Promise<Project | null> {
  const projectsDir = await ensureProjectsDir();
  const projDir = projectDirPath(projectsDir, id);
  const filePath = projectFilePath(projDir);
  try {
    const content = await readFile(filePath, "utf-8");
    const project = JSON.parse(content) as Project;
    // Backward compatibility: default emoji when missing from stored JSON
    if (!project.emoji) {
      project.emoji = DEFAULT_PROJECT_EMOJI;
    }
    // Backward compatibility: default path to empty string if missing
    if (!project.path) {
      project.path = "";
    }
    return project;
  } catch {
    return null;
  }
}

export async function create(input: {
  name: string;
  description: string;
  path: string;
  emoji?: string;
}): Promise<Project> {
  const projectsDir = await ensureProjectsDir();
  const id = slugify(input.name);

  if (!id) {
    throw new Error("Invalid project name");
  }

  // Validate path
  const validation = await validateProjectPath(input.path);
  if (!validation.valid) {
    const error = new Error(validation.error);
    (error as Error & { code: string }).code = "INVALID_PATH";
    throw error;
  }

  const projDir = projectDirPath(projectsDir, id);
  const filePath = projectFilePath(projDir);

  // Check for duplicate by trying to read existing project.json
  try {
    await readFile(filePath, "utf-8");
    const error = new Error("Project already exists");
    (error as Error & { code: string }).code = "DUPLICATE";
    throw error;
  } catch (err) {
    if (
      err instanceof Error &&
      (err as Error & { code: string }).code === "DUPLICATE"
    ) {
      throw err;
    }
    // File does not exist, which is expected
  }

  // Create the project directory
  await mkdir(projDir, { recursive: true });

  const emoji = input.emoji?.trim() || DEFAULT_PROJECT_EMOJI;

  const now = new Date().toISOString();
  const project: Project = {
    id,
    name: input.name,
    description: input.description,
    emoji,
    path: input.path,
    createdAt: now,
    updatedAt: now,
  };

  // Atomic write: write to temp file then rename
  const tmpPath = filePath + ".tmp";
  await writeFile(tmpPath, JSON.stringify(project, null, 2), "utf-8");
  await rename(tmpPath, filePath);

  return project;
}

export async function update(
  id: string,
  updates: Partial<Project>,
): Promise<Project | null> {
  const projectsDir = await ensureProjectsDir();
  const projDir = projectDirPath(projectsDir, id);
  const filePath = projectFilePath(projDir);

  let existing: Project;
  try {
    const content = await readFile(filePath, "utf-8");
    existing = JSON.parse(content) as Project;
    // Backward compatibility: default emoji when missing from stored JSON
    if (!existing.emoji) {
      existing.emoji = DEFAULT_PROJECT_EMOJI;
    }
  } catch {
    return null;
  }

  const updatedProject: Project = {
    ...existing,
    ...updates,
    id, // Preserve original ID
    path: existing.path, // Path is immutable after creation
    createdAt: existing.createdAt, // Never change createdAt
    updatedAt: new Date().toISOString(),
  };

  // Atomic write: write to temp file then rename
  const tmpPath = filePath + ".tmp";
  await writeFile(tmpPath, JSON.stringify(updatedProject, null, 2), "utf-8");
  await rename(tmpPath, filePath);

  return updatedProject;
}

export async function remove(id: string): Promise<boolean> {
  const projectsDir = await ensureProjectsDir();
  const projDir = projectDirPath(projectsDir, id);

  try {
    // Verify directory exists by reading project.json
    await readFile(projectFilePath(projDir), "utf-8");
    // Delete the entire project directory recursively
    await rm(projDir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}
