# Minecraft Claude Agent Architecture

This document explains how the Claude-powered Minecraft bot is structured after the recent Agent SDK migration and dead-code cleanup. It complements `AGENTS.md` by focusing on runtime components instead of gameplay methodology.

## 1. High-Level Flow

```
Minecraft Server ↔ Mineflayer Bot ↔ Claude Agent SDK ↔ MCP Tool Server ↔ (CraftScript runtime + Colony DB)
                                                           ↘ Vue Dashboard / Activity Stream
```

1. **Minecraft Server** – Paper server used for local testing.
2. **Mineflayer Bot (`MinecraftBot`)** – Maintains the live connection, exposes high-level helpers (movement, inventory, chat).
3. **Claude Agent SDK (`ClaudeAgentSDK`)** – Manages sessions, skill loading from `.claude/skills/`, memory, and MCP tool calls.
4. **MCP Tool Server (`createUnifiedMcpServer`)** – Registers all 32 atomic tools via Zod schemas and logs every invocation.
5. **CraftScript Runtime** – Deterministic scripting layer (parser + executor) used by `craftscript_*` tools for multi-step workflows.
6. **Colony Database (`ColonyDatabase`)** – Bun SQLite database holding bots, activities, craftscript jobs, blueprints, issues, and memories.
7. **Dashboard (`src/runtime/ui`)** – Reads from the shared DB and BotManager events to render the timeline, tool cards, and issue tracker.

## 2. Components in Detail

### 2.1 MinecraftBot
- Source: `src/bot/MinecraftBot.ts`
- Wraps Mineflayer and Prismarine helpers.
- Emits events consumed by `ClaudeAgentSDK` and the dashboard (through `BotManager`).

### 2.2 ClaudeAgentSDK
- Source: `src/agent/ClaudeAgentSDK.ts`
- Responsibilities:
  - Loads project-scoped skills from `.claude/skills/*/SKILL.md` (Agent SDK `settingSources: ['project']`).
  - Maintains per-session SqlMemoryStore context with transcripts + tool logs.
  - Streams tool activity to the dashboard via `ActivityWriter`.
  - Routes craftscript/start/cancel/status calls into `craftscriptJobs.ts`.

### 2.3 MCP Tool Server
- Source: `src/agent/mcpTools.ts`
- Exposes 32 tools grouped as:
  - Chat & telemetry (`send_chat`, `get_position`, `get_inventory`).
  - Spatial analysis (`get_vox`, `look_at_map*`, `affordances`, `nearest`, `block_info`).
  - CraftScript lifecycle (`craftscript_start/status/cancel/logs/trace`).
  - CraftScript function registry (create/edit/delete/list/get).
  - Memory + blueprints + issue tracking helpers.
- Every `loggingTool()` wrapper logs to both ActivityWriter (websocket/dashboard) and SqlMemoryStore (database persistence).

### 2.4 CraftScript Runtime
- Files: `src/craftscript/*` (parser, grammar, executor, env helpers, stdlib).
- Flow:
  1. `craftscript_start` validates the script and enqueues it via `craftscriptJobs.ts`.
  2. Worker executes AST commands (movement, dig, place, flow control) with strict op limits and block-change tracing.
  3. Executor emits `craftscript_step` / `craftscript_trace` records captured in the database for later inspection.

### 2.5 Colony Database
- File: `src/database/ColonyDatabase.ts` + `src/database/schema.ts`.
- Stores:
  - Bot registration/config (`bots` table).
  - Session + memory + activity logs (`messages`, `activities`, `memories`).
  - CraftScript metadata (`craftscript_jobs`, `craftscript_block_changes`, `craftscript_function*`).
  - Blueprint blobs.
  - Issue tracker (`issues`, `issue_comments`).
- Accessed by both the runtime and the dashboard; emission events keep the UI live without polling.

### 2.6 BotManager + Dashboard Server
- Files: `src/runtime/BotManager.ts`, `src/runtime/dashboardServer.ts`.
- BotManager loads `bots.yaml`, starts/stops Mineflayer + ClaudeAgentSDK instances, and proxies craftscript/job APIs.
- Dashboard server exposes REST endpoints (`/api/bots`, `/api/issues`, `/api/craftscript`) and hosts the Vue UI via Vite.

### 2.7 Vue Dashboard (Tool Cards)
- Directory: `src/runtime/ui/src/components/types/Tool`.
- `ToolCard.vue` dispatches timeline entries to dedicated components (craftscript trace/status/logs, vox viewer, memory, etc.).
- After the cleanup only active MCP tools have components; everything else falls back to `ToolGeneric.vue`.

## 3. Tools vs CraftScript vs Skills

| Layer        | Location                               | Purpose                                                                 | Who writes it?           |
|--------------|----------------------------------------|-------------------------------------------------------------------------|--------------------------|
| MCP Tools    | `src/agent/mcpTools.ts`                 | Single-responsibility commands (read-only or DB mutations).            | TypeScript maintainers   |
| CraftScript  | `src/craftscript/*`, `.craftscript/*.cs`| Deterministic, multi-step plans executed server-side.                  | Tool authors / LLM       |
| Skills       | `.claude/skills/*/SKILL.md`             | Documentation/strategy that teaches Claude which tools to call.        | Prompt/skill writers     |

- **MCP tools** are synchronous API calls with strict schema validation.
- **CraftScript** jobs are queued work that can run for many ticks without blocking the LLM.
- **Skills** keep the LLM grounded in how to combine the two layers.

## 4. Logging & Observability

- **ActivityWriter** (`src/utils/activityWriter.ts`) streams tool usage + thinking logs to the dashboard timeline.
- **SqlMemoryStore** (`src/utils/sqlMemoryStore.ts`) persists chat/tool history per session for better prompting.
- **logs/** directory holds YAML agent logs, diary entries, screenshots, and blueprint JSON exports.
- `craftscript_trace` and `craftscript_logs` expose structured auditing data so the dashboard can render block changes and path traces.

## 5. Directory Cheat Sheet

```
src/
├── agent/             # ClaudeAgentSDK, MCP tool server, craftscript job queue
├── bot/               # Mineflayer wrapper + connection logic
├── craftscript/       # Grammar, parser, executor, stdlib helpers
├── database/          # ColonyDatabase + schema SQL
├── runtime/           # BotManager, dashboard server, Vue UI
├── tools/             # Only shared helpers still imported (blueprints, memory, get_inventory)
└── utils/             # Activity/memory stores, migration scripts
```

## 6. Future Work

- Document per-tool inputs/outputs inline (see `mcpTools.ts`).
- Expand the architecture doc with sequence diagrams once multi-bot deployments resume.
- Capture dashboard/websocket flow in a follow-up section after the UI stabilizes.

