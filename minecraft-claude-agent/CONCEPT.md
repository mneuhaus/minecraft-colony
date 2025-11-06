# Claude Minecraft Agent – Concept & Architecture

Version: 2025‑11 (CraftScript v0.1, SDK mode)

This document describes the current design after the SDK migration and the cleanup away from legacy MAS components and JSON logs.

## 0) Goals & Principles

Goals
- Fast, responsive bot driven by a single LLM loop with MCP tools.
- Safe execution (hard invariants) with clear, human‑readable plans (CraftScript).
- Live, low‑latency observability for chat/thinking/tools/system via WebSockets.
- Durable history in SQLite for sessions, messages and activities.

Principles
- Minecraft‑native: real registry ids, cardinal faces, Mineflayer pathfinder.
- F/R/U local frame for selectors; keep coordinates relative to heading.
- Non‑bypassable safety in executor; risky ops auto‑scan.
- Fewer moving parts: one agent loop + MCP tools; background jobs when needed.

## 1) Current Architecture (SDK‑based)

```
Player chat → Claude Agent SDK (single loop)
                 │
                 ├─ MCP tools (unified server)
                 │   • world: get_vox, affordances, nearest, block_info, get_topography
                 │   • nav: nav(start/status/cancel)
                 │   • craftscript: start/status/cancel (background jobs)
                 │   • util: send_chat, get_position
                 │
                 ├─ CraftScript engine (parser + executor + safety)
                 │
                 └─ SqlMemoryStore (SQLite)
                     • sessions, messages, activities, accomplishments, preferences, relationships

WS ingest (/ingest) ◄── ActivityWriter (realtime)
WS clients (/ws)   ──► Timeline dashboard (vanilla JS/CSS)
```

Key choices
- Claude Agent SDK runs the loop (streaming) and loads project skills lazily via the SDK Skill tool. We do not preload SKILL.md at startup.
- MCP server is unified and minimal; it maps directly to Mineflayer and our CraftScript/Env.
- Realtime UI uses WebSocket ingest for activity and WS for history; no JSON files.

## 2) Data & Persistence (SQLite)

Per‑bot database: `logs/memories/<Bot>.db`

Tables (high level)
- `sessions(session_id, bot_name, start_time, end_time, is_active)`
- `messages(id, session_id, role, content, timestamp, position_x, position_y, position_z, health, food, inventory)`
- `activities(id, session_id, type, description, timestamp, data, position_x, position_y, position_z)`
- `accomplishments(id, session_id, description, timestamp, position_x, position_y, position_z)`
- `relationships(bot_name, player_name, trust_level, last_interaction, notes)`
- `preferences(bot_name, key, value)`

Usage
- The SDK loop writes messages (`user`/`assistant`) and activities (`thinking`, `tool_use`, `error|warn|info`, `skill`).
- The dashboard reads initial history over WS from SQLite; all live updates arrive over WS ingest.
- Status sidebar derives “connected/connecting/error” by reading the latest message timestamps and optional embedded context.

## 3) Unified MCP Tooling

Provided tools (zod‑validated)
- `get_vox(radius?, include_air?)` → local voxel snapshot + predicates (SAFE_STEP_UP/DOWN, CAN_STAND, HAZARDS)
- `affordances(selector)` → standability, place faces, best tool hint
- `nearest({block_id|entity_id, radius?, reachable?})`
- `block_info({id|selector})` → static properties (gravity, hardness, drops, tool)
- `get_topography(radius=6)` → F/R heightmap + slope + summary
- `nav(action)` → start/status/cancel pathfinder with policy (max_step/drop, allow_dig)
- `craftscript_start/status/cancel` → background job model for CraftScript programs
- `send_chat`, `get_position`

Behavior
- Tools emit JSON text payloads; errors are normalized (UNREACHABLE|BLOCKED|TIMEOUT|UNAVAILABLE).
- Background craftscript jobs stream progress via activities; planner remains responsive while jobs run.

## 4) CraftScript (v0.1) – Summary

Language
- C‑style statements: `macro`, `if/else`, `while`, `repeat`, `assert`, semicolons.
- Selectors in F/R/U/L/B/D with `+` composition and `^`/`_` suffix for step up/down.
- Commands (lowercase): `move`, `turn`, `turn_face`, `dig`, `place`, `equip`, `scan`, `goto`, `drop`, `eat`.
- Predicates: `safe_step_up`, `safe_step_down`, `can_stand`, `is_air`, `has_item`, `is_hazard`.

