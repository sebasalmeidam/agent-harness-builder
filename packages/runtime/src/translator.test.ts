import { describe, it, expect } from "vitest";
import { translateHarness, translateHarnessWithOrchestrator, identifyLeadAgent } from "./translator.js";
import type { HarnessData, HarnessAgent, HarnessEdge } from "./harness-schema.js";
// TranslatedTeam type is used implicitly through translateHarness return type

// --- Test Fixtures ---

function makeAgent(overrides: Partial<HarnessAgent> = {}): HarnessAgent {
  return {
    id: "agent-1",
    name: "Developer",
    emoji: "💻",
    role: "Software Developer",
    goal: "Write clean, tested code",
    skills: ["TypeScript", "Testing"],
    skillIds: [],
    practices: ["Write tests first", "Keep functions small"],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeEdge(overrides: Partial<HarnessEdge> = {}): HarnessEdge {
  return {
    id: "edge-1",
    source: "agent-1",
    target: "agent-2",
    type: "passes-work-to",
    label: "passes work to",
    failureRouting: null,
    gate: null,
    ...overrides,
  };
}

function makeHarness(overrides: Partial<HarnessData> = {}): HarnessData {
  return {
    harnessVersion: "1.0.0",
    name: "Test Team",
    description: "A test team harness",
    agents: [],
    edges: [],
    ...overrides,
  };
}

// --- Lead Agent Identification Tests ---

describe("identifyLeadAgent", () => {
  it("returns the first agent when no escalates-to edges exist", () => {
    const agents = [
      makeAgent({ id: "a1", name: "First" }),
      makeAgent({ id: "a2", name: "Second" }),
    ];
    const edges: HarnessEdge[] = [
      makeEdge({ source: "a1", target: "a2", type: "passes-work-to" }),
    ];

    const lead = identifyLeadAgent(agents, edges);
    expect(lead.id).toBe("a1");
    expect(lead.name).toBe("First");
  });

  it("returns the target of the most escalates-to edges", () => {
    const agents = [
      makeAgent({ id: "a1", name: "Agent One" }),
      makeAgent({ id: "a2", name: "Agent Two" }),
      makeAgent({ id: "a3", name: "Lead Agent" }),
    ];
    const edges: HarnessEdge[] = [
      makeEdge({ id: "e1", source: "a1", target: "a3", type: "escalates-to" }),
      makeEdge({ id: "e2", source: "a2", target: "a3", type: "escalates-to" }),
      makeEdge({ id: "e3", source: "a1", target: "a2", type: "passes-work-to" }),
    ];

    const lead = identifyLeadAgent(agents, edges);
    expect(lead.id).toBe("a3");
    expect(lead.name).toBe("Lead Agent");
  });

  it("returns the agent with higher count when multiple agents have escalates-to edges", () => {
    const agents = [
      makeAgent({ id: "a1", name: "Agent One" }),
      makeAgent({ id: "a2", name: "Agent Two" }),
      makeAgent({ id: "a3", name: "Agent Three" }),
    ];
    const edges: HarnessEdge[] = [
      makeEdge({ id: "e1", source: "a1", target: "a2", type: "escalates-to" }),
      makeEdge({ id: "e2", source: "a3", target: "a2", type: "escalates-to" }),
      makeEdge({ id: "e3", source: "a1", target: "a3", type: "escalates-to" }),
    ];

    // a2 has 2 escalates-to edges targeting it, a3 has 1
    const lead = identifyLeadAgent(agents, edges);
    expect(lead.id).toBe("a2");
  });

  it("returns the first agent when escalates-to target is not in agents array", () => {
    const agents = [
      makeAgent({ id: "a1", name: "First" }),
      makeAgent({ id: "a2", name: "Second" }),
    ];
    const edges: HarnessEdge[] = [
      makeEdge({ id: "e1", source: "a1", target: "nonexistent", type: "escalates-to" }),
    ];

    const lead = identifyLeadAgent(agents, edges);
    expect(lead.id).toBe("a1");
  });

  it("throws when agents array is empty", () => {
    expect(() => identifyLeadAgent([], [])).toThrow(
      "Cannot identify lead agent: agents array is empty"
    );
  });
});

// --- translateHarness Tests ---

describe("translateHarness", () => {
  it("throws when harness has no agents", () => {
    const harness = makeHarness({ agents: [] });
    expect(() => translateHarness(harness, "Build a todo app")).toThrow(
      "Cannot translate harness: no agents defined"
    );
  });

  it("translates a single-agent team with the agent as lead and no teammates", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({
          id: "solo",
          name: "Solo Dev",
          role: "Full-Stack Developer",
          goal: "Build the entire application",
          skills: ["React", "Node.js"],
          practices: ["Test everything"],
        }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build a blog");

    expect(result.leadAgent.name).toBe("Solo Dev");
    expect(result.teammates).toHaveLength(0);
    expect(result.leadAgent.systemPrompt).toContain("Full-Stack Developer");
    expect(result.leadAgent.systemPrompt).toContain("Build the entire application");
    expect(result.leadAgent.systemPrompt).toContain("React");
    expect(result.leadAgent.systemPrompt).toContain("Node.js");
    expect(result.leadAgent.systemPrompt).toContain("Test everything");
    expect(result.leadAgent.systemPrompt).toContain("Build a blog");
  });

  it("includes role, goal, tags, and practices in agent system prompts", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({
          id: "a1",
          name: "Lead",
          role: "Tech Lead",
          goal: "Coordinate the team",
          skills: ["Architecture", "Code Review"],
          practices: ["Review all PRs", "Write ADRs"],
        }),
        makeAgent({
          id: "a2",
          name: "Dev",
          role: "Backend Developer",
          goal: "Build API endpoints",
          skills: ["Express", "PostgreSQL"],
          practices: ["Write unit tests", "Document APIs"],
        }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build an API");

    // Check lead prompt (first agent is lead since no escalates-to edges)
    const leadPrompt = result.leadAgent.systemPrompt;
    expect(leadPrompt).toContain("Tech Lead");
    expect(leadPrompt).toContain("Coordinate the team");
    expect(leadPrompt).toContain("Architecture");
    expect(leadPrompt).toContain("Code Review");
    expect(leadPrompt).toContain("Review all PRs");
    expect(leadPrompt).toContain("Write ADRs");

    // Check teammate prompt
    expect(result.teammates).toHaveLength(1);
    const devPrompt = result.teammates[0].systemPrompt;
    expect(devPrompt).toContain("Backend Developer");
    expect(devPrompt).toContain("Build API endpoints");
    expect(devPrompt).toContain("Express");
    expect(devPrompt).toContain("PostgreSQL");
    expect(devPrompt).toContain("Write unit tests");
    expect(devPrompt).toContain("Document APIs");
  });

  it("lead prompt includes workflow description and project specification", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "lead", name: "Lead" }),
        makeAgent({ id: "dev", name: "Developer" }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "lead",
          target: "dev",
          type: "passes-work-to",
        }),
      ],
    });

    const result = translateHarness(harness, "Implement auth system");

    const leadPrompt = result.leadAgent.systemPrompt;
    expect(leadPrompt).toContain("Team Workflow:");
    expect(leadPrompt).toContain("Lead passes work to Developer");
    expect(leadPrompt).toContain("Implement auth system");
    expect(leadPrompt).toContain("Coordination Instructions");
  });

  it("lead prompt does not appear in teammate prompts", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "lead", name: "Lead" }),
        makeAgent({ id: "dev", name: "Developer" }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build an app");

    const devPrompt = result.teammates[0].systemPrompt;
    expect(devPrompt).not.toContain("Coordination Instructions");
    expect(devPrompt).not.toContain("Project Specification");
    expect(devPrompt).not.toContain("Build an app");
  });

  it("teammates list excludes the lead agent", () => {
    const agents = [
      makeAgent({ id: "a1", name: "Agent One" }),
      makeAgent({ id: "a2", name: "Agent Two" }),
      makeAgent({ id: "a3", name: "Lead Agent" }),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "a1", target: "a3", type: "escalates-to" }),
      makeEdge({ id: "e2", source: "a2", target: "a3", type: "escalates-to" }),
    ];
    const harness = makeHarness({ agents, edges });

    const result = translateHarness(harness, "Do the work");

    expect(result.leadAgent.name).toBe("Lead Agent");
    expect(result.teammates).toHaveLength(2);
    expect(result.teammates.map((t) => t.name)).toEqual([
      "Agent One",
      "Agent Two",
    ]);
    // Lead is NOT in teammates
    expect(result.teammates.find((t) => t.name === "Lead Agent")).toBeUndefined();
  });

  it("maps passes-work-to edge type correctly in prompts", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Writer" }),
        makeAgent({ id: "a2", name: "Editor" }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "a1",
          target: "a2",
          type: "passes-work-to",
        }),
      ],
    });

    const result = translateHarness(harness, "Write articles");

    // Lead prompt should describe the edge
    expect(result.leadAgent.systemPrompt).toContain("passes work to");
  });

  it("maps reviews edge type correctly in prompts", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Developer" }),
        makeAgent({ id: "a2", name: "Reviewer" }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "a2",
          target: "a1",
          type: "reviews",
        }),
      ],
    });

    const result = translateHarness(harness, "Build feature");

    expect(result.leadAgent.systemPrompt).toContain("reviews work from");
  });

  it("maps escalates-to edge type correctly in prompts", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "dev", name: "Developer" }),
        makeAgent({ id: "lead", name: "Tech Lead" }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "dev",
          target: "lead",
          type: "escalates-to",
        }),
      ],
    });

    const result = translateHarness(harness, "Handle escalation");

    // Tech Lead is the lead (target of escalates-to)
    expect(result.leadAgent.name).toBe("Tech Lead");
    expect(result.leadAgent.systemPrompt).toContain("escalates to");
  });

  it("includes gate information in workflow description", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Builder" }),
        makeAgent({ id: "a2", name: "Deployer" }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "a1",
          target: "a2",
          type: "passes-work-to",
          gate: { type: "manual" },
        }),
      ],
    });

    const result = translateHarness(harness, "Deploy app");

    expect(result.workflowDescription).toContain("pause for human approval");
    expect(result.leadAgent.systemPrompt).toContain("pause for human approval");
  });

  it("includes auto gate information in workflow description", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Builder" }),
        makeAgent({ id: "a2", name: "Tester" }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "a1",
          target: "a2",
          type: "passes-work-to",
          gate: { type: "auto" },
        }),
      ],
    });

    const result = translateHarness(harness, "Test app");

    expect(result.workflowDescription).toContain("proceed automatically");
  });

  it("includes failure routing loop-back in workflow description", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Developer" }),
        makeAgent({ id: "a2", name: "QA" }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "a1",
          target: "a2",
          type: "passes-work-to",
          failureRouting: "loop-back",
        }),
      ],
    });

    const result = translateHarness(harness, "Quality check");

    expect(result.workflowDescription).toContain(
      "on failure: return work to Developer"
    );
    expect(result.leadAgent.systemPrompt).toContain(
      "on failure: return work to Developer"
    );
  });

  it("handles empty edges gracefully", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Solo Agent" }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Work alone");

    expect(result.leadAgent.name).toBe("Solo Agent");
    expect(result.teammates).toHaveLength(0);
    expect(result.workflowDescription).toContain("no defined workflow edges");
  });

  it("includes workflow context in teammate prompts", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "lead", name: "Lead" }),
        makeAgent({ id: "dev", name: "Developer" }),
        makeAgent({ id: "qa", name: "QA" }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "lead",
          target: "dev",
          type: "passes-work-to",
        }),
        makeEdge({
          id: "e2",
          source: "dev",
          target: "qa",
          type: "passes-work-to",
        }),
      ],
    });

    const result = translateHarness(harness, "Full pipeline");

    // Developer should see incoming from Lead and outgoing to QA
    const devPrompt = result.teammates.find((t) => t.name === "Developer")!.systemPrompt;
    expect(devPrompt).toContain("Lead passes work to you");
    expect(devPrompt).toContain("You passes work to QA");

    // QA should see incoming from Developer
    const qaPrompt = result.teammates.find((t) => t.name === "QA")!.systemPrompt;
    expect(qaPrompt).toContain("Developer passes work to you");
  });

  it("defaults model to claude-sonnet-4-20250514 when not specified", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Lead" }),
        makeAgent({ id: "a2", name: "Dev" }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Check models");

    expect(result.leadAgent.model).toBe("claude-sonnet-4-20250514");
    expect(result.teammates[0].model).toBe("claude-sonnet-4-20250514");
  });

  it("passes through explicit model from agent to TranslatedAgent", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Lead", model: "claude-opus-4-20250514" }),
        makeAgent({ id: "a2", name: "Dev", model: "claude-haiku-3-5-20241022" }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Custom models");

    expect(result.leadAgent.model).toBe("claude-opus-4-20250514");
    expect(result.teammates[0].model).toBe("claude-haiku-3-5-20241022");
  });

  it("allows lead and teammates to have different models", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "lead", name: "Lead", model: "claude-opus-4-20250514" }),
        makeAgent({ id: "dev1", name: "Dev1", model: "claude-sonnet-4-20250514" }),
        makeAgent({ id: "dev2", name: "Dev2", model: "claude-haiku-3-5-20241022" }),
      ],
      edges: [
        makeEdge({ id: "e1", source: "dev1", target: "lead", type: "escalates-to" }),
        makeEdge({ id: "e2", source: "dev2", target: "lead", type: "escalates-to" }),
      ],
    });

    const result = translateHarness(harness, "Mixed models");

    expect(result.leadAgent.name).toBe("Lead");
    expect(result.leadAgent.model).toBe("claude-opus-4-20250514");
    expect(result.teammates).toHaveLength(2);
    expect(result.teammates.find((t) => t.name === "Dev1")?.model).toBe("claude-sonnet-4-20250514");
    expect(result.teammates.find((t) => t.name === "Dev2")?.model).toBe("claude-haiku-3-5-20241022");
  });

  it("uses default model for agents without model field and custom model for agents with it", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "DefaultAgent" }),
        makeAgent({ id: "a2", name: "CustomAgent", model: "custom-model-123" }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Mixed defaults");

    expect(result.leadAgent.name).toBe("DefaultAgent");
    expect(result.leadAgent.model).toBe("claude-sonnet-4-20250514");
    expect(result.teammates[0].name).toBe("CustomAgent");
    expect(result.teammates[0].model).toBe("custom-model-123");
  });

  it("includes team members list in lead agent prompt", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "lead", name: "Lead", role: "Tech Lead", goal: "Coordinate" }),
        makeAgent({ id: "dev", name: "Developer", role: "Backend Dev", goal: "Build APIs" }),
        makeAgent({ id: "qa", name: "QA Engineer", role: "Tester", goal: "Ensure quality" }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build project");

    const leadPrompt = result.leadAgent.systemPrompt;
    expect(leadPrompt).toContain("Teammates Available for Delegation");
    expect(leadPrompt).toContain("### Developer");
    expect(leadPrompt).toContain("**Role:** Backend Dev");
    expect(leadPrompt).toContain("**Goal:** Build APIs");
    expect(leadPrompt).toContain("### QA Engineer");
    expect(leadPrompt).toContain("**Role:** Tester");
    expect(leadPrompt).toContain("**Goal:** Ensure quality");
    // Lead should not list itself as a teammate
    expect(leadPrompt).not.toContain("### Lead");
  });

  it("handles agents with empty tags and practices", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({
          id: "a1",
          name: "Minimal Agent",
          role: "Worker",
          goal: "Do work",
          skills: [],
          practices: [],
        }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Simple task");

    expect(result.leadAgent.name).toBe("Minimal Agent");
    expect(result.leadAgent.systemPrompt).toContain("Worker");
    expect(result.leadAgent.systemPrompt).toContain("Do work");
    // Should not crash or include empty sections
    expect(result.leadAgent.systemPrompt).not.toContain("## Tags\n\n");
    expect(result.leadAgent.systemPrompt).not.toContain("## Practices\n\n");
  });

  it("returns a workflow description string", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "A" }),
        makeAgent({ id: "a2", name: "B" }),
      ],
      edges: [
        makeEdge({ source: "a1", target: "a2", type: "passes-work-to" }),
      ],
    });

    const result = translateHarness(harness, "Test");

    expect(result.workflowDescription).toContain("Team Workflow:");
    expect(result.workflowDescription).toContain("A passes work to B");
  });

  it("handles a complex team with multiple edge types, gates, and failure routing", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "arch", name: "Architect", role: "Solution Architect", goal: "Design systems" }),
        makeAgent({ id: "dev", name: "Developer", role: "Backend Dev", goal: "Implement features" }),
        makeAgent({ id: "qa", name: "QA", role: "Quality Assurance", goal: "Test everything" }),
        makeAgent({ id: "lead", name: "Tech Lead", role: "Technical Lead", goal: "Coordinate team" }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "arch",
          target: "dev",
          type: "passes-work-to",
          gate: { type: "auto" },
        }),
        makeEdge({
          id: "e2",
          source: "dev",
          target: "qa",
          type: "passes-work-to",
          failureRouting: "loop-back",
        }),
        makeEdge({
          id: "e3",
          source: "qa",
          target: "dev",
          type: "reviews",
        }),
        makeEdge({
          id: "e4",
          source: "dev",
          target: "lead",
          type: "escalates-to",
        }),
        makeEdge({
          id: "e5",
          source: "qa",
          target: "lead",
          type: "escalates-to",
        }),
      ],
    });

    const result = translateHarness(harness, "Build complete system");

    // Lead should be "Tech Lead" (target of 2 escalates-to edges)
    expect(result.leadAgent.name).toBe("Tech Lead");
    expect(result.teammates).toHaveLength(3);
    expect(result.teammates.map((t) => t.name)).toEqual(["Architect", "Developer", "QA"]);

    // Workflow description should contain all edge details
    const wf = result.workflowDescription;
    expect(wf).toContain("Architect passes work to Developer");
    expect(wf).toContain("proceed automatically");
    expect(wf).toContain("Developer passes work to QA");
    expect(wf).toContain("on failure: return work to Developer");
    expect(wf).toContain("QA reviews work from Developer");
    expect(wf).toContain("Developer escalates to Tech Lead");
    expect(wf).toContain("QA escalates to Tech Lead");
  });

  // --- Resolved Skills Tests ---

  it("includes resolved skill instructions under Skills heading when resolvedSkills is present", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({
          id: "a1",
          name: "Developer",
          role: "Backend Developer",
          goal: "Build APIs",
          skills: [],
          resolvedSkills: [
            {
              name: "TypeScript Best Practices",
              instructions: "Write type-safe code. Use interfaces for object shapes. Avoid any type.",
            },
            {
              name: "Testing Guidelines",
              instructions: "Write unit tests for all functions. Aim for 80% coverage. Test edge cases.",
            },
          ],
        }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build feature");

    const prompt = result.leadAgent.systemPrompt;
    expect(prompt).toContain("## Skills");
    expect(prompt).toContain("### TypeScript Best Practices");
    expect(prompt).toContain("Write type-safe code. Use interfaces for object shapes. Avoid any type.");
    expect(prompt).toContain("### Testing Guidelines");
    expect(prompt).toContain("Write unit tests for all functions. Aim for 80% coverage. Test edge cases.");
  });

  it("does not include Skills section when resolvedSkills is absent", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({
          id: "a1",
          name: "Developer",
          role: "Backend Developer",
          goal: "Build APIs",
          skills: [],
        }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build feature");

    const prompt = result.leadAgent.systemPrompt;
    expect(prompt).not.toContain("## Skills");
  });

  it("does not include Skills section when resolvedSkills is empty array", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({
          id: "a1",
          name: "Developer",
          role: "Backend Developer",
          goal: "Build APIs",
          skills: [],
          resolvedSkills: [],
        }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build feature");

    const prompt = result.leadAgent.systemPrompt;
    expect(prompt).not.toContain("## Skills");
  });

  it("includes Tags section when free-text tags are present", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({
          id: "a1",
          name: "Developer",
          role: "Backend Developer",
          goal: "Build APIs",
          skills: ["TypeScript", "Node.js", "Express"],
        }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build feature");

    const prompt = result.leadAgent.systemPrompt;
    expect(prompt).toContain("## Tags");
    expect(prompt).toContain("- TypeScript");
    expect(prompt).toContain("- Node.js");
    expect(prompt).toContain("- Express");
  });

  it("includes both Skills and Tags sections when both resolvedSkills and free-text tags are present", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({
          id: "a1",
          name: "Developer",
          role: "Backend Developer",
          goal: "Build APIs",
          skills: ["TypeScript", "Node.js"],
          resolvedSkills: [
            {
              name: "API Design",
              instructions: "Follow REST principles. Use proper HTTP status codes.",
            },
          ],
        }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build feature");

    const prompt = result.leadAgent.systemPrompt;
    expect(prompt).toContain("## Skills");
    expect(prompt).toContain("### API Design");
    expect(prompt).toContain("Follow REST principles. Use proper HTTP status codes.");
    expect(prompt).toContain("## Tags");
    expect(prompt).toContain("- TypeScript");
    expect(prompt).toContain("- Node.js");
  });

  it("includes resolved skills in teammate prompts", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({
          id: "lead",
          name: "Lead",
          role: "Tech Lead",
          goal: "Coordinate",
        }),
        makeAgent({
          id: "dev",
          name: "Developer",
          role: "Backend Dev",
          goal: "Build APIs",
          resolvedSkills: [
            {
              name: "Code Style",
              instructions: "Use 2-space indentation. Max line length 100 chars.",
            },
          ],
        }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build project");

    const devPrompt = result.teammates[0].systemPrompt;
    expect(devPrompt).toContain("## Skills");
    expect(devPrompt).toContain("### Code Style");
    expect(devPrompt).toContain("Use 2-space indentation. Max line length 100 chars.");
  });

  // --- Delegation Tests (ADR-015) ---

  it("includes teammate skills in lead agent prompt", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "lead", name: "Lead", role: "Tech Lead", goal: "Coordinate", skills: ["Leadership"] }),
        makeAgent({ id: "dev", name: "Developer", role: "Backend Dev", goal: "Build APIs", skills: ["TypeScript", "Node.js", "Testing"] }),
        makeAgent({ id: "qa", name: "QA Engineer", role: "Tester", goal: "Ensure quality", skills: ["Manual Testing", "Automation"] }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build project");

    const leadPrompt = result.leadAgent.systemPrompt;
    expect(leadPrompt).toContain("Teammates Available for Delegation");
    expect(leadPrompt).toContain("### Developer");
    expect(leadPrompt).toContain("**Skills:** TypeScript, Node.js, Testing");
    expect(leadPrompt).toContain("### QA Engineer");
    expect(leadPrompt).toContain("**Skills:** Manual Testing, Automation");
  });

  it("includes delegation instructions in lead agent prompt", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "lead", name: "Lead" }),
        makeAgent({ id: "dev", name: "Developer" }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Build feature");

    const leadPrompt = result.leadAgent.systemPrompt;
    expect(leadPrompt).toContain("Delegation Instructions");
    expect(leadPrompt).toContain("You can delegate subtasks to your teammates using the Task tool");
    expect(leadPrompt).toContain("Match the subtask to the teammate whose skills best fit");
    expect(leadPrompt).toContain("Provide clear, specific instructions in the task description");
    expect(leadPrompt).toContain("Each teammate will work independently with their own system prompt");
  });

  it("includes workflow relationships in teammate descriptions", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "lead", name: "Lead" }),
        makeAgent({ id: "dev", name: "Developer" }),
        makeAgent({ id: "qa", name: "QA" }),
      ],
      edges: [
        makeEdge({ id: "e1", source: "lead", target: "dev", type: "passes-work-to" }),
        makeEdge({ id: "e2", source: "dev", target: "lead", type: "escalates-to" }),
      ],
    });

    const result = translateHarness(harness, "Build project");

    const leadPrompt = result.leadAgent.systemPrompt;
    expect(leadPrompt).toContain("### Developer");
    expect(leadPrompt).toContain("**Workflow:** You passes work to Developer");
  });

  it("does not include delegation sections for solo agent", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "solo", name: "Solo Agent" }),
      ],
      edges: [],
    });

    const result = translateHarness(harness, "Work alone");

    const leadPrompt = result.leadAgent.systemPrompt;
    expect(leadPrompt).not.toContain("Teammates Available for Delegation");
    expect(leadPrompt).not.toContain("Delegation Instructions");
  });
});

