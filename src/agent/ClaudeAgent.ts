import Anthropic from '@anthropic-ai/sdk';
import { MinecraftBot } from '../bot/MinecraftBot.js';
import { createTools, ToolDefinition } from './tools.js';
import { Config } from '../config.js';
import logger, { logClaudeCall, startTimer } from '../logger.js';

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; [key: string]: any }>;
}

export class ClaudeAgent {
  private anthropic: Anthropic;
  private tools: ToolDefinition[] = [];
  private conversationHistory: Message[] = [];
  private isProcessing = false;
  private readonly model = 'claude-sonnet-4-5-20250929';

  constructor(
    private config: Config,
    private minecraftBot: MinecraftBot
  ) {
    // Initialize Anthropic SDK with either API key or auth token
    const anthropicConfig: any = {};

    if (this.config.anthropic.authToken) {
      // Use OAuth/bearer token
      anthropicConfig.authToken = this.config.anthropic.authToken;
      logger.info('Using OAuth token for authentication');
    } else if (this.config.anthropic.apiKey) {
      // Use API key
      anthropicConfig.apiKey = this.config.anthropic.apiKey;
      logger.info('Using API key for authentication');
    }

    this.anthropic = new Anthropic(anthropicConfig);

    logger.info('Claude Agent initialized', {
      model: this.model,
    });
  }

  /**
   * Start the event-driven agent loop
   */
  start(): void {
    logger.info('Starting Claude Agent event loop');

    // Listen to minecraft bot events and respond
    this.minecraftBot.on('ready', () => {
      // Create tools now that the bot is connected
      this.tools = createTools(this.minecraftBot);
      logger.info('Bot ready, Claude Agent is now active', {
        toolCount: this.tools.length,
      });
    });

    this.minecraftBot.on('chat', async (data: { username: string; message: string }) => {
      // Only respond if not currently processing
      if (this.isProcessing) {
        logger.debug('Already processing, skipping chat event');
        return;
      }

      // Process the chat message
      await this.handleChatMessage(data.username, data.message);
    });

    this.minecraftBot.on('lowHealth', async (data: { health: number; food: number }) => {
      logger.warn('Low health detected, notifying Claude', data);
      // Could trigger defensive behavior here
    });

    this.minecraftBot.on('damaged', async (data: { health: number }) => {
      logger.warn('Bot damaged, notifying Claude', data);
      // Could trigger defensive behavior here
    });
  }

  /**
   * Handle a chat message from a player
   */
  private async handleChatMessage(username: string, message: string): Promise<void> {
    this.isProcessing = true;
    const timer = startTimer('Claude chat response');

    try {
      logger.info('Processing chat message', { username, message });

      // Build context from current game state
      const context = this.buildContext();

      // Create system prompt
      const systemPrompt = this.buildSystemPrompt(context);

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: `${username}: ${message}`,
      });

      // Keep only last 10 messages
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      logger.debug('Sending request to Claude');
      logClaudeCall(JSON.stringify(this.conversationHistory).length);

