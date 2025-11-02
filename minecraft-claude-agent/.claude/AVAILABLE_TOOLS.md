# Available Tools for Minecraft Bots

This document lists all tools available to the Minecraft bots through the MCP server.

## Minecraft-Specific Tools

### Movement & Navigation
- **get_position** - Get bot's current X, Y, Z coordinates
- **move_to_position** - Navigate to specific coordinates using pathfinding
- **look_at** - Look at specific coordinates (required before breaking/placing blocks)

### Inventory Management
- **list_inventory** - List all items in bot's inventory with counts
- **find_item** - Find specific item in inventory by name
- **drop_item** - Drop items from inventory onto ground
- **equip_item** - Equip items to hand or armor slots
- **open_chest** - Open nearby chests for interaction
- **deposit_items** - Put items into open chest
- **withdraw_items** - Take items from open chest

### Crafting & Placement
- **craft_item** - Craft items using recipes (requires crafting table for 3x3)
- **place_block** - Place blocks at specific coordinates

### Entity Interaction
- **find_entity** - Find nearby players or mobs within radius

### Communication
- **send_chat** - Send messages in Minecraft chat (visible to all players)
- **get_recent_chat** - Read recent chat messages from other players/bots
- **read_diary_entries** - Read bot's own diary/journal entries

### Tree Felling Skill Tools
- **find_trees** - Locate trees of specific type within radius
- **get_tree_structure** - Analyze tree structure (logs and leaves)
- **check_reachable** - Check if position is within reach (~4.5 blocks)
- **break_block_and_wait** - Mine block, wait for drops, auto-collect items
- **collect_nearby_items** - Pick up dropped items within radius
- **wait_for_saplings** - Wait for saplings to grow into trees
- **find_plantable_ground** - Find suitable dirt/grass for planting
- **place_sapling** - Plant saplings at coordinates
- **build_pillar** - Build up vertically with blocks
- **descend_pillar_safely** - Safely descend pillars by breaking blocks

### Mining Skill Tools (NEW!)
- **find_stone** - Find nearest stone blocks
- **find_block** - Find any block type by name (stone, coal_ore, iron_ore, dirt, etc.)
- **dig_block** - Mine single block at coordinates (must be within reach)
- **get_block_info** - Get detailed block info (type, hardness, tool requirements, reachability)

### World Information
- **detect_time_of_day** - Check if day/night and mob spawn safety
- **detect_biome** - Detect current biome at bot's location
- **scan_biomes_in_area** - Scan for biomes within radius
- **get_nearby_blocks** - Get block types around bot

### Colony Coordination
- **report_status** - Generate comprehensive status report (health, food, inventory, position)

## Development Tools (Claude Code Tools)

**IMPORTANT**: Bots have access to full Claude Code development tools! This means they can:
- Read and modify their own code
- Create git commits
- Search and analyze the codebase
- Create new files and tools

### File Operations
- **Read** - Read files from filesystem
- **Write** - Create new files
- **Edit** - Modify existing files with exact string replacement
- **Glob** - Find files by pattern (e.g., "**/*.ts")
- **Grep** - Search for text/regex patterns in files

### System Operations
- **Bash** - Execute shell commands (git, pnpm, npm, etc.)
  - Can run builds: `pnpm run build`
  - Can create commits: `git add . && git commit -m "message"`
  - Can install dependencies: `pnpm install package-name`
  - Can run tests, scripts, etc.

### Code Intelligence
- **Task** - Launch specialized agents for complex tasks
  - Explore agent - for codebase exploration
  - Plan agent - for planning implementations

## Tool Usage Guidelines

### Atomic Tool Design
Tools should do ONE thing and return data. The LLM (Claude) makes decisions based on returned data. Don't build complex multi-step logic into tools.

**Example - BAD**: `mine_and_collect(x, y, z)` - does both mining and collection
**Example - GOOD**: `dig_block(x, y, z)` returns result, then `collect_nearby_items()` separately

### Tool Naming Conventions
- Use verbs: `find_block`, `dig_block`, `place_block`
- Be specific: `find_trees` not `find_stuff`
- Indicate scope: `get_nearby_blocks` (implies radius), `get_block_info` (single block)

### Error Handling
Tools should:
1. Return clear error messages as strings
2. Not throw exceptions (wrap in try-catch)
3. Validate inputs before execution
4. Check preconditions (distance, inventory, etc.)

### Coordination Between Bots
Bots can coordinate via:
1. **Minecraft chat** - `send_chat()` for public announcements
2. **Bot messages** - File-based messaging system (messages/*.json)
3. **Shared state files** - logs/*.state.json contain bot status
4. **Diary entries** - Persistent bot memory/logs

## Skill-Based Tool Access

Tools are gated by skills loaded from `.claude/skills/*/SKILL.md`. The `allowed-tools` frontmatter determines which tools a bot can use when that skill is active.

### Current Skills
- **tree-felling** - Tree harvesting and replanting
- **mining** - Resource gathering and excavation
- **building** - Construction (tools TBD)
- **combat** - Fighting mobs (tools TBD)
- **crafting** - Item creation (tools TBD)
- **farming** - Crops and animals (tools TBD)
- **navigation** - Waypoint-based movement (tools TBD)
- **trading** - Player/villager trading (tools TBD)

## Phase Progression (AGENTS.md)

Current phase: **Phase 2 - Essential Gathering**
- ✅ Tree felling implemented
- ✅ Mining tools created
- 🚧 Testing and refinement
- ⏳ Phase 3 - Tool & Equipment Crafting (next)

## Security Considerations

Since bots have Bash/Write/Edit access, they can:
- ⚠️ Modify any file in the project
- ⚠️ Execute arbitrary shell commands
- ⚠️ Create git commits and push to remote (if configured)
- ⚠️ Install/remove dependencies
- ⚠️ Delete files or directories

**Best practice**: Review bot actions and consider sandboxing in production environments.
