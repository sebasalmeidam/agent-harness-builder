# 🏗️ Agent Harness Builder

**Design AI agent teams visually. Execute them with Claude Code.**

Agent Harness Builder is a local-first tool for creating, orchestrating, and running multi-agent workflows. You define your team (roles, goals, connections), and the system handles coordination, delegation, and execution through Claude Code.

No prompt engineering required. Just describe what each agent does, connect them, and run.

<!-- TODO: Add screenshot -->

## ⚡ Quick Start

```bash
git clone https://github.com/sebasalmeidam/agent-harness-builder.git
cd agent-harness-builder
./setup.sh    # checks deps, installs, builds
pnpm start    # starts UI on :4173 and API on :4099
```

Open [http://localhost:4173](http://localhost:4173) in your browser.

## 📋 Prerequisites

Only **Node.js 22+** is required. The setup script auto-installs everything else:

| Dependency | Auto-installed? | Notes |
|------------|:-:|-------|
| **Node.js 22+** | No | [Install manually](https://nodejs.org) or via `nvm install 22` |
| **pnpm** | ✅ | Package manager |
| **Claude Code CLI** | ✅ | Agent execution engine. Run `claude` once after install to authenticate |

**Optional:** An Anthropic API key (set in Settings) enables AI generation features like "Process Team" workflow generation.

## 🧩 How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐
│  Create Team │ ──▶ │  Add Agents   │ ──▶ │   Connect    │ ──▶ │  Execute   │
│  (name/desc) │     │  (role/goal)  │     │  (workflow)  │     │  (task)    │
└─────────────┘     └──────────────┘     └─────────────┘     └────────────┘
```

1. **Create a Team**: Give it a name and description
2. **Add Agents**: Each agent has a role, goal, emoji, and optional tags
3. **Connect Agents**: Draw edges to define workflow (who passes work to whom)
4. **Process Team** (optional): AI generates a detailed workflow description from your graph
5. **Create a Project**: Assign the team, define tasks with checklists
6. **Execute**: The system auto-generates an Orchestrator that delegates to your agents in order

### The Orchestrator

For teams with 2+ agents, the system automatically creates a coordination layer:

- Derives execution order from your workflow edges (topological sort)
- Delegates work to each agent via Claude Code's Task tool
- Each agent gets full coding capabilities (Read, Write, Edit, Bash)
- The Orchestrator only coordinates (no direct file access)

Single-agent teams execute directly without orchestration overhead.

## 🏛️ Architecture

```
agent-harness-builder/
├── packages/
│   ├── ui/          # React 19 + React Router 7 + Tailwind + XY Flow
│   ├── server/      # Express 5 API + SSE for live execution updates
│   └── runtime/     # Claude Agent SDK integration + harness translation
├── docs/            # ADRs, PRDs, project management
└── setup.sh         # Dependency checker + installer
```

**Data storage:** JSON files in `~/.agent-harness/` (teams, projects, skills, runs, config).

**Two SDKs, two purposes:**

| SDK | Package | Used For | Auth |
|-----|---------|----------|------|
| **Claude Agent SDK** | `@anthropic-ai/claude-agent-sdk` | Agent execution (spawns Claude Code) | Claude Code CLI subscription |
| **Anthropic AI SDK** | `@anthropic-ai/sdk` | AI generation features (Process Team, Initialize) | API key (Settings) |

## ⚙️ Configuration

All config lives in `~/.agent-harness/config.json`:

- **API Key**: For AI generation features (optional, set in Settings page)
- **Default Model**: Which Claude model to use for generation
- **Projects Path**: Base directory for new project workspaces

The config file is created automatically with `chmod 600` (owner-only access).

## 🧪 Development

```bash
# Run (hot reload)
pnpm start

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

**Ports:**
- UI: `http://localhost:4173`
- API: `http://localhost:4099`

## 📁 Project Structure

| Path | Description |
|------|-------------|
| `packages/ui/src/pages/` | Page components (Teams, Projects, Settings, Execution) |
| `packages/ui/src/components/` | Reusable components (canvas, sidebar, modals) |
| `packages/server/src/routes/` | API endpoints |
| `packages/server/src/services/` | Business logic (execution, generation, CRUD) |
| `packages/runtime/src/` | Agent SDK executor, harness translator, schema |
| `docs/adr/` | Architecture Decision Records |
| `docs/prd/` | Product Requirements Documents |

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

Built for the [Claude Agent SDK Hackathon](https://claude.ai) by [@sebasalmeidam](https://github.com/sebasalmeidam).
