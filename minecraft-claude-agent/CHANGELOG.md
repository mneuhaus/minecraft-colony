# Changelog

All notable changes to the Minecraft Claude Agent project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **report_status tool** - Comprehensive bot status reporting for colony coordination
  - Generates detailed status reports (health, food, position, inventory summary)
  - Identifies key items (tools, food, materials) in inventory
  - Tracks current task from message inbox
  - Determines bot status (idle/working/emergency/offline)
  - Saves status to state file for dashboard integration
  - Optional broadcast mode for colony-wide status updates
  - Warns about critical conditions (low health, low food, full inventory)
  - Location: `src/tools/colony/report_status.ts`

- **TODO.md** - Comprehensive roadmap tracking Phase 1-5 progression with 100+ actionable tasks
  - Documents all 5 bots in active colony (HandelBot, SammelBot, BauBot, GräberBot, SpähBot)
  - Phase 2 priorities: tree-felling expansion, stone acquisition, shelter completion
  - Tracks technical debt, multi-bot coordination scenarios, and success metrics
  - Location: `TODO.md`

- **find_stone tool** - Find accessible stone deposits (surface, cliff, cave) for Phase 2 stone gathering
  - Returns sorted list of stone deposits with coordinates, distance, and accessibility assessment
  - Follows "blind bot" principle with actionable data (coordinates + cluster size + estimated yield)
  - Filters out buried/inaccessible stone deposits
  - Supports all stone types (stone, cobblestone, granite, andesite, diorite, deepslate)
  - Location: `src/tools/mining/find_stone.ts`

- **stone-gathering skill** - Phase 2 essential resource acquisition documentation
  - Complete workflow from pickaxe crafting to stone tool upgrades
  - Safety protocols for cliff and cave mining
  - Tool durability management and upgrade paths (wood → stone → iron)
  - Multi-bot coordination scenarios (SpähBot scouts, GräberBot mines, HandelBot processes)
  - Crafting recipes for furnace and all stone tools
  - Location: `.claude/skills/mining/stone-gathering.md`

- **jungle tree documentation** - Complete jungle tree felling strategy for tree-felling skill
  - Small jungle trees (1x1, 4-6 logs) vs mega jungle trees (2x2, 40-120 logs)
  - Branch removal strategies for mega trees (jungle branches extend 3-5 blocks)
  - Sapling rarity handling (jungle saplings rare, 0-3 per mega tree)
  - Top-down vs bottom-up felling approaches for mega trees
  - Location: `.claude/skills/tree-felling/tree_types/jungle.md`

- **colony-coordination skill** - Comprehensive multi-bot orchestration and task delegation system
  - Defines bot roles (HandelBot/Trader, SammelBot/Gatherer, BauBot/Builder, GräberBot/Miner, SpähBot/Scout)
  - Communication hierarchy with 3-tier priority system (HIGH/NORMAL/LOW)
  - Task delegation protocols (TASK/ACCEPT/COMPLETE format)
  - Emergency response workflows for critical situations
  - Colony-wide project coordination patterns
  - Daily sync procedures and status reporting
  - Resource chain coordination (exploration → gathering → processing → building)
  - Dynamic task reallocation for adaptive planning
  - Integration with all existing skills for coordinated operations
  - Location: `.claude/skills/colony-coordination/SKILL.md`

- **resource-management skill** - Inventory coordination and multi-bot resource distribution
  - Tracks resource states (abundant/sufficient/scarce/critical)
  - Coordinates material requests between bots using send_bot_message/read_bot_messages
  - Storage organization strategies for central/personal/work storage
  - Material sharing protocols with priority handling
  - Integration with existing skills (tree-felling, building, mining, trading)
  - Location: `.claude/skills/resource-management/SKILL.md`

### Changed
- **building skill** - Enhanced with multi-bot coordination capabilities
  - Added support for large builds requiring >200 blocks
  - Work zone division strategies for parallel construction
  - Coordination protocols for progress tracking and synchronization
  - Common multi-bot patterns (parallel walls, layer-by-layer, assembly line)
  - New allowed-tools: send_bot_message, read_bot_messages, find_entity
  - Location: `.claude/skills/building/SKILL.md`

### Improved
- Colony runtime successfully manages 5 bots simultaneously (HandelBot, SammelBot, BauBot, GräberBot, SpähBot)
- Bot state files provide real-time inventory and position tracking
- Inter-bot communication tested via debug console and message system
- German language support for all bot chat responses (CHAT_LANGUAGE=german in bots.yaml)

## [1.0.0] - 2025-11-02

### Added
- Initial release with Claude Agent SDK integration
- 22 MCP tools for Minecraft interaction
- Agent skills architecture with automatic loading
- Tree-felling skill with multi-tree-type support
- Building, trading, mining, combat, farming, navigation, crafting, exploration skills
- Colony runtime orchestration system
- Bot state tracking and dashboard (port 4242)
- Prismarine viewer integration for visual debugging
- Logging system with YAML agent.log and markdown diary.md

### Technical
- Migrated from raw Anthropic SDK to Claude Agent SDK
- All tools use Zod schemas for type safety
- Skills automatically inject into system prompt
- MCP server created using createSdkMcpServer
- Support for bot-to-bot messaging (send_bot_message/read_bot_messages)
- Automatic message polling every 30 seconds

---

**Note**: Version numbers follow semantic versioning:
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes
