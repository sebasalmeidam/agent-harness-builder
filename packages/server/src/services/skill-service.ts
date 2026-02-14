import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

// --- Data types ---

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
}

// --- Service ---

function getSkillsDir(): string {
  const baseDir = process.env["HARNESS_DATA_DIR"] ?? join(homedir(), ".agent-harness");
  return join(baseDir, "skills");
}

async function ensureSkillsDir(): Promise<string> {
  const skillsDir = getSkillsDir();
  await mkdir(skillsDir, { recursive: true });
  return skillsDir;
}

function skillFilePath(skillsDir: string, id: string): string {
  return join(skillsDir, `${id}.json`);
}

export async function list(): Promise<SkillSummary[]> {
  const skillsDir = await ensureSkillsDir();
  let files: string[];
  try {
    files = await readdir(skillsDir);
  } catch {
    return [];
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const summaries: SkillSummary[] = [];

  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(skillsDir, file), "utf-8");
      const skill: Skill = JSON.parse(content);
      summaries.push({
        id: skill.id,
        name: skill.name,
        description: skill.description,
      });
    } catch {
      // Skip malformed files
    }
  }

  return summaries;
}

export async function get(id: string): Promise<Skill | null> {
  const skillsDir = await ensureSkillsDir();
  const filePath = skillFilePath(skillsDir, id);
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Skill;
  } catch {
    return null;
  }
}

async function getAllSkills(): Promise<Skill[]> {
  const skillsDir = await ensureSkillsDir();
  let files: string[];
  try {
    files = await readdir(skillsDir);
  } catch {
    return [];
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const skills: Skill[] = [];

  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(skillsDir, file), "utf-8");
      const skill: Skill = JSON.parse(content);
      skills.push(skill);
    } catch {
      // Skip malformed files
    }
  }

  return skills;
}

export async function create(input: {
  name: string;
  description: string;
  instructions: string;
}): Promise<Skill> {
  const skillsDir = await ensureSkillsDir();

  // Check for duplicate name (case-insensitive)
  const existingSkills = await getAllSkills();
  const normalizedName = input.name.trim().toLowerCase();
  const duplicate = existingSkills.find(
    (s) => s.name.toLowerCase() === normalizedName
  );

  if (duplicate) {
    const error = new Error("A skill with this name already exists");
    (error as Error & { code: string }).code = "DUPLICATE";
    throw error;
  }

  const id = randomUUID();
  const skill: Skill = {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    instructions: input.instructions,
  };

  const filePath = skillFilePath(skillsDir, id);
  await writeFile(filePath, JSON.stringify(skill, null, 2), "utf-8");
  return skill;
}

export async function update(
  id: string,
  input: {
    name?: string;
    description?: string;
    instructions?: string;
  }
): Promise<Skill | null> {
  const skillsDir = await ensureSkillsDir();
  const filePath = skillFilePath(skillsDir, id);

  // Check existence
  const existing = await get(id);
  if (!existing) {
    return null;
  }

  // If name is being changed, check for duplicate
  if (input.name !== undefined && input.name.trim() !== existing.name) {
    const existingSkills = await getAllSkills();
    const normalizedName = input.name.trim().toLowerCase();
    const duplicate = existingSkills.find(
      (s) => s.id !== id && s.name.toLowerCase() === normalizedName
    );

    if (duplicate) {
      const error = new Error("A skill with this name already exists");
      (error as Error & { code: string }).code = "DUPLICATE";
      throw error;
    }
  }

  const updated: Skill = {
    id,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    description: input.description !== undefined ? input.description.trim() : existing.description,
    instructions: input.instructions !== undefined ? input.instructions : existing.instructions,
  };

  await writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function remove(id: string): Promise<boolean> {
  const skillsDir = await ensureSkillsDir();
  const filePath = skillFilePath(skillsDir, id);

  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getMany(ids: string[]): Promise<Skill[]> {
  const skills: Skill[] = [];
  for (const id of ids) {
    const skill = await get(id);
    if (skill) {
      skills.push(skill);
    }
  }
  return skills;
}

export async function removeSkillFromAllTeams(skillId: string): Promise<void> {
  const baseDir = process.env["HARNESS_DATA_DIR"] ?? join(homedir(), ".agent-harness");
  const teamsDir = join(baseDir, "teams");

  let files: string[];
  try {
    files = await readdir(teamsDir);
  } catch {
    // Teams directory doesn't exist or can't be read
    return;
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  for (const file of jsonFiles) {
    try {
      const filePath = join(teamsDir, file);
      const content = await readFile(filePath, "utf-8");
      const team = JSON.parse(content);

      let modified = false;

      // Remove skillId from all agents
      if (Array.isArray(team.agents)) {
        for (const agent of team.agents) {
          if (Array.isArray(agent.skillIds)) {
            const originalLength = agent.skillIds.length;
            agent.skillIds = agent.skillIds.filter((id: string) => id !== skillId);
            if (agent.skillIds.length !== originalLength) {
              modified = true;
            }
          }
        }
      }

      // Only write if we made changes
      if (modified) {
        await writeFile(filePath, JSON.stringify(team, null, 2), "utf-8");
      }
    } catch {
      // Skip malformed or inaccessible team files
    }
  }
}
