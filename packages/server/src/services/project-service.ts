import { readdir, readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { slugify } from "./team-service.js";

// --- Data types ---

export interface Project {
  id: string;
  name: string;
  description: string;
  spec: string;
  teamId: string | null;
  gitUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  teamId: string | null;
  createdAt: string;
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
      const project: Project = JSON.parse(content);
      summaries.push({
        id: project.id,
        name: project.name,
        description: project.description,
        teamId: project.teamId,
        createdAt: project.createdAt,
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
    return JSON.parse(content) as Project;
  } catch {
    return null;
  }
}

export async function create(input: {
  name: string;
  description: string;
}): Promise<Project> {
  const projectsDir = await ensureProjectsDir();
  const id = slugify(input.name);

  if (!id) {
    throw new Error("Invalid project name");
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

  const now = new Date().toISOString();
  const project: Project = {
    id,
    name: input.name,
    description: input.description,
    spec: "",
    teamId: null,
    gitUrl: null,
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
  } catch {
    return null;
  }

  const updatedProject: Project = {
    ...existing,
    ...updates,
    id, // Preserve original ID
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
