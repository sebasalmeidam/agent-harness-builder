import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// --- Data types ---

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  goal: string;
  skills: string[];
  skillIds: string[];
  practices: string[];
  position: { x: number; y: number };
}

export interface EdgeGate {
  type: "auto" | "manual";
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: "passes-work-to" | "reviews" | "escalates-to";
  label: string;
  failureRouting: "loop-back" | null;
  gate: EdgeGate | null;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  agents: Agent[];
  edges: Edge[];
}

export interface TeamSummary {
  id: string;
  name: string;
  description: string;
  agentCount: number;
  agentEmojis: string[];
}

// --- Slug generation ---

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Service ---

function getTeamsDir(): string {
  const baseDir = process.env["HARNESS_DATA_DIR"] ?? join(homedir(), ".agent-harness");
  return join(baseDir, "teams");
}

async function ensureTeamsDir(): Promise<string> {
  const teamsDir = getTeamsDir();
  await mkdir(teamsDir, { recursive: true });
  return teamsDir;
}

function teamFilePath(teamsDir: string, id: string): string {
  return join(teamsDir, `${id}.json`);
}

export async function list(): Promise<TeamSummary[]> {
  const teamsDir = await ensureTeamsDir();
  let files: string[];
  try {
    files = await readdir(teamsDir);
  } catch {
    return [];
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const summaries: TeamSummary[] = [];

  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(teamsDir, file), "utf-8");
      const team: Team = JSON.parse(content);
      // Ensure backward compatibility: default skillIds to [] if missing
      team.agents = team.agents.map((agent) => ({
        ...agent,
        skillIds: agent.skillIds ?? [],
      }));
      summaries.push({
        id: team.id,
        name: team.name,
        description: team.description,
        agentCount: team.agents.length,
        agentEmojis: team.agents.map((a) => a.emoji),
      });
    } catch {
      // Skip malformed files
    }
  }

  return summaries;
}

export async function get(id: string): Promise<Team | null> {
  const teamsDir = await ensureTeamsDir();
  const filePath = teamFilePath(teamsDir, id);
  try {
    const content = await readFile(filePath, "utf-8");
    const team = JSON.parse(content) as Team;
    // Ensure backward compatibility: default skillIds to [] if missing
    team.agents = team.agents.map((agent) => ({
      ...agent,
      skillIds: agent.skillIds ?? [],
    }));
    return team;
  } catch {
    return null;
  }
}

export async function create(input: { name: string; description: string }): Promise<Team> {
  const teamsDir = await ensureTeamsDir();
  const id = slugify(input.name);

  if (!id) {
    throw new Error("Invalid team name");
  }

  const filePath = teamFilePath(teamsDir, id);

  // Check for duplicate
  try {
    await readFile(filePath, "utf-8");
    const error = new Error("Team already exists");
    (error as Error & { code: string }).code = "DUPLICATE";
    throw error;
  } catch (err) {
    if (err instanceof Error && (err as Error & { code: string }).code === "DUPLICATE") {
      throw err;
    }
    // File does not exist, which is expected
  }

  const team: Team = {
    id,
    name: input.name,
    description: input.description,
    agents: [],
    edges: [],
  };

  await writeFile(filePath, JSON.stringify(team, null, 2), "utf-8");
  return team;
}

export async function update(id: string, team: Team): Promise<Team | null> {
  const teamsDir = await ensureTeamsDir();
  const filePath = teamFilePath(teamsDir, id);

  // Check existence
  try {
    await readFile(filePath, "utf-8");
  } catch {
    return null;
  }

  // Ensure ID consistency
  const updatedTeam: Team = { ...team, id };
  await writeFile(filePath, JSON.stringify(updatedTeam, null, 2), "utf-8");
  return updatedTeam;
}

export async function remove(id: string): Promise<boolean> {
  const teamsDir = await ensureTeamsDir();
  const filePath = teamFilePath(teamsDir, id);

  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