Executor
- Enforces invariants (no unsafe step up/down, gravity blocks overhead, lava opening, auto‑scan on risky ops).
- Resolves selectors in the bot’s local frame; uses pathfinder for `goto` and small deltas for `move`.

Grammar/Parser
- Implemented with Peggy; supports `f1^`/`f1_` shorthand. Produces a normalized AST.

## 5) Dashboard (Timeline)

Transport
- WebSocket `/ingest` for realtime activities from agents (chat/thinking/tool/system/skill).
- WebSocket `/ws` for clients; supports `{type:"history", bot_id, limit, before_ts}` to load initial history from SQLite.
- No JSON log polling; legacy `/api/activity/:botName` removed (returns 410 Gone).

UI
- Alert‑style system messages with severity (Error/Warning/Info/OK) — icon, colored border, tinted background.
- CraftScript previews render with syntax highlighting.
- get_vox visualizer (F/R grid with U‑layer slider) for quick spatial context.
- “Reset Bot” action (POST `/api/bots/:name/reset`) clears memory DB + diary + activity and restarts the bot.

## 6) Operations

Colony runtime
- `make start-colony` waits for the runtime to write its own PID and prints a single concise status line.
- `make stop-colony` shuts down runtime + agents and frees the dashboard port.
- `make restart-colony` is terse; failures show a short tail optionally with `SHOW_FAIL_LOG=1`.

Proxy
- Supports a local Claude proxy for Max plans: `CLAUDE_PROXY_URL=http://localhost:5789`, `CLAUDE_PROXY_KEY=sk-dummy`.

Logs & files (kept)
- Per‑bot text log: `logs/<Bot>/<Bot>.log`
- Diary: `logs/diary.md`
- Memory DB: `logs/memories/<Bot>.db`
- SDK stderr tail (optional): `logs/<Bot>/claude-code-stderr.log` (may be replaced with SQL activities later)

Removed/Legacy
- MAS job DB, planner/tactician queue, JSON state/activity files, periodic file polling.
- Startup skill enumeration — skills load lazily via the SDK.

## 7) Future Work

- Switch Timeline client entirely to WS history (remove HTTP history endpoints).
- Persist stderr tails into activities and drop stderr files.
- Expand CraftScript macro library and add targeted unit tests for parser/executor.
- Optional subagents: only when a separate transcript/model adds clear value; background jobs are preferred for long ops today.


## 2) (Historical) MCRN — superseded by world x/y/z

### 2.1 Coordinate frame (local) — historical
- Heading `H ∈ {E,S,W,N}`.
- `(0,0,0)` = the block under the agent’s feet (current floor).
- Axes: `F` (forward), `B` (back), `R` (right), `L` (left), `U` (+Y), `D` (−Y).
- Selectors: `F1`, `U2`, `R-1`, sums `F2+U1+R-1`, or tuple `(df,du,dr)`.

### 2.2 Atomic actions — historical
- `TURN L90|R90|180|FACE E|S|W|N`
- `MOVE F1|B1|R1|L1|F1^|F1_` where `^`=step up 1, `_`=step down 1 (safety‑checked)
- `DIG <targets>`
- `PLACE <item> @ <target> [ON TOP|BOTTOM|NORTH|SOUTH|EAST|WEST]`
- `EQUIP <item>`
- `USE <item> [@ <target>]`
- `SCAN [r=<int>]` (refresh local voxel cache)
- Targets: selector(s); `WORLD(x,y,z)`; `WAYPOINT("name")`; `BLOCK(id="oak_log", r=32)` (nearest reachable).

### 2.3 Navigation intents (compile to pathfinder) — updated
- Use nav with WORLD targets: `{ action:'start', target:{ type:'WORLD', x,y,z }, tol, timeout_ms }`
- `APPROACH @ <target> [within=<int>]`
- `FOLLOW name:"Alex"|nearest:"player"|id:"uuid" [within=<int>]`
- `LOOK_AT @ <target>`

### 2.4 Predicates & conditions — historical
- `BLOCK[sel]=ID`, `IS_AIR[sel]`, `IS_SOLID[sel]`, `IS_LIQUID[sel]`, `IS_GRAVITY[sel]`
- `CAN_STAND[sel]` (solid floor and 2 blocks of headroom)
- `SAFE_STEP_UP[F1] := SOLID[F1+U1] ∧ AIR[U2] ∧ AIR[F1+U2]`
- `SAFE_STEP_DOWN[F1] := SOLID[F1+D1] ∧ AIR[F1] ∧ AIR[F1+U1]`
- Combine with `AND | OR`.
- Control flow: `IF/THEN/ELSE`, `REPEAT n {}`, `UNTIL cond {}`, `ASSERT cond`.

