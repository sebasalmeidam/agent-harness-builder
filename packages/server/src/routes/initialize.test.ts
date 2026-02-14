import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
let tempDir: string;
let projectPath: string;

const mockCreate = vi.fn();

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "harness-test-"));
  process.env["HARNESS_DATA_DIR"] = tempDir;
  // Create a valid project directory for testing
  projectPath = join(tempDir, "test-project");
  await mkdir(projectPath, { recursive: true });

  // Reset mocks
  vi.clearAllMocks();
});

afterEach(async () => {
  delete process.env["HARNESS_DATA_DIR"];
  delete process.env["ANTHROPIC_API_KEY"];
  await rm(tempDir, { recursive: true, force: true });
});

describe("POST /api/projects/:id/initialize", () => {
  it("returns 404 when project does not exist", async () => {
    const res = await request(app).post("/api/projects/nonexistent/initialize");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Project not found" });
  });

  it("returns 400 when project already has tasks", async () => {
    // Create project
    await request(app)
      .post("/api/projects")
      .send({
        name: "Has Tasks",
        description: "Project with tasks",
        path: projectPath,
      });

    // Create a task
    await request(app)
      .post("/api/projects/has-tasks/tasks")
      .send({
        title: "Existing task",
        description: "Task description",
      });

    const res = await request(app).post("/api/projects/has-tasks/initialize");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Project already has tasks" });
  });

  it("returns 400 when ANTHROPIC_API_KEY is not set", async () => {
    // Create project
    await request(app)
      .post("/api/projects")
      .send({
        name: "No API Key",
        description: "Test project",
        path: projectPath,
      });

    const res = await request(app).post("/api/projects/no-api-key/initialize");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "ANTHROPIC_API_KEY not configured" });
  });

  it("returns suggestions when initialization succeeds", async () => {
    process.env["ANTHROPIC_API_KEY"] = "test-api-key";

    // Mock successful API response
    const mockSuggestions = [
      {
        title: "Setup project dependencies",
        description: "Install and configure project dependencies",
        checklist: [
          { description: "Install npm packages" },
          { description: "Configure TypeScript" },
        ],
      },
      {
        title: "Create initial components",
        description: "Build core UI components",
        checklist: [
          { description: "Create Button component" },
          { description: "Create Input component" },
        ],
      },
      {
        title: "Setup testing framework",
        description: "Configure testing tools",
        checklist: [
          { description: "Install Vitest" },
          { description: "Write first test" },
        ],
      },
    ];

    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "suggest_tasks",
          input: {
            suggestions: mockSuggestions,
          },
        },
      ],
    });

    // Create project with some files
    await mkdir(join(projectPath, "src"), { recursive: true });
    await writeFile(
      join(projectPath, "src", "index.ts"),
      'console.log("Hello");',
      "utf-8"
    );
    await writeFile(
      join(projectPath, "package.json"),
      JSON.stringify({ name: "test-project" }),
      "utf-8"
    );

    await request(app)
      .post("/api/projects")
      .send({
        name: "Success Test",
        description: "A test project for initialization",
        path: projectPath,
      });

    const res = await request(app).post(
      "/api/projects/success-test/initialize"
    );

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(3);
    expect(res.body.suggestions[0].title).toBe("Setup project dependencies");
    expect(res.body.suggestions[0].checklist).toHaveLength(2);

    // Verify the SDK was called with correct parameters
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("A test project for initialization"),
          }),
        ]),
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("handles timeout correctly", async () => {
    process.env["ANTHROPIC_API_KEY"] = "test-api-key";

    // Mock timeout by simulating an AbortError
    mockCreate.mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), {
        name: "AbortError",
      })
    );

    await request(app)
      .post("/api/projects")
      .send({
        name: "Timeout Test",
        description: "Test timeout",
        path: projectPath,
      });

    const res = await request(app).post(
      "/api/projects/timeout-test/initialize"
    );

    expect(res.status).toBe(504);
    expect(res.body).toEqual({ error: "Request timeout" });
  });

  it("handles parse errors correctly", async () => {
    process.env["ANTHROPIC_API_KEY"] = "test-api-key";

    // Mock invalid response
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "Invalid response",
        },
      ],
    });

    await request(app)
      .post("/api/projects")
      .send({
        name: "Parse Error Test",
        description: "Test parse error",
        path: projectPath,
      });

    const res = await request(app).post(
      "/api/projects/parse-error-test/initialize"
    );

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to parse AI response" });
  });
});

describe("Directory analysis", () => {
  it("reads file tree, README, package.json, and source files", async () => {
    process.env["ANTHROPIC_API_KEY"] = "test-api-key";

    // Create a project structure
    await mkdir(join(projectPath, "src"), { recursive: true });
    await mkdir(join(projectPath, "src", "components"), { recursive: true });
    await writeFile(
      join(projectPath, "README.md"),
      "# Test Project\nThis is a test.",
      "utf-8"
    );
    await writeFile(
      join(projectPath, "package.json"),
      JSON.stringify({ name: "test-project", version: "1.0.0" }),
      "utf-8"
    );
    await writeFile(
      join(projectPath, "src", "index.ts"),
      'export const main = () => console.log("Hello");',
      "utf-8"
    );
    await writeFile(
      join(projectPath, "src", "components", "Button.tsx"),
      'export const Button = () => <button>Click</button>;',
      "utf-8"
    );

    // Mock successful API response
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "suggest_tasks",
          input: {
            suggestions: [
              {
                title: "Test task",
                description: "Test description",
                checklist: [{ description: "Test step" }],
              },
            ],
          },
        },
      ],
    });

    await request(app)
      .post("/api/projects")
      .send({
        name: "Analysis Test",
        description: "Test directory analysis",
        path: projectPath,
      });

    const res = await request(app).post(
      "/api/projects/analysis-test/initialize"
    );

    expect(res.status).toBe(200);

    // Verify the prompt contains expected content
    const call = mockCreate.mock.calls[0];
    const prompt = call[0].messages[0].content;

    expect(prompt).toContain("Test directory analysis");
    expect(prompt).toContain("# File Tree");
    expect(prompt).toContain("# README");
    expect(prompt).toContain("# Test Project");
    expect(prompt).toContain("# package.json");
    expect(prompt).toContain("# Source Files");
    expect(prompt).toContain("src/index.ts");
    expect(prompt).toContain("src/components/Button.tsx");
  });
});
