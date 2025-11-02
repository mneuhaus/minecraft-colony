# Claude Minecraft Agent

A standalone Node.js agent that connects to Minecraft servers using [mineflayer](https://github.com/PrismarineJS/mineflayer) and is powered by Claude AI through the [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript).

## Features

- **Event-Driven Architecture**: No polling! The bot reactively responds to game events in real-time
- **Anthropic SDK Integration**: Uses the latest Claude Sonnet 4.5 model with tool use for intelligent decision-making
- **Comprehensive Tool System**: 12+ tools for movement, inventory, blocks, entities, and chat
- **Robust Logging**: Structured logging with winston for debugging and analysis
- **Skills System**: Extensible architecture for adding higher-level bot behaviors
- **Auto-Reconnect**: Automatically reconnects on disconnection
- **Type-Safe**: Written in TypeScript with full type safety

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Agent                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Claude Agent SDK (Sonnet 4.5)              │   │
│  │  - Natural language understanding                    │   │
│  │  - Tool orchestration                                │   │
│  │  - Context management                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↕                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Tool System                         │   │
│  │  - Movement (navigate, look, jump)                   │   │
│  │  - Inventory (list, find, equip)                     │   │
│  │  - Blocks (dig, find)                                │   │
│  │  - Entities (find players/mobs)                      │   │
│  │  - Chat (send/receive messages)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↕                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MinecraftBot Wrapper                    │   │
│  │  - Event emitters (chat, damage, player join/leave) │   │
│  │  - State management (position, health, inventory)   │   │
│  │  - Mineflayer bot instance                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↕
                   Network Protocol
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                  Minecraft Paper Server                      │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 16+ (with ES module support)
- pnpm (or npm/yarn)
- A running Minecraft server (Paper/Spigot/Vanilla 1.21.1+)
- Anthropic API key ([get one here](https://console.anthropic.com/))

## Installation

1. **Clone or navigate to the project**:
   ```bash
   cd minecraft-claude-agent
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file** (choose one authentication method):

   **Option A: Using API Key** (from [console.anthropic.com](https://console.anthropic.com/)):
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...

   MC_HOST=localhost
   MC_PORT=25565
   MC_USERNAME=ClaudeBot
   LOG_LEVEL=info
   ```

   **Option B: Using OAuth Token** (from Claude subscription):
   ```bash
   ANTHROPIC_AUTH_TOKEN=your_oauth_token_here

   MC_HOST=localhost
   MC_PORT=25565
   MC_USERNAME=ClaudeBot
   LOG_LEVEL=info
   ```

5. **Build the project**:
   ```bash
   pnpm build
   ```

## Usage

### Minecraft Colony Runtime

Launch all bots defined in `bots.yaml` and the dashboard together:

```bash
pnpm colony
```

The runtime keeps the bot supervisor and dashboard in one place, shutting everything down cleanly on Ctrl+C. Set `DISABLE_VIEWER=true` if you want to skip Prismarine Viewer for headless runs.

### Bot Control CLI

Use `colony-ctl` for targeted actions against specific bots:

```bash
pnpm colony-ctl start-all     # start every bot
pnpm colony-ctl stop-all      # stop every bot
pnpm colony-ctl restart <botName>
```

### Development Mode (with hot reload)

```bash
pnpm dev
```

This uses `tsx watch` to automatically rebuild and restart when you make changes.

### Production Mode

```bash
pnpm start
```

This runs the compiled JavaScript from the `dist/` folder.

## Available Tools

The bot has access to these tools that Claude can use:

### Movement Tools
- `get_position` - Get current bot position
- `move_to_position` - Navigate to specific coordinates using pathfinding
- `look_at` - Look at a specific position

### Inventory Tools
- `list_inventory` - List all items in inventory
- `find_item` - Find a specific item by name
- `equip_item` - Equip item to hand or armor slot

### Block Tools
- `dig_block` - Dig/mine a block at coordinates
- `find_block` - Find nearest block of specific type

### Entity Tools
- `find_entity` - Find nearest player, mob, or any entity

### Chat Tools
- `send_chat` - Send a message to all players
- `get_recent_chat` - Get recent chat history

## Interacting with the Bot

Once the bot is running and connected to your server, you can interact with it through in-game chat:

```
<Player> ClaudeBot, can you find some wood?
<ClaudeBot> I'll search for nearby trees!
<ClaudeBot> Found oak_log at position (123, 64, 456)

<Player> Come over here
<ClaudeBot> On my way!

<Player> What's in your inventory?
<ClaudeBot> I have 32 oak logs, 16 cobblestone, and a wooden pickaxe.
```

The bot will:
- Respond naturally to player messages
- Use tools autonomously to accomplish tasks
- Maintain awareness of game state (health, position, inventory)
- React to events (taking damage, player joins/leaves)

## Project Structure

```
minecraft-claude-agent/
├── src/
│   ├── index.ts                 # Entry point
│   ├── config.ts                # Configuration management
│   ├── logger.ts                # Winston logging setup
│   ├── bot/
│   │   └── MinecraftBot.ts      # Mineflayer bot wrapper
│   ├── agent/
│   │   ├── ClaudeAgent.ts       # Claude Agent SDK integration
│   │   └── tools.ts             # Tool definitions
│   └── skills/                  # Future skills directory
│       └── README.md            # Skills system documentation
├── logs/                        # Log files
│   ├── agent.log                # All logs
│   └── error.log                # Error logs only
├── dist/                        # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .env                         # Environment variables (not in git)
└── README.md
```

## Logging

The agent uses winston for comprehensive logging:

- **Console**: Colored, human-readable logs
- **agent.log**: All logs (rotated at 10MB, keeps 5 files)
- **error.log**: Error-level logs only

Log levels (set via `LOG_LEVEL` in `.env`):
- `error` - Only errors
- `warn` - Warnings and errors
- `info` - General information (default)
- `debug` - Detailed debugging information

## Adding Skills

Skills are higher-level capabilities built on top of basic tools. See [`src/skills/README.md`](src/skills/README.md) for detailed documentation on creating custom skills.

Example skills you might create:
- `find_tree` - Locate and navigate to trees
- `gather_wood` - Autonomous wood collection
- `build_shelter` - Build a simple structure
- `auto_farm` - Automated farming

## Advantages Over MCP Approach

| Feature | MCP Server | Standalone Agent |
|---------|-----------|------------------|
| **Latency** | Multiple network hops | In-process (fast) |
| **Events** | Polling required | Native event emitters |
| **Context** | Must query state | Continuous awareness |
| **Deployment** | External process | Single Node.js app |
| **Debugging** | Harder (multiple processes) | Standard Node.js tools |
| **Hot Reload** | Requires restart | `tsx watch` mode |

## Future Enhancements

- [ ] Add more sophisticated pathfinding skills
- [ ] Implement combat/defense behaviors
- [ ] Add crafting and building skills
- [ ] Create a skill loader for automatic skill discovery
- [ ] Add support for multiple bots
- [ ] Integrate with Paper plugin for server-side operations (optional)
- [ ] Add visual debugging/monitoring interface

## Troubleshooting

### Bot can't connect to server

- Ensure server is running and reachable
- Check `MC_HOST` and `MC_PORT` in `.env`
- Verify server is in `online-mode=false` (in `server.properties`) if not using Mojang authentication

### API errors from Claude

- Verify `ANTHROPIC_API_KEY` is correct
- Check API quota/limits at [Anthropic Console](https://console.anthropic.com/)
- Review logs for specific error messages

### Bot doesn't respond to chat

- Check logs for errors
- Ensure bot successfully spawned (`Bot spawned successfully` in logs)
- Try simpler commands first: "ClaudeBot, hello"

### High latency/slow responses

- Check network connection to both Minecraft server and Anthropic API
- Consider using a closer Minecraft server
- Review logs for timing information

## Contributing

Contributions are welcome! Areas for improvement:
- Additional tools and skills
- Better error handling
- Performance optimizations
- Documentation improvements

## License

ISC

## Acknowledgments

- [PrismarineJS/mineflayer](https://github.com/PrismarineJS/mineflayer) - The excellent Minecraft bot framework
- [Anthropic](https://www.anthropic.com/) - Claude AI and Agent SDK
- Previous MCP implementation for inspiration