### 2.5 Safety invariants (executor MUST enforce) — general
- Never `MOVE F1^` unless `SAFE_STEP_UP[F1]`.
- Never `MOVE F1_` unless `SAFE_STEP_DOWN[F1]`.
- Don’t `DIG` gravity blocks above head without top‑down mitigation.
- Don’t open faces adjacent to lava without a plug/fill plan.
- Auto‑inject `SCAN r=2` before destructive ops if cache is stale.

### 2.6 Core macro library — historical
- `STAIR_UP_STEP` → `ASSERT SAFE_STEP_UP[F1]; DIG { F1+U2, U2 }; MOVE F1^;`
- `STAIR_DOWN_STEP` → `ASSERT SAFE_STEP_DOWN[F1]; DIG { F1, F1+U1 }; MOVE F1_;`
- `TUNNEL_FWD` → `DIG { F1, F1+U1 }; MOVE F1;`
- Policy helpers: `TORCH_CADENCE_7`, `UNSTUCK` (single lateral try + local clear).

## 3) Intents — the Planner’s contract

### 3.1 Intent object (canonical)
- `type`: enum (from catalog below)
- `args`: typed parameters per intent
- `constraints`: safety level, time/step budget, light policy, allowed materials/tools bounds
- `target`: `WAYPOINT|WORLD|BLOCK_QUERY|REL_SELECTOR|ENTITY`
- `stop_conditions`: e.g., `sky_visible | y<=12 | inventory_full | hostile_near`
- `success_criteria`: e.g., `arrived_within=tol` or `completed_steps==N`
- `context_snapshot`: pose/heading, biome, y‑level, nearby hazards summary (provenance)

### 3.2 Intent catalog (baseline)
- `NAVIGATE { target, tolerance=1, timeout_sec?, on_unreachable:"fail|try_clear_once" }`
- `STAIRS_TO_SURFACE { max_steps=40, width=1, torch_cadence=7, stop_condition:"sky_visible" }`
- `STAIRS_DOWN_TO_Y { target_y, width=1, torch_cadence=7 }`
- `TUNNEL_FORWARD { length, torch_cadence=7 }`
- `BRANCH_MINE { main_len, branch_spacing=3, branch_len, torch_cadence=7 }`
- `HARVEST_TREE { species:"any"|…, radius, replant:true, collect_radius }`
- `GATHER_RESOURCE { block_id, quantity, search_radius, min_tool? }`
- (extend later with `BUILD_BRIDGE`, `WATER_ELEVATOR`, etc.)

### 3.3 Planner rules
- Parse chat → choose one intent; fill args/constraints/target.
- Enqueue job `kind=intent` for a specific bot.
- Stay chatty and responsive; use queue controls for status/stop/pause/resume.
- Do not call world‑mutation tools.

## 4) Tactician/Compiler — intent → program
- Consumes jobs with `kind=intent` and `phase=plan`.
- Uses read‑only world context (position, `SCAN`, waypoints, inventory snapshot).
- Produces:
  - `plan_script` — a CraftScript program (world x/y/z)
  - `plan_summary` — `{ materials, risks, est_steps, assumptions }`
- On missing preconditions, fail the plan with a crisp reason (e.g., “needs iron pickaxe, none found”).
- No world mutation; does not perform the job—only compiles it.

Mapping examples (illustrative):

```text
STAIRS_TO_SURFACE { max_steps: N, torch_cadence: 7 } →
EQUIP PICKAXE:IRON; REPEAT N { STAIR_UP_STEP; TORCH_CADENCE_7; }

NAVIGATE { target: BLOCK_QUERY("oak_log", r:48), tolerance:1 } →
GOTO @ BLOCK(id="oak_log", r=48) tol=1; LOOK_AT @ F1;
```

## 5) Executor (code) — program → world
- Pulls `phase=exec` jobs with `plan_script`.
- Expands macros, enforces invariants, manages voxel cache (`SCAN`), calls MCP tools.
- Emits `job_step`, `job_update`, `inventory`, `usage` events.
- Stalls: try `UNSTUCK` once; if still blocked, fail with reason.
- Respects pause/cancel; leaves bot in a standable state.