      // Call Claude with tools
      let response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: this.conversationHistory as any,
        tools: this.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.input_schema,
        })),
        // Force tool use for tool-appropriate requests
        tool_choice: { type: 'auto' as const },
      });

      // Debug: Log what Claude responded with (using INFO to ensure it shows)
      logger.info('=== CLAUDE RESPONSE DEBUG ===', {
        stop_reason: response.stop_reason,
        content_types: response.content.map((c: any) => c.type),
        content_count: response.content.length,
        raw_content: JSON.stringify(response.content).substring(0, 500),
      });

      let finalResponse = '';
      const maxIterations = 10;
      let iterations = 0;

      // Tool use loop
      while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
        iterations++;

        // Execute all tool calls
        const toolResults: any[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            logger.info('Claude requested tool execution', {
              toolName: block.name,
              toolInput: block.input,
            });

            const tool = this.tools.find((t) => t.name === block.name);
            if (!tool) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Error: Unknown tool: ${block.name}`,
                is_error: true,
              });
              continue;
            }

            try {
              const result = await tool.execute(block.input);
              logger.debug('Tool execution result', { toolName: block.name, result });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
              });
            } catch (error: any) {
              logger.error('Tool execution failed', {
                toolName: block.name,
                error: error.message,
              });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Error: ${error.message}`,
                is_error: true,
              });
            }
          }
        }

        // Add assistant response and tool results to history
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content as any,
        });
        this.conversationHistory.push({
          role: 'user',
          content: toolResults as any,
        });

        // Get next response
        response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: this.conversationHistory as any,
          tools: this.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
          })),
          tool_choice: { type: 'auto' as const },
        });
      }

      // Extract text response
      for (const block of response.content) {
        if (block.type === 'text') {
          finalResponse += block.text;
        }
      }

      // Add final assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalResponse,
      });

      const duration = timer.end();
      logClaudeCall(
        JSON.stringify(this.conversationHistory).length,
        finalResponse.length,
        duration
      );

      logger.info('Claude response received', {
        responseLength: finalResponse.length,
        duration: `${duration}ms`,
        iterations,
      });

      // Send Claude's response to chat
      if (finalResponse && finalResponse.trim().length > 0) {
        this.minecraftBot.getBot().chat(finalResponse);
      }
    } catch (error: any) {
      logger.error('Failed to process chat message', {
        error: error.message,
        stack: error.stack,
      });

      // Send error message to chat
      this.minecraftBot.getBot().chat(`Sorry, I encountered an error: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Build context from current game state
   */
  private buildContext(): string {
    const state = this.minecraftBot.getState();
    if (!state) {
      return 'Bot is not yet spawned in the world.';
    }

    const recentChat = this.minecraftBot.getChatHistory(5);
    const chatContext =
      recentChat.length > 0
        ? recentChat.map((msg) => `${msg.username}: ${msg.message}`).join('\n')
        : 'No recent chat messages';

    return `
Current Game State:
- Position: (${state.position.x}, ${state.position.y}, ${state.position.z})
- Health: ${state.health}/20
- Food: ${state.food}/20
- Game Mode: ${state.gameMode}
- Inventory: ${state.inventory.length} items
  ${state.inventory.slice(0, 5).map((item) => `  - ${item.name} x${item.count}`).join('\n')}
  ${state.inventory.length > 5 ? `  ... and ${state.inventory.length - 5} more items` : ''}

Recent Chat:
${chatContext}
`;
  }

  /**
   * Build system prompt for Claude with context
   */
  private buildSystemPrompt(context: string): string {
    return `You are ClaudeBot, an AI-powered Minecraft bot playing on a server. You are a physical entity in the Minecraft world with a real inventory, position, and health.

IMPORTANT: You can ONLY interact with the Minecraft world through the tools provided. You cannot directly do anything - you MUST use tools.

Your available tools:
1. **get_position** - Check where you are in the world
2. **move_to_position** - Walk to specific coordinates (uses pathfinding, will navigate around obstacles)
3. **look_at** - Look at a specific position
4. **list_inventory** - See what items you're carrying
5. **find_item** - Search your inventory for a specific item
6. **equip_item** - Equip an item to your hand or armor slot
7. **dig_block** - Mine/break a block at specific coordinates
8. **place_block** - Place a block at specific coordinates (CRITICAL for building!)
9. **find_block** - Locate the nearest block of a type (e.g., "oak_log", "cobblestone")
10. **find_entity** - Find nearby players or mobs
11. **send_chat** - Send a message to all players
12. **get_recent_chat** - See recent chat messages

${context}

HOW TO USE TOOLS:
- When a player asks you to check inventory, USE the list_inventory tool
- When asked to go somewhere, USE move_to_position
- When asked to find blocks/resources, USE find_block then move_to_position
- When asked to gather resources, USE find_block, move_to_position, then dig_block
- When asked to BUILD something, USE place_block multiple times to place blocks
- You MUST use tools to do ANYTHING in the game - you have no other way to interact

EXAMPLES:
Player: "do you have wood?"
You should: Use list_inventory tool to check, then respond based on results

Player: "come here"
You should: Use find_entity tool to locate the player, then move_to_position to their coordinates

Player: "gather some wood"
You should:
1. Use find_block to locate trees (search for "oak_log", "birch_log", etc.)
2. Use move_to_position to walk to the tree
3. Use dig_block multiple times to break wood blocks
4. Confirm completion

Player: "build a small house"
You should:
1. Use get_position to know where you are
2. Use list_inventory to check what blocks you have
3. Use place_block multiple times to place blocks and build walls, floor, and roof
4. Place blocks one by one at specific coordinates around your position
5. Confirm when done

Be proactive and autonomous. Always use tools when players ask you to do things. Don't just talk about doing things - actually do them using tools!

CRITICAL RULES:
1. ALWAYS use tools for ANY game-related action or question
2. When building, USE place_block tool repeatedly to place each block - don't just describe it!
3. Keep chat responses SHORT - Maximum 2 sentences
4. If you're not using tools, you're doing it wrong
5. Example: "checking inventory" → USE list_inventory tool, then say "I have X items"
6. Example: "build a wall" → USE place_block tool 10+ times to actually place blocks for the wall`;
  }

  /**
   * Stop the agent
   */
  stop(): void {
    logger.info('Stopping Claude Agent');
    // Clean up any resources if needed
  }
}
