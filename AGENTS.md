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
- Bun/TypeScript (Bun runs TS directly)
- bun:sqlite (built-in SQLite; no native modules)
- mineflayer (Minecraft bot framework)
- Claude Agent SDK (automatic skill loading)
- prismarine-viewer (visual debugging at http://localhost:3000)

**Logging Overview:**
- `minecraft-claude-agent/logs/agent.log` — YAML structured log for Claude. Use helpers in `logger.ts` and keep metadata structured.
- `minecraft-claude-agent/logs/diary.md` — Human-readable diary entries appended via `appendDiaryEntry`.
- `minecraft-server/server/logs/latest.log` — Server truth for all in-world actions.

**Quick Debug Messaging:**
- Run `bun run send "your message"` from `minecraft-claude-agent/` to inject chat messages without joining the game yourself.
- Override username via `DEBUG_SENDER_USERNAME=YourName bun run send "..."` when needed.
- Capture viewer snapshots with `bun run screenshot` (set `VIEWER_URL`, `VIEWER_SCREENSHOT_DIR`, etc. as needed). Screenshots land in `minecraft-claude-agent/logs/screenshots/` by default.
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

1. **Start minecraft-server** → Provides game environment. Check first (`make status-server`) and only run `make start-server` if it's not already up.
2. **Launch the colony runtime** → Spins up every bot defined in `bots.yaml` plus the shared dashboard. Always use `make start-colony` so the process runs detached under `nohup` (dashboard at http://localhost:4242). Check health with `make status-colony` and use `make restart-colony` to cycle the runtime safely.
3. **Use debug tools** → Screenshot bot lives at `minecraft-claude-agent/debug-tools/screenshot-bot/`
4. **Prismarine viewer** (http://localhost:3000) → Real-time 3D view when enabled per bot

## In-Game Testing Loop

Follow this sequence to validate new behavior end-to-end:

1. **Prep the runtime**
   - `make status-server` to see if the Paper server is already running; start it with `make start-server` only when needed.
   - `make start-colony` to launch the bot colony detached. Confirm with `make status-colony`; if you need a fresh run use `make restart-colony`.
2. **Drive the bot via chat**
   - From `minecraft-claude-agent/`, send instructions with `bun run send "cut down the nearest tree"` (prefix with `DEBUG_SENDER_USERNAME=YourName` when you want the message labeled).
3. **Inspect activity**
   - Tail `minecraft-claude-agent/logs/agent.log` for structured turn-by-turn details and tool calls.
   - Read `minecraft-claude-agent/logs/diary.md` for the bot’s natural-language commentary.
   - Cross-check `minecraft-server/server/logs/latest.log` for authoritative in-world events.
4. **Capture ground truth when needed**
   - Run `bun run screenshot` from `minecraft-claude-agent/` to trigger the screenshot bot (configure viewer env vars as needed). Files land in `minecraft-claude-agent/logs/screenshots/`.
5. **Shut down cleanly**
   - When finished, `make stop-colony` (which also tears down agents) and `make stop-server`.

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
make status-server        # check Paper server PID/status
make start-server         # start Paper server in background if not already running
make stop-server          # stop Paper server

# Colony runtime
make start-colony         # start all bots + dashboard (default port 4242)
make stop-colony          # stop bots & dashboard
make restart-colony       # restart bots & dashboard (detached)
make status-colony        # check runtime PID/status

# Direct bot control (inside `minecraft-claude-agent/`)
bun run send "hello"      # send a one-off chat message
bun run screenshot        # capture a viewer screenshot

# Development (inside `minecraft-claude-agent/`)
bun run dev               # watch mode (Bun runs TS directly)
bun run build             # compile TypeScript (optional)
# Unified runtime (alternative to Make):
bun run colony            # start unified runtime + dashboard (foreground)
```

## Important Notes

- **Do** use Claude Agent SDK - provides automatic skill loading and better tooling
- **Do** use git for version control (not _v1, _v2 files)
- **Do** use Bun runtime for all scripts (`bun run ...`)
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

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: Bash("openskills read <skill-name>")
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>playwright-browser</name>
<description>Control browsers for web automation, testing, and scraping using lightweight CLI tools. Use when you need to interact with web pages, take screenshots, execute JavaScript, or automate browser tasks. This is NOT an MCP server - it's a minimal set of composable CLI scripts.</description>
<location>global</location>
</skill>

<skill>
<name>skill-creator</name>
<description>Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.</description>
<location>global</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
