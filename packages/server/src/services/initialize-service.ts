import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import * as configService from "./config-service.js";

const MAX_DEPTH = 3;
const MAX_SOURCE_FILES = 20;
const MAX_CONTEXT_SIZE = 100 * 1024; // 100KB
const MAX_LINES_PER_FILE = 200;
const TIMEOUT_MS = 60000; // 60 seconds

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"];

export interface TaskSuggestion {
  title: string;
  description: string;
  checklist: { description: string }[];
}

/**
 * Reads directory tree recursively up to MAX_DEPTH levels.
 * Returns an array of file paths relative to the root.
 */
async function readDirectoryTree(
  rootPath: string,
  currentPath: string = rootPath,
  depth: number = 0
): Promise<string[]> {
  if (depth > MAX_DEPTH) {
    return [];
  }

  const files: string[] = [];
  let entries: string[];

  try {
    entries = await readdir(currentPath);
  } catch {
    return files;
  }

  for (const entry of entries) {
    // Skip hidden files and common directories
    if (
      entry.startsWith(".") ||
      entry === "node_modules" ||
      entry === "dist" ||
      entry === "build" ||
      entry === "__pycache__"
    ) {
      continue;
    }

    const fullPath = join(currentPath, entry);
    let fileStat;

    try {
      fileStat = await stat(fullPath);
    } catch {
      continue;
    }

    const relativePath = relative(rootPath, fullPath);

    if (fileStat.isDirectory()) {
      const subFiles = await readDirectoryTree(rootPath, fullPath, depth + 1);
      files.push(...subFiles);
    } else if (fileStat.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Analyzes a project directory and returns a structured context string.
 * Includes: file tree, README, package.json, and up to 20 source files.
 */
export async function analyzeDirectory(projectPath: string): Promise<string> {
  const sections: string[] = [];

  // 1. Read directory tree
  const fileTree = await readDirectoryTree(projectPath);
  sections.push("# File Tree\n");
  sections.push(fileTree.join("\n"));

  // 2. Read README if present
  const readmeNames = ["README.md", "README"];
  let readmeContent = "";
  for (const name of readmeNames) {
    try {
      const content = await readFile(join(projectPath, name), "utf-8");
      readmeContent = content;
      break;
    } catch {
      // Try next name
    }
  }
  if (readmeContent) {
    sections.push("\n\n# README\n");
    sections.push(readmeContent);
  }

  // 3. Read package.json if present
  try {
    const packageJson = await readFile(
      join(projectPath, "package.json"),
      "utf-8"
    );
    sections.push("\n\n# package.json\n");
    sections.push(packageJson);
  } catch {
    // No package.json
  }

  // 4. Read source files (prioritize by extension and depth)
  const sourceFiles = fileTree
    .filter((path) =>
      SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext))
    )
    .sort((a, b) => {
      // Sort by depth (shallower first), then alphabetically
      const depthA = a.split("/").length;
      const depthB = b.split("/").length;
      if (depthA !== depthB) {
        return depthA - depthB;
      }
      return a.localeCompare(b);
    })
    .slice(0, MAX_SOURCE_FILES);

  if (sourceFiles.length > 0) {
    sections.push("\n\n# Source Files\n");

    for (const filePath of sourceFiles) {
      try {
        const content = await readFile(join(projectPath, filePath), "utf-8");
        sections.push(`\n## ${filePath}\n`);

        // Truncate to first 200 lines if needed
        const lines = content.split("\n");
        if (lines.length > MAX_LINES_PER_FILE) {
          sections.push(lines.slice(0, MAX_LINES_PER_FILE).join("\n"));
          sections.push(
            `\n... (truncated ${lines.length - MAX_LINES_PER_FILE} lines)`
          );
        } else {
          sections.push(content);
        }
      } catch {
        // Skip files that can't be read
      }
    }
  }

  let context = sections.join("");

  // Truncate total context if it exceeds MAX_CONTEXT_SIZE
  if (context.length > MAX_CONTEXT_SIZE) {
    context = context.slice(0, MAX_CONTEXT_SIZE) + "\n... (context truncated)";
  }

  return context;
}

/**
 * Generates task suggestions using the Anthropic SDK.
 * Returns 3-7 TaskSuggestion objects.
 */
export async function generateSuggestions(
  projectDescription: string,
  directoryContext: string
): Promise<TaskSuggestion[]> {
  const apiKey = await configService.getApiKey();

  if (!apiKey) {
    const error = new Error("API key not configured. Set it in Settings.");
    (error as Error & { code: string }).code = "NO_API_KEY";
    throw error;
  }

  const client = new Anthropic({ apiKey });

  // Build prompt
  const prompt = `You are an AI assistant helping to create task suggestions for a software project.

Project Description:
${projectDescription}

Project Directory Context:
${directoryContext}

Based on the project description and directory context, generate 3-7 task suggestions. Each task should have:
- A clear, concise title
- A detailed description explaining what needs to be done
- A checklist of 3-5 actionable steps

Focus on tasks that would be most valuable for this project based on the codebase structure and existing files.

Return the suggestions as a JSON array of objects, each with the structure:
{
  "title": "Task title",
  "description": "Task description",
  "checklist": [
    { "description": "Step 1" },
    { "description": "Step 2" },
    { "description": "Step 3" }
  ]
}`;

  // Create abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        tools: [
          {
            name: "suggest_tasks",
            description: "Suggest tasks for the project",
            input_schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  minItems: 3,
                  maxItems: 7,
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      checklist: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            description: { type: "string" },
                          },
                          required: ["description"],
                        },
                      },
                    },
                    required: ["title", "description", "checklist"],
                  },
                },
              },
              required: ["suggestions"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "suggest_tasks" },
      },
      {
        signal: abortController.signal,
      }
    );

    clearTimeout(timeoutId);

    // Parse the response
    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (
      !toolUseBlock ||
      toolUseBlock.type !== "tool_use" ||
      !toolUseBlock.input
    ) {
      const error = new Error("Invalid response from Claude SDK");
      (error as Error & { code: string }).code = "PARSE_ERROR";
      throw error;
    }

    const input = toolUseBlock.input as { suggestions?: TaskSuggestion[] };

    if (!input.suggestions || !Array.isArray(input.suggestions)) {
      const error = new Error("Invalid response structure from Claude SDK");
      (error as Error & { code: string }).code = "PARSE_ERROR";
      throw error;
    }

    return input.suggestions;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === "AbortError") {
      const error = new Error("Request timeout");
      (error as Error & { code: string }).code = "TIMEOUT";
      throw error;
    }

    throw err;
  }
}
