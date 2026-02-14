# CLAUDE.md — Agent Harness Builder

## Project Overview

Visual tool for designing AI agent teams, extracting reusable harnesses, and executing them.
Repo: https://github.com/sebasalmeidam/agent-harness-builder

## Tech Stack

- **Language:** TypeScript
- **Package Manager:** pnpm workspaces
- **Bundler:** Vite
- **UI:** React + React Flow
- **Styling:** Tailwind CSS
- **Server:** Express
- **Testing:** Vitest
- **Runtime:** Claude Agent SDK (Agent Teams)
- **Storage:** JSON files (no database)
- **Monorepo:** 3 packages (ui, server, runtime)

## Development

- **Dev Container:** Docker is the only requirement — https://containers.dev
- **Trunk-based:** Push directly to main. Keep changes small and atomic.
- **Worktrees:** For parallel development, use git worktrees.

## Commit Guidelines

See `CONTRIBUTING.md` for full format. Quick reference:
- Title: imperative mood, max 70 chars ("Implement the...", "Fix...", "Add...")
- Body: describe what changed with bullet points
- One logical change per commit
- **NEVER commit or push files under `docs/` or `.dev-docs/`.** These are local workflow artifacts (PRDs, ADRs, tracking) and are gitignored. Do not `git add` them.

## Available Tools

See `.claude/AVAILABLE-TOOLS.md` for full reference. Quick summary:
- **agent-browser** (CLI): Browser automation for UI validation. Use `agent-browser snapshot` for accessibility tree, `agent-browser screenshot` for visual capture, `agent-browser errors` for debugging.
- **Exa** (MCP): Web search, code search, company research.
- **Ref** (MCP): API documentation search (60-95% less tokens than raw docs).

When stuck on a UI bug, use `agent-browser errors` and `agent-browser console`. When stuck on an API or library question, use Ref or Exa.

## What to Test

Only test what is **indispensable**. This is a hackathon project — speed matters more than coverage.

**DO test:**
- Core runtime logic (SDK executor, translator) — if this breaks, nothing works
- Critical data transformations that are hard to debug visually

**DO NOT test:**
- CRUD services (create/read/update/delete) — these are trivial JSON file ops
- Express routes — just hit them manually with curl or the UI
- React components — verify visually with the running app
- Utility functions with obvious behavior
- Anything you can verify faster by clicking through the UI

**Rule of thumb:** If a bug would be caught in < 30 seconds by using the app, don't write a test for it.

## Bash Rules

- Execute commands one by one (no `&&`, `;`, `|`)
- Use the Write tool for file creation (not `cat >` or heredocs)
- No background processes with `&`
