# Minecraft Workspace - Mega-Repository

This is a mega-repository containing multiple interconnected projects for running and testing an AI-powered Minecraft bot.

## Repository Structure

```
minecraft/
├── minecraft-server/           # The Minecraft server instance
├── minecraft-claude-agent/     # Claude-powered autonomous bot (PRIMARY PROJECT)
│   └── debug-tools/
│       └── screenshot-bot/     # Verification tool for visual testing
├── .claude/                    # Shared workspace configuration
│   └── settings.local.json
└── .playwright-mcp/            # Screenshots from Playwright MCP
```

## Projects Overview

### 1. minecraft-server/
**Purpose:** The actual Minecraft server that the bot connects to.

**Technology:** Minecraft Java Edition server

**Status:** Running locally for testing

**Notes:**
- Server provides the environment for the bot to operate
- Used for testing bot behaviors in-game
- Server configuration and world data stored here

### 2. minecraft-claude-agent/ (PRIMARY)
**Purpose:** Claude-powered autonomous Minecraft bot using mineflayer and the Claude Agent SDK.

**Technology:**
- Node.js/TypeScript
- mineflayer (Minecraft bot framework)
- Claude Agent SDK (automatic skill loading)
- prismarine-viewer (visual debugging at http://localhost:3000)

**Logging Overview:**
- `minecraft-claude-agent/logs/agent.log` — YAML structured log for Claude. Use helpers in `logger.ts` and keep metadata structured.
- `minecraft-claude-agent/logs/diary.md` — Human-readable diary entries appended via `appendDiaryEntry`.
- `minecraft-server/server/logs/latest.log` — Server truth for all in-world actions.

**Quick Debug Messaging:**
- Run `pnpm send "your message"` from `minecraft-claude-agent/` to inject chat messages without joining the game yourself.
- Override username via `DEBUG_SENDER_USERNAME=YourName pnpm send "..."` when needed.
- Capture viewer snapshots with `pnpm screenshot` (set `VIEWER_URL`, `VIEWER_SCREENSHOT_DIR`, etc. as needed). Screenshots land in `minecraft-claude-agent/logs/screenshots/` by default.
- The helpers spawn disposable processes and exit automatically—check `logs/agent.log` and `logs/diary.md` to confirm the bot handled the interaction.
- Inside the agent, use the `read_diary_entries` MCP tool to let Claude skim recent diary history (defaults to three entries, supports `limit` up to 10).

**Key Features:**
- 22 atomic tools for Minecraft interactions
- Event-driven architecture with 100-turn workflow limit
- Tree-felling skill with automatic sapling replanting
- Autonomous agent with Claude Sonnet 4.5

**Documentation:**
- 📖 **Read [AGENTS.md](minecraft-claude-agent/AGENTS.md) for AI agent programming guide**
- See `minecraft-claude-agent/CLAUDE.md` for legacy development details

**Current Status:**
- ✅ **Migrated to Claude Agent SDK** - Skills auto-load from `.claude/skills/`
- ✅ **All 22 tools converted to MCP format** with Zod schemas
- ✅ **Complete tree-felling workflow validated** - Find → Fell → Collect → Replant
- ✅ **Increased to 100-turn limit** for complex workflows

### 3. minecraft-claude-agent/debug-tools/screenshot-bot/
**Purpose:** Verification tool for visually testing what the claude-agent bot is doing. Lives alongside the primary agent code so improvements to debugging travel with the project.

**Technology:** TBD (likely using Playwright or similar)

**Usage:**
- Takes screenshots of bot behavior
- Helps verify block placements and movements
- Screenshots stored in `.playwright-mcp/`

**Integration:**
- Works alongside prismarine-viewer
- Provides visual confirmation of bot actions
- Critical for debugging "false success" reports

## Workflow

1. **Start minecraft-server** → Provides game environment (`make start-server`)
2. **Launch the colony runtime** → Spins up every bot defined in `bots.yaml` plus the shared dashboard (`make start-colony` or `pnpm colony`, dashboard at http://localhost:4242)
3. **Use debug tools** → Screenshot bot lives at `minecraft-claude-agent/debug-tools/screenshot-bot/`
4. **Prismarine viewer** (http://localhost:3000) → Real-time 3D view when enabled per bot

## Shared Configuration

### .claude/ Directory
The workspace-level `.claude/` directory contains:
- `settings.local.json` - Local settings for Claude Code
- Skills and commands would typically go here, but agent-specific skills are in `minecraft-claude-agent/.claude/skills/`

### Skills Location
Skills must live in `minecraft-claude-agent/.claude/skills/` so they travel with the project (do not add project skills to the workspace-level `.claude/skills/` directory).
- Currently: `tree-felling/SKILL.md`, `trading/SKILL.md`, and trading `TEST-SCENARIOS.md`

## Current Development Focus

**Primary Goal:** Get the minecraft-claude-agent to properly load and use skills from `.claude/skills/tree-felling/SKILL.md`

**Problem:**
- SKILL.md files exist with comprehensive strategies
- Agent uses raw `@anthropic-ai/sdk` directly (not Claude Agent SDK)
- No code currently reads/loads SKILL.md into the system prompt
- 22 tools exist but only 12 are mentioned in system prompt

**Solution (In Progress):**
1. Create skill loader utility to read SKILL.md files
2. Inject loaded skills into ClaudeAgent system prompt
3. Auto-generate tool list from actual tools (sync with reality)
4. Test tree-felling with loaded strategy

## Key Commands

```bash
# Server lifecycle
make start-server         # start Paper server in background
make stop-server          # stop Paper server

# Colony runtime
make start-colony         # start all bots + dashboard (default port 4242)
make stop-colony          # stop bots & dashboard
make status-colony        # check runtime PID/status

# Direct bot control (inside minecraft-claude-agent/)
pnpm colony-ctl status    # show individual bot status
pnpm colony-ctl restart <BotName>

# Development (inside minecraft-claude-agent/)
pnpm run dev              # watch mode with tsx
pnpm run build            # compile TypeScript
pnpm start                # run compiled bot (single instance)
```

## Important Notes

- **Do** use Claude Agent SDK - provides automatic skill loading and better tooling
- **Do** use git for version control (not _v1, _v2 files)
- **Do** use pnpm as package manager
- **Skills** automatically load from `.claude/skills/` directory with Agent SDK

## Architecture Decision: Agent SDK Migration

**Why we migrated TO Claude Agent SDK:**
- ✅ **Automatic skill loading** from `.claude/skills/` directory
- ✅ **Built-in MCP server support** for custom tools
- ✅ **Zod schema validation** for type-safe tool inputs
- ✅ **Less code to maintain** - SDK handles conversation management
- ✅ **Skills auto-inject** into system prompt without manual parsing

**How we integrated it:**
- Created MCP server using `createSdkMcpServer` with all 22 tools
- Converted tool definitions from JSON Schema to Zod schemas
- Used `query()` API with async message generator
- Set `settingSources: ['project']` to enable skill loading
- Skills in `.claude/skills/` directory automatically discovered

**Result:** Cleaner code + automatic skill loading = Win!

---

**Last Updated:** 2025-11-02
**Status:** ✅ Tree-felling skill fully validated and operational
**Primary Focus:** Adding new skills and expanding autonomous capabilities
