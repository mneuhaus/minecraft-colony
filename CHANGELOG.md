# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **MAJOR: Migrated from raw Anthropic SDK to Claude Agent SDK**
  - All 22 tools converted to MCP format using `createSdkMcpServer`
  - Tool inputs now use Zod schemas instead of JSON Schema for type safety
  - Skills automatically load from `.claude/skills/` directory
  - Agent SDK handles skill injection into system prompt
  - Refactored `ClaudeAgent` to `ClaudeAgentSDK` using `query()` API
  - Created `mcpTools.ts` with all tool definitions in Agent SDK format
  - Set `settingSources: ['project']` to enable automatic skill discovery
  - **Breaking:** Tool names now prefixed with `mcp__minecraft__` (e.g., `mcp__minecraft__get_position`)
- Tree-felling tool signatures updated to match helper function parameters:
  - `find_trees`: Now accepts `treeTypes` array instead of single string
  - `collect_nearby_items`: Parameters reordered to `itemTypes` array + `maxDistance`
  - `find_plantable_ground`: Now requires coordinates (nearX, nearY, nearZ) + radius
  - `build_pillar`: Second parameter is `descendAfter` boolean, not `blockName`
  - `wait_for_saplings`: Now requires tree location coordinates (x, y, z)

### Added
- **Stone Mining Skills** (COMPLETED):
  - `find_stone` - Locate stone blocks within range, sorted by distance
  - `mine_stone` - Mine stone at specific coordinates (requires pickaxe for drops)
- **Crafting System** (COMPLETED):
  - `craft_item` - Universal crafting tool for all Minecraft recipes
  - Tested: Crafted 60 oak_planks, 1 crafting_table (placed), 4 sticks successfully
- Core survival skills (in progress):
  - `craft_item` - Crafting system
  - `make_tools` - Tool crafting progression
  - `build_shelter` - Complete house building
- TODO.md for tracking development roadmap
- CHANGELOG.md for tracking project changes
- **Context Management section in CLAUDE.md**
  - Comprehensive guide on using subagents for heavy operations
  - 5 scenarios when to use subagents (logs, screenshots, code exploration, refactoring, testing)
  - Best practices and example workflows
  - Token savings guidelines (save 5000+ tokens per log file, 2000+ per screenshot)
  - Warning signs that indicate need for subagent usage

### Changed
- Viewer mode set to first-person for better debugging visibility
- Starting mission now tests find_tree and fell_tree skills
- **Tool Architecture:** Refactored from monolithic `gather_wood` to modular `find_tree` + `fell_tree`
  - Principle: Design tools for "blind bot" - LLM can't see graphics, needs coordinates/data
  - `find_tree`: Returns all trees sorted by distance with coordinates
  - `fell_tree`: Takes exact position to chop
  - Each tool is atomic, returns actionable data (coordinates, distances, options)

## [0.1.0] - 2025-11-02

### Added
- Initial Claude Minecraft bot implementation using mineflayer
- 12 core Minecraft interaction tools:
  - `get_position` - Get bot's current coordinates
  - `move_to_position` - Navigate to specific location
  - `look_at` - Look at specific coordinates
  - `jump` - Make bot jump
  - `move_in_direction` - Move in cardinal directions
  - `list_inventory` - View inventory contents
  - `find_item` - Search inventory for items
  - `equip_item` - Equip items to hand/armor slots
  - `place_block` - Place blocks at coordinates
  - `dig_block` - Mine/break blocks
  - `find_block` - Locate nearest block of type
  - `find_entity` - Locate nearby entities
  - `send_chat` - Send chat messages
  - `get_recent_chat` - Read chat history
- Prismarine-viewer integration for 3D web visualization
- Playwright MCP integration for automated screenshots
- MCP Minecraft server tools for game state verification
- Comprehensive CLAUDE.md development guide
- Winston logger for debugging
- Event-based architecture with ClaudeAgent and MinecraftBot
- Starting mission: "Build a small wooden house"

### Fixed
- **CRITICAL**: Fixed inverted face vector bug in `place_block` tool
  - Bug: Bot reported successful placement but blocks weren't appearing
  - Root cause: Face vector pointed wrong direction for mineflayer's `placeBlock()` API
  - Solution: Negate face vector with `faceVec.scaled(-1)` before calling `placeBlock()`
  - Result: Blocks now place successfully, verified visually and via MCP
- Canvas native module build issues
  - Added rebuild steps to documentation
  - Documented pnpm dependency resolution

### Changed
- Tool execution timeout reduced from 5s to 2s for faster feedback
- Added verification logic to check actual block placement vs reported success
- Improved error messages in place_block tool
- System prompts updated to emphasize tool usage over descriptions

## [0.0.1] - 2025-11-01

### Added
- Initial project setup
- Basic mineflayer bot connection
- Anthropic Claude SDK integration

---

**Development Principles:**
- Visual verification is MANDATORY before bug fixes
- Never trust logs alone - verify with screenshots and MCP tools
- Document all bugs and fixes in CLAUDE.md for future reference
- Use Keep a Changelog format for all version updates

**Project Status:** ✅ Block placement working, building skills in development