## 6) Job Queue semantics
- States: `queued → leased → running → {paused|canceled|success|fail}`
- Phases: `plan` and `exec` (planning success enqueues exec; planning failure ends the job with reason)
- Leasing: workers set a short lease with heartbeats (prevents double work).
- Priority: `high|normal|low`; fair scheduling per bot.
- Controls: pause/resume/cancel affect the active phase only.
- Replan: Executor may pause with `reason:'REPLAN_NEEDED'`; Planner/Tactician can update (often by enqueuing a replacement job).

## 7) Safety, policy & permissions
- Planner tools: `enqueue_job`, `get_job_status`, `cancel_job`, `pause_job`, `resume_job`, `send_chat`, `list_waypoints`, `get_position`, `list_inventory`, `Skill` (read‑only). No world mutation tools.
- Tactician tools: read‑only world/context (same as Planner) + macro registry; no mutation.
- Executor tools: world mutation only (`move_to_position`, `dig_block`, `place_block`, `use_item_on_block`, `equip`, `find_block`, `scan_vox`, `look_at`, …). All safety invariants enforced here.
- Policy knobs (per bot): torch cadence default; hazard sensitivity; max step/runtime; auto‑retry count (usually 1 for `UNSTUCK`).

## 8) Data model (SQLite — conceptual)
- `bots`: `id, alias, created_at, last_seen_at, world, pos(x,y,z), heading, health, hunger, saturation, light, biome, status`
- `bot_inventory`: `bot_id, slot, item_id, count, meta` (snapshot rows)
- `jobs`: `id, bot_id, priority, kind(intent|program), phase(plan|exec|done|failed|canceled), state(queued|running|paused|success|fail|canceled), created_at, started_at, updated_at, ended_at, lease_until, error`
- `jobs_payloads`: `job_id, intent_type, intent_args(json), constraints(json), plan_script(text), plan_summary(json)`
- `job_steps`: `id, job_id, i, ts, op, outcome(ok|warn|fail), ms, details(json)`
- `events`: `id, bot_id, ts, type(chat_in|chat_out|system|safety|job_state), payload(json)`
- `usage_ticks`: `id, bot_id, ts, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, usd`
- Indexes on `bot_id`, `job_id`, `ts`, `state` as needed.

## 9) API & WebSocket (contracts)

### REST (read)
```http
GET /api/bots                         # light list
GET /api/bots/:id                     # snapshot (vitals + quick inventory)
GET /api/bots/:id/jobs?phase=&state=&limit=&offset=
GET /api/jobs/:id                     # job core + intent + plan + current phase state
GET /api/jobs/:id/steps?after_i=&limit=
GET /api/bots/:id/events?after_id=&limit=&type=
GET /api/bots/:id/usage?window=24h
```

### REST (write)
```http
POST /api/jobs
{ kind:"intent", bot_id, intent:{ type, args, constraints, target?, stop_conditions? }, priority? }
{ kind:"program", bot_id, script, priority? }

POST /api/jobs/:id/pause
POST /api/jobs/:id/resume
POST /api/jobs/:id/cancel
```

### WebSocket (push)
```json
bot_status { bot:{ id,status,pos,heading,health,hunger,light,biome,updated_at } }
job_phase  { job_id, phase, state }
job_update { job:{ id, bot_id, state, progress, eta_seconds, updated_at } }
job_plan   { job_id, plan_script, plan_summary }
job_step   { job_id, i, ts, op, outcome, ms, details }
event      { bot_id, ts, type, payload }
inventory  { bot_id, items:[...] }
usage      { bot_id, ts, usd, input, output, cache_read, cache_creation }
```

- Error model: JSON `{ error:{ code, message, details? } }` (`bad_request`, `not_found`, `conflict`, `timeout`, `internal`).

## 10) Macro Registry & “Learned” Macros
- Registry buckets: Core (bundled, versioned with spec), Custom (team‑authored), Learned (mined from successful sequences; disabled by default)
- Entry fields: `name, params, body(CraftScript), pre, post, safety_level, macro_version, provenance, pass_rate, enabled`
- Learning pipeline (offline):
  - Mine frequent contiguous sequences from successful `job_steps` (parameterize counts).
  - Draft macro with pre/post predicates; attach provenance.
  - Verify in sandbox across seeds; compute pass_rate.
  - Surface in dashboard under Learned; require human enablement.

## 11) Dashboard (vanilla JS/CSS, BEM) — no minimap

