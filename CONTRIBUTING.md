# Contributing to Agent Harness Builder

## Commit Guidelines

Every commit follows this format:

### Title (max 70 characters)
Write the title as if completing the sentence "This commit will..."

**Good titles:**
- `Implement the team creation API endpoint`
- `Fix node connection validation on empty graphs`
- `Add harness export to Claude Agent Teams format`
- `Refactor graph state management for clarity`

**Bad titles:**
- `fix bug` (too vague)
- `WIP` (not descriptive)
- `Updated files` (meaningless)

### Body
The body provides context. Keep it concise. Use this structure:

```
Implement the team creation API endpoint

Description:
- Add POST /api/teams with validation
- Create TeamService for CRUD operations
- Add unit tests for team creation and validation
```

### Rules
- Title and body separated by a blank line
- Title: imperative mood, max 70 characters, no period at the end
- Body: describe what changed and why, use bullet points
- One logical change per commit (we commit per phase, so multiple commits per feature)

## Code Style

### Comments
- Avoid inline comments unless the logic is non-obvious
- Never reference ticket/bug numbers in comments (creates drift over time)
- Self-documenting code with clear method/variable names is preferred
- JSDoc/TSDoc is acceptable for public APIs

## Pull Requests

For trunk-based development (default):
- Push directly to main
- Keep changes small and atomic

For branch-based development (when configured):
- One feature/ADR per branch
- Branch naming: `adr-NNN/short-description`
- Squash merge to main
