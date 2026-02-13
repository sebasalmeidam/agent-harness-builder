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

## Bash Rules

- Execute commands one by one (no `&&`, `;`, `|`)
- Use the Write tool for file creation (not `cat >` or heredocs)
- No background processes with `&`