### Layout
- Left rail: Agents list (online first; search; tiny health/job badges)
- Main (per‑agent tabs):
  - Overview: status line, vitals, coordinates/heading, quick inventory, usage snapshot, controls
  - Timeline: live steps (op, outcome, ms) with filters (ok/warn/fail)
  - Chat: merged in/out/system; send box; quick commands (status, stop, come)
  - Jobs: queue/history with Phase and Intent chips; select → detail drawer
  - Inventory: grid 9×4 (or 9×5) with counts
  - Usage: token & cost metrics; tiny inline charts (no lib required)
  - Skills/Macros: enabled lists, pass rates; Learned proposals with enable/disable

### BEM blocks (non‑exhaustive)
```
.app, .app__sidebar, .app__main
.agent-list, .agent-list__item, .agent-list__badge
.agent, .agent__header, .agent-status, .agent-controls
.tabs, .tabs__nav, .tabs__nav-item[aria-selected], .tabs__panel
.overview__vitals, .overview__goal, .overview__inventory, .overview__usage
.timeline__items .timeline-item--ok|--warn|--fail
.chat__stream .chat-msg--in|--out|--system
.jobs__table, .jobs__row, .jobs__phase-chip, .jobs__intent-chip
.inventory-grid, .inventory-grid__slot--filled
.usage__cards, .usage__metric
.macro-list, .macro-list__item, .macro-list__stat
```

### Accessibility & UX
- High‑contrast variant via CSS vars.
- Reduced motion respected.
- Keyboard: `/` focus search, `[ / ]` switch bot, `Space` pause/resume current job.

## 12) Observability & Cost
- Usage tracking per WS tick and per job phase; store in `usage_ticks`.
- Dashboard shows:
  - Now (5 min): input/output tokens, est. $
  - Today: totals per bot
- Attribute planning LLM cost to plan phase; execution is mostly code (near‑zero tokens).

## 13) Testing & Acceptance

### Unit
- Selector parsing and local→world transforms (all headings).
- Predicates from voxel snapshots.
- Macro expansion integrity (`STAIR_UP/DOWN`, `TUNNEL_FWD`).

### Integration
- `NAVIGATE` to `BLOCK_QUERY("oak_log")` → resolves, paths, arrives (tol=1).
- `STAIRS_TO_SURFACE` with intermittent gravel → mitigation once, continue.
- Lava face encountered → plug or fail with `FAIL:hazard`.

### System
- Planner replies to chat within sub‑second while a long exec job runs.
- Cancel mid‑path yields valid standable pose.
- Multiple bots update the dashboard smoothly at ~20 WS msgs/s.

### Foundation acceptance (v1.0)
- Intents → Plan → Exec pipeline operational with leasing.
- MCRN v0.3‑nav supported in executor.
- Dashboard tabs live: Overview, Timeline, Chat, Jobs, Inventory, Usage, Macros.
- SQLite schema & REST/WS endpoints stable.

## 14) Prompts (essentials)

### Planner (user‑facing)
- Role: interpret chat; produce one Intent with typed args; enqueue; keep user informed.
- Tool guardrails: read‑only + queue control; no world mutations.
- Style: concise; always include job id; offer stop/status affordances.

### Tactician (headless)
- Role: compile Intent → MCRN plan (macro‑first), compute materials/risks, fail fast on unmet preconditions.
- Tool guardrails: read‑only only.

### Executor (code)
- Role: run MCRN; enforce safety invariants; auto‑`SCAN`; `UNSTUCK` at most once; emit precise failure reasons; never chat unless via progress hooks.

## 15) Rollout plan
- Data & controls: extend SQLite + REST/WS for kind/phase/intent/plan.
- Workers: implement Tactician (LLM) and Executor (code) with leasing & heartbeats.
- Planner: narrow tools, adopt intent catalog, enqueue.
- Dashboard: add Phase & Intent/Plan UI; existing tabs wired to WS.
- Macro registry: seed core macros; wire policy knobs; surface learned proposals next.

## 16) Rationale (why this design)
- Planner responsiveness: it never blocks on pathfinding/digging.
- Safety: only code mutates the world, with non‑bypassable invariants.
- Explainability: every job has a visible Intent → Plan (MCRN) → Steps chain.
- Extensibility: add intents or macros without touching executor logic.
- Cost control: LLM usage bounded to planning; execution is deterministic.

---

This document is the authoritative spec for the initial release (v1.0). If you want, I can produce a 1‑page “spec card” (for the repo) and a check‑list for devs (DB migrations, tool allowlists, WS event names, dashboard blocks) derived from this spec.