// --- translateHarnessWithOrchestrator tests ---

describe("translateHarnessWithOrchestrator", () => {
  it("creates a synthetic Orchestrator as lead agent", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Architect", role: "Software Architect" }),
        makeAgent({ id: "a2", name: "Developer", role: "Full-Stack Developer" }),
      ],
      edges: [makeEdge({ source: "a1", target: "a2", type: "passes-work-to" })],
    });

    const result = translateHarnessWithOrchestrator(harness, "Build a website");

    expect(result.leadAgent.name).toBe("Orchestrator");
    expect(result.leadAgent.systemPrompt).toContain("# Role: Orchestrator");
  });

  it("puts ALL agents as teammates (none promoted to lead)", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Architect" }),
        makeAgent({ id: "a2", name: "Developer" }),
        makeAgent({ id: "a3", name: "Tech Lead" }),
      ],
      edges: [
        makeEdge({ id: "e1", source: "a1", target: "a2", type: "passes-work-to" }),
        makeEdge({ id: "e2", source: "a2", target: "a3", type: "passes-work-to" }),
      ],
    });

    const result = translateHarnessWithOrchestrator(harness, "Build an app");

    expect(result.teammates).toHaveLength(3);
    const names = result.teammates.map((t) => t.name);
    expect(names).toContain("Architect");
    expect(names).toContain("Developer");
    expect(names).toContain("Tech Lead");
  });

  it("includes execution order derived from edges", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Architect" }),
        makeAgent({ id: "a2", name: "Developer" }),
        makeAgent({ id: "a3", name: "Tech Lead" }),
      ],
      edges: [
        makeEdge({ id: "e1", source: "a1", target: "a2", type: "passes-work-to" }),
        makeEdge({ id: "e2", source: "a2", target: "a3", type: "passes-work-to" }),
      ],
    });

    const result = translateHarnessWithOrchestrator(harness, "Build an app");

    expect(result.leadAgent.systemPrompt).toContain("Execution Order");
    expect(result.leadAgent.systemPrompt).toContain("Architect → Developer → Tech Lead");
  });

  it("includes delegation instructions", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Architect" }),
        makeAgent({ id: "a2", name: "Developer" }),
      ],
      edges: [makeEdge({ source: "a1", target: "a2" })],
    });

    const result = translateHarnessWithOrchestrator(harness, "Spec");

    expect(result.leadAgent.systemPrompt).toContain("Delegation Instructions");
    expect(result.leadAgent.systemPrompt).toContain("Task tool");
  });

  it("includes team member details in orchestrator prompt", () => {
    const harness = makeHarness({
      agents: [
        makeAgent({ id: "a1", name: "Architect", role: "Software Architect", goal: "Design systems" }),
        makeAgent({ id: "a2", name: "Developer", role: "Full-Stack Dev", goal: "Write code" }),
      ],
      edges: [makeEdge({ source: "a1", target: "a2" })],
    });

    const result = translateHarnessWithOrchestrator(harness, "Spec");
    const prompt = result.leadAgent.systemPrompt;

    expect(prompt).toContain("Team Members");
    expect(prompt).toContain("Software Architect");
    expect(prompt).toContain("Full-Stack Dev");
    expect(prompt).toContain("Design systems");
    expect(prompt).toContain("Write code");
  });

  it("orchestrator prompt states it should NOT write code", () => {
    const harness = makeHarness({
      agents: [makeAgent({ id: "a1", name: "Dev" })],
      edges: [],
    });

    const result = translateHarnessWithOrchestrator(harness, "Spec");

    expect(result.leadAgent.systemPrompt).toContain("do NOT write code");
  });

  it("accepts custom orchestrator model", () => {
    const harness = makeHarness({
      agents: [makeAgent({ id: "a1", name: "Dev" })],
      edges: [],
    });

    const result = translateHarnessWithOrchestrator(harness, "Spec", "claude-opus-4-20250514");

    expect(result.leadAgent.model).toBe("claude-opus-4-20250514");
  });

  it("throws on empty agents", () => {
    const harness = makeHarness({ agents: [], edges: [] });
    expect(() => translateHarnessWithOrchestrator(harness, "Spec")).toThrow("no agents");
  });
});
