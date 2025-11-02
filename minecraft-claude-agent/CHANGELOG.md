# Changelog

All notable changes to the Minecraft Claude Agent project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **resource-management skill** - New skill for inventory coordination and multi-bot resource distribution
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
- Colony runtime successfully manages 3+ bots simultaneously (HandelBot, SammelBot, BauBot)
- Bot state files provide real-time inventory and position tracking
- Inter-bot communication tested via debug console

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
