# Harness Schema Documentation

**Current Version:** 1.0

The harness is a portable, versioned, engine-agnostic JSON format that captures a complete team design. It is distinct from the mutable team JSON used for canvas persistence. A harness is an immutable snapshot intended for sharing, version control, or consumption by execution engines.

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `harnessVersion` | `string` | Yes | Schema version identifier. Current version is `"1.0"`. |
| `name` | `string` | Yes | The team name. |
| `description` | `string` | Yes | A description of the team's purpose. |
| `agents` | `HarnessAgent[]` | Yes | Array of all agents in the team. Must contain at least one agent. |
| `edges` | `HarnessEdge[]` | Yes | Array of all workflow edges connecting agents. May be empty. |

## HarnessAgent Fields

Each agent represents a participant in the team with defined responsibilities and canvas position.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the agent within the harness. |
| `name` | `string` | Yes | Display name of the agent. |
| `emoji` | `string` | Yes | Emoji icon representing the agent on the canvas. |
| `role` | `string` | Yes | The agent's role (e.g., "software-developer", "code-reviewer"). |
| `goal` | `string` | Yes | A description of what the agent aims to accomplish. |
| `skills` | `string[]` | Yes | List of skills the agent possesses. May be empty. |
| `practices` | `string[]` | Yes | List of practices the agent follows. May be empty. |
| `position` | `{ x: number, y: number }` | Yes | The agent's position on the canvas layout. |

## HarnessEdge Fields

Each edge represents a workflow relationship between two agents.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the edge within the harness. |
| `source` | `string` | Yes | The `id` of the source agent. |
| `target` | `string` | Yes | The `id` of the target agent. |
| `type` | `string` | Yes | The relationship type. One of: `"passes-work-to"`, `"reviews"`, `"escalates-to"`. |
| `label` | `string` | Yes | A human-readable label describing the relationship. |
| `failureRouting` | `"loop-back"` or `null` | Yes | How failures are routed. `"loop-back"` sends work back to the source agent. `null` means no failure routing. |
| `gate` | `{ type: "auto" \| "manual" }` or `null` | Yes | Gate configuration for the edge. `"auto"` gates pass automatically; `"manual"` gates require human approval. `null` means no gate. |

## Example

```json
{
  "harnessVersion": "1.0",
  "name": "Code Review Team",
  "description": "A team for writing and reviewing code",
  "agents": [
    {
      "id": "dev-1",
      "name": "Developer",
      "emoji": "👨‍💻",
      "role": "software-developer",
      "goal": "Write clean, tested code",
      "skills": ["TypeScript", "React"],
      "practices": ["TDD", "SOLID"],
      "position": { "x": 100, "y": 200 }
    },
    {
      "id": "reviewer-1",
      "name": "Reviewer",
      "emoji": "🔍",
      "role": "code-reviewer",
      "goal": "Ensure code quality and maintainability",
      "skills": ["Architecture", "Security"],
      "practices": ["Code review best practices"],
      "position": { "x": 400, "y": 200 }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "dev-1",
      "target": "reviewer-1",
      "type": "passes-work-to",
      "label": "Submit for review",
      "failureRouting": "loop-back",
      "gate": { "type": "manual" }
    }
  ]
}
```

## Versioning

The `harnessVersion` field identifies which schema version was used to produce the harness. Consumers should check this field to ensure compatibility. The current and only version is `"1.0"`.

Future versions will maintain backward compatibility where possible and document breaking changes.
