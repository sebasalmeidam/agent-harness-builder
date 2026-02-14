// --- SDK Executor Tests ---
// Unit tests for SDK executor functions.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK import to avoid requiring the actual SDK package
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(() => {
    // Return a mock async generator
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        return { done: true, value: undefined };
      },
    };
  }),
}));

import { resolveTools, executeWithSdk } from "./sdk-executor.js";
import { query } from "@anthropic-ai/claude-agent-sdk";

const mockedQuery = vi.mocked(query);

describe("resolveTools", () => {
  it("returns read-only tools when agent has read-only skill", () => {
    const tools = resolveTools(["read-only"]);
    expect(tools).toEqual(["Read", "Glob", "Grep"]);
  });

  it("returns read-only tools for case-insensitive read-only match", () => {
    const tools = resolveTools(["Read-Only"]);
    expect(tools).toEqual(["Read", "Glob", "Grep"]);
  });

  it("returns testing tools when agent has testing skill", () => {
    const tools = resolveTools(["testing"]);
    expect(tools).toEqual(["Read", "Write", "Edit", "Bash", "Glob", "Grep"]);
  });

  it("returns testing tools for case-insensitive testing match", () => {
    const tools = resolveTools(["Testing"]);
    expect(tools).toEqual(["Read", "Write", "Edit", "Bash", "Glob", "Grep"]);
  });

  it("returns default tools when agent has no special skills", () => {
    const tools = resolveTools([]);
    expect(tools).toEqual([
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Glob",
      "Grep",
      "WebFetch",
      "WebSearch",
      "NotebookEdit",
    ]);
  });

  it("returns default tools when agent has unrecognized skills", () => {
    const tools = resolveTools(["code-review", "architecture"]);
    expect(tools).toEqual([
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Glob",
      "Grep",
      "WebFetch",
      "WebSearch",
      "NotebookEdit",
    ]);
  });

  it("prioritizes read-only when both read-only and testing are present", () => {
    const tools = resolveTools(["read-only", "testing"]);
    expect(tools).toEqual(["Read", "Glob", "Grep"]);
  });

  it("includes Task tool when isLead is true", () => {
    const tools = resolveTools([], true);
    expect(tools).toContain("Task");
    expect(tools).toEqual([
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Glob",
      "Grep",
      "WebFetch",
      "WebSearch",
      "NotebookEdit",
      "Task",
    ]);
  });

  it("does not include Task tool when isLead is false", () => {
    const tools = resolveTools([], false);
    expect(tools).not.toContain("Task");
  });

  it("does not include Task tool when isLead is not provided", () => {
    const tools = resolveTools([]);
    expect(tools).not.toContain("Task");
  });

  it("includes Task tool for lead with read-only skill", () => {
    const tools = resolveTools(["read-only"], true);
    expect(tools).toContain("Task");
    expect(tools).toEqual(["Read", "Glob", "Grep", "Task"]);
  });

  it("includes Task tool for lead with testing skill", () => {
    const tools = resolveTools(["testing"], true);
    expect(tools).toContain("Task");
    expect(tools).toEqual(["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task"]);
  });
});

describe("executeWithSdk", () => {
  beforeEach(() => {
    mockedQuery.mockClear();
  });

  it("returns an async generator", () => {
    const result = executeWithSdk({
      systemPrompt: "You are a test agent",
      model: "claude-sonnet-4-20250514",
      cwd: "/tmp/test",
      prompt: "Test prompt",
      tools: ["Read", "Write"],
    });

    // Check that result is an async generator
    expect(result).toBeDefined();
    expect(typeof result[Symbol.asyncIterator]).toBe("function");
    expect(typeof result.next).toBe("function");
  });

  it("calls query with correct parameters", () => {
    executeWithSdk({
      systemPrompt: "You are a test agent",
      model: "claude-sonnet-4-20250514",
      cwd: "/tmp/test",
      prompt: "Test prompt",
      tools: ["Read", "Write"],
    });

    expect(mockedQuery).toHaveBeenCalledWith({
      prompt: "Test prompt",
      options: {
        systemPrompt: "You are a test agent",
        model: "claude-sonnet-4-20250514",
        cwd: "/tmp/test",
        permissionMode: "bypassPermissions",
        tools: ["Read", "Write"],
        allowedTools: ["Read", "Write"],
        allowDangerouslySkipPermissions: true,
        maxBudgetUsd: 5.0,
      },
    });
  });

  it("passes custom maxBudgetUsd to query", () => {
    executeWithSdk({
      systemPrompt: "You are a test agent",
      model: "claude-sonnet-4-20250514",
      cwd: "/tmp/test",
      prompt: "Test prompt",
      tools: ["Read"],
      maxBudgetUsd: 10.0,
    });

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          maxBudgetUsd: 10.0,
        }),
      })
    );
  });

  it("uses default maxBudgetUsd of 5.0 when not provided", () => {
    executeWithSdk({
      systemPrompt: "You are a test agent",
      model: "claude-sonnet-4-20250514",
      cwd: "/tmp/test",
      prompt: "Test prompt",
      tools: ["Read"],
    });

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          maxBudgetUsd: 5.0,
        }),
      })
    );
  });

  it("sets tools and allowedTools to the same array", () => {
    const tools = ["Read", "Glob", "Grep"];
    executeWithSdk({
      systemPrompt: "Test",
      model: "claude-sonnet-4-20250514",
      cwd: "/tmp",
      prompt: "Test",
      tools,
    });

    const callArgs = mockedQuery.mock.calls[0][0];
    expect(callArgs.options!.tools).toEqual(tools);
    expect(callArgs.options!.allowedTools).toEqual(tools);
  });

  it("includes agents option when provided", () => {
    const agents = {
      Developer: {
        description: "Backend Dev: Build APIs",
        prompt: "You are a backend developer",
        tools: ["Read", "Write", "Edit"],
      },
    };

    executeWithSdk({
      systemPrompt: "You are a lead agent",
      model: "claude-sonnet-4-20250514",
      cwd: "/tmp/test",
      prompt: "Coordinate team",
      tools: ["Read", "Write", "Task"],
      agents,
    });

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          agents,
        }),
      })
    );
  });

  it("does not include agents option when not provided", () => {
    executeWithSdk({
      systemPrompt: "You are a solo agent",
      model: "claude-sonnet-4-20250514",
      cwd: "/tmp/test",
      prompt: "Work alone",
      tools: ["Read", "Write"],
    });

    const callArgs = mockedQuery.mock.calls[0][0];
    expect(callArgs.options).not.toHaveProperty("agents");
  });
});
