# Minecraft Colony - Development Guide

## 📖 Read AGENTS.md

**For the main AI agent programming guide, read [AGENTS.md](./AGENTS.md).**

This file contains legacy development details and debugging methodology.

## Project Documentation

- **AGENTS.md** - **AI agent programming guide (READ THIS FIRST)**
- **CLAUDE.md** (this file) - Legacy development guide and debugging methodology  
- **TODO.md** - Roadmap of planned features and tasks
- **CHANGELOG.md** - Version history following [Keep a Changelog](https://keepachangelog.com/) format
- **README.md** - User-facing documentation (coming soon)

## Logging & Observability Best Practices

| Log | Purpose | Location | Format / Notes |
| --- | --- | --- | --- |
| `logs/agent.log` | Machine-friendly event stream for the Claude agent | `minecraft-claude-agent/logs/agent.log` | YAML entries (`---` separator). Include structured metadata (`tools_used`, `session_id`, etc.) rather than ad-hoc strings. |
| `logs/diary.md` | Human-readable diary of notable actions | `minecraft-claude-agent/logs/diary.md` | Markdown with timestamped summaries. Use `appendDiaryEntry(summary, details)` so entries stay concise and can embed YAML snippets. |
| Server log | Ground-truth of what happened on the Minecraft server | `minecraft-server/server/logs/latest.log` | Always cross-check major actions (placed blocks, kicks, deaths) here when validating bot behaviour. |

**When adding new logs:**

1. Use the **YAML logger** (`logger.info/debug/error`) for structured data. It keeps tokens small and allows downstream parsing.
2. Record human context with **`appendDiaryEntry`**. Summaries should be a sentence; details can be bullet lists or fenced YAML (`details` object).
3. Reference `latest.log` in reviews/diary when you need proof of in-game changes.
4. Control the viewer with `DISABLE_VIEWER=true` (skip prismarine viewer) and `VIEWER_PORT` when sharing the dev server.
5. To avoid duplicate-login kicks while debugging, run `MC_USERNAME=YourName DISABLE_VIEWER=true pnpm start`.
6. Use `pnpm send "message"` to simulate player chat without opening Minecraft (set `DEBUG_SENDER_USERNAME=Name` if you need a specific sender).
7. Capture viewer screenshots with `pnpm screenshot` (tweak `VIEWER_URL`, `VIEWER_SCREENSHOT_DIR`, etc. as needed). Outputs land in `logs/screenshots/` by default.
8. After either helper, review `logs/agent.log` and `logs/diary.md` to confirm the agent’s response.
9. From inside the agent, call the `read_diary_entries` MCP tool to skim the last few diary entries (defaults to 3, accepts `limit` up to 10).

### Changelog Workflow

When making changes, update CHANGELOG.md following these categories:
- **Added** - New features/tools
- **Changed** - Changes to existing functionality
- **Deprecated** - Features to be removed soon
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security fixes

Use semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes
- MINOR: New features (backwards compatible)
- PATCH: Bug fixes

## Autonomous Improvement Harness

### Core Mission
- Grow a coordinated crew of Claude-managed Minecraft bots that feel like thoughtful human players, all orchestrated by the Claude bot manager.
- Teach those bots through reusable, general-purpose tools plus layered skills so they learn the game rather than rely on ultra-specific automation.
- Build toward a self-sustaining bot settlement, starting with small-scale (≤5 bots) experiments and scaling only after each phase is validated.

### Definition of “Improved”
- Skills and tools stay consistent—new behaviours are gated by documented strategies in `.claude/skills/` that unlock the next phase of play.
- Bot coordination improves (shared goals, communication, safe interactions) without ballooning bespoke tool count.
- Operational docs (this file, CHANGELOG.md, TODO.md) remain aligned with the code and describe how multiple bots should act.

### Skill Progression Phases
1. **Settler Foundations** – Gather core resources (wood, stone, coal), keep the wheat farm producing, fell nearby trees, and complete a starter shelter with bed, crafting table, furnace, and chest.
2. **Essential Gathering** – Tree felling, stone acquisition, primitive shelter completion.
3. **Tool & Equipment Crafting** – Crafting tables, furnaces, stone/iron tools, basic armor.
4. **Navigation & Exploration** – Waypoints, coordinated scouting, safe return paths.
5. **Food & Farming** – Crop planting, animal husbandry, communal food stores.
6. **Mining & Resource Scaling** – Layered mining plans, ore processing, shared storage discipline.
7. **Construction & Infrastructure** – Collaborative builds, path networks, lighting plans.
8. **Automation Basics** – Simple redstone, mob-safe farms, resource throughput monitoring.
9. **Economy & Trading** – Villager trading loops, inter-bot barter protocols, resource budgeting.
10. **Settlement Governance** – Task assignment, maintenance routines, defenses, cultural builds.

### Operating Rules
- **Do**
  - Ground every change in evidence: reference logs, diffs, failing tests, or reproducible gaps.
  - Prefer iterative upgrades that can be validated in-game or through automated smoke tests.
  - Keep tools atomic and well-described—update Zod schemas and documentation together.
  - Record noteworthy outcomes in `logs/agent.log` and `logs/diary.md`.
  - Commit work in focused git commits with clear messages so the history remains reviewable.
  - Build reusable debug tooling when needed, and add usage instructions plus rationale to this guide.
- **Don’t**
  - Introduce breaking tool signature changes without migration notes and consumer updates.
  - Add hidden behaviours that bypass skills or hard-code world specifics.
  - Leave TODOs without owner/context—convert them into actionable items in TODO.md.
  - Defer bug fixes that put the bot at risk of getting stuck or griefing the world.
  - Scatter throwaway test scripts or ad-hoc markdown summaries—keep experiments organized or clean them up.

### Review Ritual
- Before stopping, run `./self-improve.sh` (configured as the stop hook) to audit work since the last validated commit recorded in `.claude/last_git_sha`.
- Treat the script’s critique as your next task list—address flagged gaps, reinforce the core mission, and continue iterating.
- Stay inside the current phase (Phase 1) unless you can justify—with evidence—why a Phase 2 action is required now; Phase 1 success = steady resource flow, wheat farm running, and a furnished starter house (bed, crafting table, furnace, chest).
- Only advance the recorded `last_git_sha` when a human validates behaviour in-game or via automated acceptance checks.

## Colony Runtime Orchestration

- `pnpm colony` launches every bot defined in `bots.yaml` and the shared dashboard (default http://localhost:4242).
- Use `pnpm colony-ctl <mode>` for granular control (`start`, `stop`, `restart`, `status`) without touching the dashboard.
- Workspace-level make targets mirror the same flow: `make start-colony`, `make stop-colony`, `make status-colony`.
- Bot state files (`logs/<BotName>.state.json`) feed the dashboard; keep them up to date when adding new telemetry.

## Critical Development Principles

### 0. DESIGNING FOR A BLIND BOT

**The bot cannot see Minecraft's rendered graphics.** All tools must be designed as if the bot is blind, relying only on textual descriptions, coordinates, and numerical data.

#### Key Principles for Tool Design

1. **Always Return Coordinates**
   - Don't say "tree nearby" - say "oak_log at (110, 72, 122)"
   - Include distance in blocks for spatial awareness
   - Provide multiple options sorted by distance (nearest first)

2. **Make Actions Atomic and Clear**
   - Bad: `gather_wood` (combines finding + moving + chopping)
   - Good: `find_tree` (just locate) + `fell_tree` (just chop at given position)
   - Each tool should do ONE thing that's easy to understand

3. **Provide Actionable Data**
   - Return structured info the LLM can act on:
     - Coordinates: `(x, y, z)`
     - Distances: `49 blocks away`
     - Block types: `jungle_log` not just "wood"
     - Multiple options: List of trees sorted by proximity

4. **Think "Blind Navigation"**
   - The bot navigates via coordinates, not by "seeing" trees
   - Pathfinding may fail (water, cliffs) - provide alternatives
   - Sort results to help bot make informed choices

5. **Avoid Ambiguity**
   - Bad: "Found a tree" (where? what kind? how far?)
   - Good: "Found 5 trees. Nearest: jungle_log at (110, 72, 122) - 49 blocks"

#### Example: Tree Gathering Evolution

**V1 (Bad):** Single monolithic tool
```typescript
gather_wood(targetAmount: 10)
// Returns: "Gathered 0 logs"
// Problem: Bot can't see WHY it failed or what to do next
```

**V2 (Better):** Separate find/fell, but limited data
```typescript
find_tree() // Returns: "Found jungle_log 49 blocks away"
// Problem: No coordinates, bot can't act on "49 blocks away"
```

**V3 (Best):** Modular + actionable data
```typescript
find_tree()
// Returns: "Found 5 trees. Nearest: jungle_log at (110, 72, 122) - 49 blocks"
// Bot can: 1) See coordinates to navigate, 2) Pick alternative if path fails

fell_tree(x, y, z, woodType)
// Clear input: exact position to chop
// Bot knows exactly what to do
```

### 0.5. AGENT SKILLS ARCHITECTURE

**Agent Skills** are SKILL.md instruction files that teach Claude HOW to accomplish complex tasks using existing atomic tools. They are NOT hardcoded TypeScript functions.

#### Core Concepts

1. **Skills Are Instructions, Not Code**
   - Skills are markdown files in `.claude/skills/skill-name/SKILL.md`
   - They contain YAML frontmatter + comprehensive strategy documentation
   - Claude reads them to understand HOW to combine atomic tools
   - The actual work is done by calling existing tools (find_tree, dig_block, etc.)

2. **YAML Frontmatter Structure**
   ```yaml
   ---
   name: tree-felling
   description: Efficiently fell trees in Minecraft, handling different tree types (oak, spruce mega trees, acacia), managing height, preventing floating logs, and replanting. Use when gathering wood or managing forests.
   allowed-tools: find_tree, fell_tree, find_block, dig_block, place_block, move_to_position, get_position, list_inventory
   ---
   ```

3. **Key Frontmatter Fields**
   - **name**: Kebab-case identifier for the skill
   - **description**: Critical! Claude uses this to decide when to invoke the skill. Be specific about capabilities and use cases.
   - **allowed-tools**: Restricts which tools Claude can use when this skill is active (optional but recommended)

4. **Model-Invoked Behavior**
   - Skills activate automatically when Claude detects the task matches the description
   - User says "gather wood" → Claude reads tree-felling SKILL.md → follows the strategy
   - Skills are NOT user commands - they're AI-triggered based on description matching

5. **Progressive Disclosure**
   - Main SKILL.md contains overview and general strategy
   - Supporting files in subdirectories provide detailed specifics
   - Claude reads supporting files only when needed
   - Example: `tree_types/oak.md`, `tree_types/spruce.md` for tree-specific details

#### Directory Structure

```
.claude/skills/
├── tree-felling/
│   ├── SKILL.md                    # Main strategy guide
│   └── tree_types/
│       ├── oak.md                  # Oak-specific details
│       ├── spruce.md               # Spruce + mega spruce
│       ├── acacia.md               # Branching tree details
│       └── birch.md                # Birch-specific details
├── shelter-building/
│   ├── SKILL.md                    # Building strategy
│   └── shelter_types/
│       ├── basic_hut.md
│       └── underground_bunker.md
```

#### What Goes in a SKILL.md

**Good SKILL.md Content:**
- Tree type identification (1x1 vs 2x2 patterns)
- Height assessment strategies (when to pillar)
- Step-by-step procedures (bottom-up vs top-down felling)
- Best practices (sapling replanting, stump prevention)
- Common mistakes to avoid
- Example coordinates and workflows

**Bad SKILL.md Content:**
- ❌ Actual TypeScript function implementations
- ❌ Hardcoded coordinates
- ❌ Tool definitions (tools go in tools.ts)
- ❌ API calls or bot commands

#### Helper Functions Philosophy

**Helper functions should be:**
- **Atomic**: Do one thing clearly
- **Simple**: No complex logic or state management
- **Data-providing**: Return coordinates, measurements, block types
- **LLM-friendly**: Help Claude make decisions, don't make decisions for it

**Example Helper Functions:**
```typescript
// ✅ GOOD: Returns data for LLM to decide
find_tree() // Returns: coordinates + distance + block type

// ✅ GOOD: Simple, clear action
dig_block(x, y, z) // Breaks one specific block

// ❌ BAD: Too complex, makes decisions
gather_wood_intelligently() // Finds, prioritizes, fells, replants automatically

// ❌ BAD: Monolithic
build_shelter() // Does everything from finding location to placing final block
```

**When to Add Helpers:**
- Only after testing reveals gaps in existing tool coverage
- When Claude repeatedly struggles with same calculation (e.g., "is this a 2x2 tree?")
- Keep helpers focused: `check_mega_tree_base(x, y, z)` NOT `handle_all_tree_types()`

#### Creating a New Skill

1. **Create directory structure:**
   ```bash
   mkdir -p .claude/skills/your-skill-name
   ```

2. **Write SKILL.md with frontmatter:**
   ```yaml
   ---
   name: your-skill-name
   description: Clear description of what this skill does and when to use it. Be specific!
   allowed-tools: tool1, tool2, tool3
   ---

   # Your Skill Name

   ## Overview
   Brief description of the skill's purpose.

   ## Strategy
   Step-by-step guide for accomplishing the task.

   ## Common Mistakes
   Pitfalls to avoid.

   ## Example Workflow
   Concrete example with coordinates and tool calls.
   ```

3. **Add supporting documentation if needed:**
   - Create subdirectories for variants (tree_types, shelter_types, etc.)
   - One .md file per variant
   - Include specific measurements, patterns, difficulties

4. **Test the skill:**
   - Start bot
   - Ask Claude to perform the task
   - Verify Claude reads the SKILL.md and follows the strategy
   - Add helper functions ONLY if gaps emerge

#### Example: Tree-Felling Skill

**File:** `.claude/skills/tree-felling/SKILL.md`

**Strategy taught:**
1. Identify tree type (check base for 1x1 or 2x2 pattern)
2. Assess height (count vertical logs)
3. Choose felling method (bottom-up for short, top-down with pillar for tall)
4. Execute felling (dig all logs, handle 2x2 mega trees by clearing all 4 positions)
5. Manage saplings (wait for leaf decay, collect, replant)

**Tools used:** find_tree, fell_tree, find_block, dig_block, place_block, move_to_position, get_position, list_inventory

**Supporting docs:**
- `tree_types/oak.md`: Simple 1x1, 4-7 blocks, easy
- `tree_types/spruce.md`: Normal OR mega (2x2), 7-30 blocks, requires pillaring for mega

**Result:** Claude can autonomously gather wood by reading the strategy and calling the right tools in the right order.

#### Skills vs Tools vs Helpers

| Component | Purpose | Location | Examples |
|-----------|---------|----------|----------|
| **Tools** | Atomic game actions | `src/agent/tools.ts` | dig_block, place_block, find_tree |
| **Helpers** | Simple calculations/checks | `src/agent/tools.ts` or `src/skills/` | check_tree_height, is_mega_tree |
| **Skills** | Strategy documentation | `.claude/skills/*/SKILL.md` | tree-felling, shelter-building |

> Store project-specific skills inside `minecraft-claude-agent/.claude/skills/` so they travel with the repo; keep the workspace-level `.claude/skills/` for editor tooling only.

**Flow:**
1. User: "Gather 20 oak logs"
2. Claude reads `tree-felling/SKILL.md` (matches "gathering wood")
3. Claude follows strategy: find_tree → assess height → dig_block → collect saplings → place_block
4. All actual work done by calling tools

**Key Insight:** Skills make Claude smarter without adding code complexity!

## Bot Naming Scheme

### 🇩🇪 Deutsche Komposita + "Bot"

Jeder Bot erhält einen Namen nach dem Muster:

```
[Wortstamm oder Kompositum] + "Bot"
```

Das erste Wort beschreibt **Charakter, Beruf, Material oder Eigenheit** des Bots.
Der Zusatz „Bot" macht klar, dass es sich um eine KI-Einheit handelt.

**Beispiele:**
- `KlotzBot` → trotteliger, aber sympathischer Helfer
- `RedstoneBot` → Ingenieur-Typ
- `SchürfBot` → Minen-Spezialist
- `BauBot` → Bau-Experte
- `BrotBot` → Bäcker oder Essens-Manager

### Typische Wortkategorien

| Kategorie | Beschreibung | Beispielnamen |
|-----------|--------------|---------------|
| **Berufe / Tätigkeiten** | zeigen den Job im Spiel | SchürfBot, BauBot, HackBot, ZuchtBot |
| **Charaktereigenschaften** | geben Persönlichkeit | FaulBot, WitzBot, StolzBot, PlapperBot |
| **Materialien / Ressourcen** | thematisch an Blöcke gebunden | KohlenBot, EisenBot, HolzBot |
| **Tiere / Wesen** | für tierähnliche Bots | SchafBot, WolfBot, WurmBot |
| **Humor / Quatsch** | absurde Wortspiele | WurstBot, KeksBot, KlötzchenBot |
| **Technisch / Futuristisch** | cooler Klang | DatenBot, CodeBot, SignalBot |

### Stilregeln

- **Kurz halten:** 1–2 Silben vor „Bot" wirken am besten
- **Klang vor Bedeutung:** lustige oder rhythmische Namen gewinnen
- **Konsonantenstark:** Deutsche Komposita mit *k*, *t*, *sch*, *p* klingen „blockiger"
- **Großschreibung:** Einheitlich groß (z. B. *Schlaubot*, *KlotzBot*)
- **Variante erlaubt:** Für extra Humor kannst du Bindestriche verwenden (z. B. *Keks-Bot*, *Klötz-Bot*)

### Erweiterungen

- **Serien- oder Klassen-Prefix:** `"MK II KlotzBot"` oder `"Proto-Schlaubot"` für Upgrades
- **Plural:** einfach `-Bots` (z. B. *die KlotzBots*)
- **Persönliche Spitznamen:** bei liebenswerten Exemplaren z. B. *Klotzi*, *Schlaubi*

**Aktuelle Bots:**
- `ClaudeExplorer` - Erkundet die Welt und sammelt Ressourcen
- `ClaudeTrader` - Handelt mit Dorfbewohnern

### 1. VISUAL VERIFICATION IS MANDATORY

**Never trust logs alone!** The bot may report success while actually failing silently.

Before fixing any bug related to game state or block placement:
1. **First**: Set up visual verification
2. **Then**: Confirm the actual problem
3. **Finally**: Fix the bug

#### Visual Verification Setup

We use **prismarine-viewer** + **Playwright MCP** for real-time debugging:

```typescript
// In MinecraftBot.ts, add viewer on spawn:
import { mineflayer as mineflayerViewer } from 'prismarine-viewer';

private startViewer(): void {
  if (!this.bot) return;
  try {
    // firstPerson: false gives better overview of structures being built
    mineflayerViewer(this.bot, { port: 3000, firstPerson: false });
    logger.info(`Prismarine viewer started at http://localhost:3000`);
  } catch (error: any) {
    logger.error('Failed to start prismarine viewer', { error: error.message });
  }
}
```

**Camera Controls in Browser:**
- Click and drag: Rotate camera
- Scroll: Zoom in/out
- Right-click and drag: Pan view
- Third-person view (firstPerson: false) recommended for better spatial awareness

**Canvas Dependency Fix:**
```bash
# Canvas needs native bindings - rebuild after install
npm rebuild canvas
# Or build canvas in its directory
cd node_modules/.pnpm/canvas@*/node_modules/canvas && npm run install
```

**Taking Screenshots with Playwright MCP:**
```typescript
// From Claude Code session:
await mcp__playwright__browser_navigate({ url: "http://localhost:3000" });
await mcp__playwright__browser_take_screenshot({ filename: "debug-view.png" });
```

Screenshots saved to: `.playwright-mcp/*.png`

### 2. The Place Block Bug (FIXED)

**Problem:** Bot reported successful block placement but nothing appeared in-game.

**Root Cause:** Face vector was inverted in `place_block` tool.

#### Understanding Mineflayer's placeBlock API

```typescript
bot.placeBlock(referenceBlock, faceVector)
```

- `referenceBlock`: The existing block you're placing AGAINST
- `faceVector`: Direction FROM reference block TO where you want to place

**Our Bug:**
```typescript
// WRONG - faceVec points FROM target TO reference
const faceVec = new Vec3(0, -1, 0); // "bottom" = point down
const referencePos = targetPos.plus(faceVec); // Block below target
bot.placeBlock(referenceBlock, faceVec); // ❌ Wrong direction!
```

**The Fix:**
```typescript
// CORRECT - Negate the vector for placeBlock
const faceVec = new Vec3(0, -1, 0); // Still use for finding reference
const referencePos = targetPos.plus(faceVec);
const placeFaceVec = faceVec.scaled(-1); // ✅ Now points UP (0, 1, 0)
bot.placeBlock(referenceBlock, placeFaceVec); // ✅ Correct!
```

**Location:** `/src/agent/tools.ts:297`

### 3. MCP Tools for Verification

Use Minecraft MCP server to verify actual game state:

```typescript
// Check if block was actually placed
await mcp__minecraft__get_block_info({ x: 88, y: 64, z: 73 });
// Returns: "Found air" or "Found oak_log"

// Check bot position
await mcp__minecraft__get_position();
// Returns: "Current position: (90, 64, 75)"
```

**Lesson:** Always verify with MCP after "successful" operations. Logs can lie!

## Context Management with Subagents

**CRITICAL:** Use the Task tool to launch subagents for context-heavy operations to conserve tokens in the main development loop.

### When to Use Subagents

Launch a subagent (via Task tool) for these scenarios:

1. **Log Analysis**
   - Analyzing large log files (>500 lines)
   - Searching through multiple log files for error patterns
   - Correlating events across log timestamps
   - Example: Finding why gather_wood failed by analyzing agent.log

2. **Screenshot/Image Analysis**
   - Analyzing Playwright screenshots to verify bot behavior
   - Comparing before/after screenshots
   - Identifying visual bugs in prismarine-viewer
   - Example: Verifying blocks were placed correctly at specific coordinates

3. **Code Exploration**
   - Understanding how a system works across multiple files
   - Finding where specific functionality is implemented
   - Tracing execution flow through the codebase
   - Example: Understanding how pathfinder goals work in mineflayer

4. **Multi-File Refactoring**
   - Renaming functions/variables across files
   - Updating imports after file moves
   - Applying consistent patterns across multiple modules

5. **Testing & Debugging**
   - Running tests and analyzing failures
   - Debugging complex issues requiring multiple iterations
   - Testing new skills in isolation

### How to Use Subagents Effectively

```typescript
// ❌ BAD: Reading large log directly in main session
const logs = await Read({ file_path: 'logs/agent.log' }); // 5000 lines!
// Now analyzing in main context...

// ✅ GOOD: Use subagent for log analysis
await Task({
  subagent_type: 'general-purpose',
  description: 'Analyze gather_wood errors',
  prompt: `Read logs/agent.log and find all errors related to the gather_wood skill.

  Report back:
  1. What error occurred?
  2. At what timestamp?
  3. What was the bot's state when it failed?
  4. Root cause analysis

  Keep your response concise - just the key findings.`
});
```

### Subagent Best Practices

1. **Be Specific**: Give subagents clear, focused tasks
2. **Request Summaries**: Ask subagents to return concise findings, not full logs
3. **Limit Scope**: Don't ask subagents to "fix everything" - one task at a time
4. **Use for Heavy Lifting**: Screenshots, logs, multi-file searches
5. **Main Loop for Decisions**: Use main session for high-level planning and decisions

### Example Workflows

#### Debugging gather_wood Failure

```typescript
// Main loop: Identify issue
"gather_wood returned error, let me investigate"

// Subagent: Analyze logs
await Task({
  subagent_type: 'general-purpose',
  description: 'Analyze gather_wood error',
  prompt: 'Read logs/agent.log, find the gather_wood error, and report:
    1. Error message
    2. Stack trace if present
    3. Last successful tool call before error
    Respond with just these 3 items.'
});

// Subagent reports: "pathfinder.goto threw error: No path found"

// Main loop: Fix the issue
"Now I know it's a pathfinding issue, let me check if trees are out of range..."
```

#### Visual Verification with Screenshots

```typescript
// Main loop: Need to verify bot behavior visually
"Bot claims it placed blocks, let me verify with screenshot"

// Subagent: Take and analyze screenshot
await Task({
  subagent_type: 'general-purpose',
  description: 'Verify block placement',
  prompt: `
    1. Navigate to http://localhost:3000 using Playwright MCP
    2. Take screenshot: verify-blocks.png
    3. Check if blocks exist at coordinates (85,64,71) to (87,65,73)
    4. Report: Did blocks get placed? What does the structure look like?

    Keep response to 2-3 sentences.
  `
});

// Subagent reports: "Screenshot shows 4 oak_log blocks at corners. Walls incomplete."

// Main loop: Continue based on findings
"Blocks placed successfully at corners. Need to fill in walls between..."
```

### Token Savings

By offloading heavy operations to subagents:
- **Log analysis**: Save ~5000+ tokens per log file
- **Screenshot analysis**: Save ~2000+ tokens per image
- **Code exploration**: Save ~10000+ tokens for multi-file searches
- **Main loop stays focused**: Keep context for high-level logic and decisions

### Warning Signs You Need a Subagent

- Reading files over 1000 lines in main session
- Analyzing multiple screenshots
- Searching through >5 files for something
- Iterating on the same debugging task >3 times
- Main conversation context approaching 100k tokens

**Remember:** Subagents are disposable - use them liberally for heavy lifting!

## Development Workflow

### Standard Debug Process

1. **Reproduce the issue**
   - Run the bot: `pnpm start`
   - Observe behavior in-game or viewer

2. **Visual Verification**
   - Open http://localhost:3000 in browser
   - Use Playwright MCP for screenshots
   - Use MCP get-block-info to verify state

3. **Identify Root Cause**
   - Check logs for patterns
   - Compare reported success vs actual state
   - Use screenshots to see what's really happening

4. **Fix and Test**
   - Make code changes
   - Rebuild: `pnpm run build`
   - Restart bot and verify fix with screenshots

### Common Gotchas

1. **Canvas Module Issues**
   - Symptom: `Cannot find module 'canvas'`
   - Fix: `npm rebuild canvas`

2. **False Success Reports**
   - Bot logs "success" but nothing happens
   - Always verify visually + MCP tools

3. **Coordinate Systems**
   - Y=63: Usually ground level
   - Y=64+: Above ground (where walls should go)
   - Bot position vs block placement reach (~4.5 blocks)

4. **Face Vectors**
   - Review the placeBlock fix above carefully
   - Test with simple block placement before complex builds

## Project Structure

```
src/
├── agent/
│   ├── ClaudeAgent.ts       # Main AI agent with tool loop
│   └── tools.ts             # All 12 Minecraft tools (CRITICAL FILE)
├── bot/
│   └── MinecraftBot.ts      # Mineflayer wrapper + viewer setup
├── config.ts                # Configuration
├── logger.ts                # Winston logging
└── index.ts                 # Entry point
```

**Critical Files:**
- `tools.ts`: All game interaction tools - test thoroughly after changes
- `ClaudeAgent.ts`: Tool execution loop - handles timeouts and retries
- `MinecraftBot.ts`: Event handlers and viewer - keep viewer active

## Testing Checklist

Before considering any block placement feature "done":

- [ ] Visual confirmation via prismarine-viewer (http://localhost:3000)
- [ ] Screenshot taken with Playwright MCP
- [ ] MCP get-block-info verification shows correct block type
- [ ] Bot can place blocks at Y=64 and above
- [ ] Multiple blocks can be placed in sequence
- [ ] Blocks placed near bot (< 4.5 block radius)
- [ ] No timeout errors in logs

## Useful Commands

```bash
# Development
pnpm run dev              # Watch mode with tsx
pnpm run build            # Compile TypeScript
pnpm start                # Run compiled bot

# Colony runtime & management
pnpm colony               # Start all bots and the dashboard (http://localhost:4242)
pnpm colony-ctl status    # Show per-bot status summary
pnpm colony-ctl start-all # Launch bots from bots.yaml without the dashboard

# Debugging
lsof -i :3000            # Check if viewer port is in use
npm rebuild canvas       # Fix canvas native module

# Clean restart
rm -rf dist && pnpm run build && pnpm start
```

## Future Improvements

### Potential Features
- [ ] Add more building shapes (roof, door, windows)
- [ ] Pathfinding integration for complex builds
- [ ] Material inventory management
- [ ] Multi-story building support
- [ ] Automatic screenshot on errors

### Known Limitations
- Bot reach is ~4.5 blocks (move closer for distant placements)
- Only 15 oak logs in starting inventory
- No automatic material gathering yet
- Viewer doesn't show real-time updates (refresh browser)

## Success Metrics

**This bot is working when:**
1. Visual viewer at localhost:3000 shows structures
2. In-game player can see the built structures
3. MCP verification confirms blocks exist
4. No timeout errors in logs
5. Bot completes building tasks autonomously

---

**Last Updated:** 2025-11-02
**Status:** ✅ Migrated to Claude Agent SDK with automatic skill loading
**Recent Changes:**
- ✅ **Migrated from raw Anthropic SDK to Claude Agent SDK**
  - All 22 tools converted to MCP format using `createSdkMcpServer`
  - Skills now automatically load from `.claude/skills/` directory
  - Agent SDK handles skill injection into system prompt
  - Tools use Zod schemas for type safety
- 📋 Context management guidelines - use subagents for logs/screenshots/heavy operations
- 🤖 "Blind Bot" design principle - tools must provide coordinates/actionable data since LLM can't see graphics
- 🌳 Tree-felling skill ready to test with Agent SDK auto-loading
