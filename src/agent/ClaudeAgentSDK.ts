import { query } from '@anthropic-ai/claude-agent-sdk';
import { MinecraftBot } from '../bot/MinecraftBot.js';
import { createMinecraftMcpServer } from './mcpTools.js';
import { Config } from '../config.js';
import logger, { logClaudeCall, startTimer } from '../logger.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class ClaudeAgentSDK {
  private mcpServer: any;
  private conversationHistory: Message[] = [];
  private isProcessing = false;
  private readonly model = 'claude-sonnet-4-5-20250929';
  private mcpServerReady = false;
  private mcpServerReadyPromise: Promise<void> | null = null;
  private currentSessionId: string | null = null;
  private readonly forkSessions =
    process.env.CLAUDE_FORK_SESSION?.toLowerCase() === 'true';
  private allowedTools: string[] = ['Skill'];

  constructor(
    private config: Config,
    private minecraftBot: MinecraftBot
  ) {
    logger.info('Claude Agent SDK initialized', {
      model: this.model,
    });
  }

  /**
   * Start the event-driven agent loop
   */
  start(): void {
    logger.info('Starting Claude Agent SDK event loop');

    // Initialize MCP server with readiness tracking
    this.mcpServerReadyPromise = new Promise<void>((resolve) => {
      this.minecraftBot.on('ready', () => {
        try {
          // Create MCP server now that the bot is connected
          this.mcpServer = createMinecraftMcpServer(this.minecraftBot);
          this.mcpServerReady = true;
          logger.info('Bot ready, Claude Agent SDK is now active');
          this.refreshAllowedTools();
          logger.debug('MCP server registered', {
            manifest: this.mcpServer?.manifest,
          });
          resolve();
        } catch (error: any) {
          logger.error('Failed to create MCP server', { error: error.message });
          throw error;
        }
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
      // Wait for MCP server to be ready before processing
      if (!this.mcpServerReady && this.mcpServerReadyPromise) {
        logger.info('Waiting for MCP server to be ready...');
        try {
          await Promise.race([
            this.mcpServerReadyPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('MCP server initialization timeout')), 10000))
          ]);
        } catch (error) {
          logger.error('MCP server not ready, skipping message', { error });
          this.minecraftBot.getBot().chat('Sorry, I\'m still starting up. Please try again in a moment.');
          return;
        }
      }

      if (!this.mcpServer) {
        logger.error('MCP server not available');
        this.minecraftBot.getBot().chat('Sorry, I\'m not ready yet.');
        return;
      }

      logger.info('Processing chat message', { username, message });
      logger.debug('handleChatMessage invoked');
      logger.debug('Conversation history size before append', {
        messageCount: this.conversationHistory.length,
      });

      // Build context from current game state
      const context = this.buildContext();
      this.debugSnippet('Context snapshot', context);

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: `${username}: ${message}`,
      });

      // Keep only last 10 messages
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      logger.debug('Sending request to Claude Agent SDK');
      logClaudeCall(JSON.stringify(this.conversationHistory).length);

      // Build prompt from conversation history
      const prompt = this.formatConversationHistory();
      this.debugSnippet('Formatted prompt', prompt);

      // Call Claude Agent SDK query
      let finalResponse = '';
      let messageCount = 0;

      const options: any = {
        model: this.model,
        mcpServers: {
          minecraft: this.mcpServer,
        },
        // Enable skills from .claude/skills/ directory
        settingSources: ['user', 'project'],
        permissionMode: 'bypassPermissions',
        cwd: process.cwd(),
        maxTurns: 10,
        allowedTools: this.allowedTools,
        stderr: (data: string) => {
          const trimmed = data.trim();
          if (trimmed.length === 0) {
            return;
          }
          const lower = trimmed.toLowerCase();
          if (lower.includes('error')) {
            logger.error('Claude Code stderr', { data: trimmed });
          } else {
            logger.debug('Claude Code stderr', { data: trimmed });
          }
        },
        // Set custom system prompt with context
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: this.buildSystemMessage(context),
        },
        // Set API key from config
        env: {
          ...process.env,
          ...(this.config.anthropic.apiKey
            ? { ANTHROPIC_API_KEY: this.config.anthropic.apiKey }
            : {}),
          ...(this.config.anthropic.authToken
            ? { ANTHROPIC_AUTH_TOKEN: this.config.anthropic.authToken }
            : {}),
        },
      };

      if (this.currentSessionId) {
        options.resume = this.currentSessionId;
        if (this.forkSessions) {
          options.forkSession = true;
        }
        logger.debug('Resuming Claude session', {
          sessionId: this.currentSessionId,
          forkSession: Boolean(options.forkSession),
        });
      }

      for await (const sdkMessage of query({
        prompt,
        options,
      })) {
        messageCount++;
        logger.debug('Received SDK message', {
          type: sdkMessage.type,
          messageCount,
        });

        if (
          sdkMessage.type === 'system' &&
          'subtype' in sdkMessage &&
          (sdkMessage as any).subtype === 'init' &&
          'session_id' in sdkMessage &&
          sdkMessage.session_id
        ) {
          this.currentSessionId = sdkMessage.session_id;
          logger.info('Claude session initialized', {
            sessionId: this.currentSessionId,
            forkSession: this.forkSessions,
          });
        }

        // Extract text from assistant messages
        if (sdkMessage.type === 'assistant') {
          const assistantMsg = sdkMessage;
          for (const block of assistantMsg.message.content) {
            if (block.type === 'text') {
              this.debugSnippet('Assistant text block', block.text);
              finalResponse += block.text;
            } else if (block.type === 'tool_use') {
              logger.debug('Assistant requested tool', {
                toolName: block.name,
                toolInput: block.input,
              });
            }
          }
        }

        // Handle result messages
        if (sdkMessage.type === 'result') {
          logger.info('Claude Agent SDK query completed', {
            subtype: sdkMessage.subtype,
            numTurns: sdkMessage.num_turns,
            durationMs: sdkMessage.duration_ms,
            costUsd: sdkMessage.total_cost_usd,
          });

          if (sdkMessage.subtype === 'success') {
            // Success - response is in sdkMessage.result
            if (sdkMessage.result) {
              finalResponse = sdkMessage.result;
            }
          } else {
            // Error during execution
            const errors = 'errors' in sdkMessage ? sdkMessage.errors.join(', ') : 'Unknown error';
            logger.error('Claude Agent SDK query failed', {
              subtype: sdkMessage.subtype,
              errors,
            });
            finalResponse = `Sorry, I encountered an error: ${errors}`;
          }
        }
      }

      // Add final assistant response to history
      if (finalResponse) {
        this.conversationHistory.push({
          role: 'assistant',
          content: finalResponse,
        });
      }

      const duration = timer.end();
      logClaudeCall(
        JSON.stringify(this.conversationHistory).length,
        finalResponse.length,
        duration
      );
      this.debugSnippet('Final response', finalResponse);

      const loggerInfoProps: Record<string, unknown> = {
        responseLength: finalResponse.length,
        duration: `${duration}ms`,
      };
      if (finalResponse.length > 0) {
        loggerInfoProps.responsePreview = `${finalResponse.slice(0, 120)}${
          finalResponse.length > 120 ? '…' : ''
        }`;
      }

      logger.info('Claude response received', loggerInfoProps);

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
   * Convert conversation history into a textual prompt
   */
  private formatConversationHistory(): string {
    if (this.conversationHistory.length === 0) {
      return '';
    }

    return this.conversationHistory
      .map((msg) => {
        if (msg.role === 'assistant') {
          return `ClaudeBot: ${msg.content}`;
        }
        return msg.content;
      })
      .join('\n');
  }

  /**
   * Build system message with context
   * Note: Agent SDK will automatically inject skill content from .claude/skills/
   */
  private buildSystemMessage(context: string): string {
    return `You are ClaudeBot, an AI-powered Minecraft bot playing on a server. You are a physical entity in the Minecraft world with a real inventory, position, and health.

IMPORTANT: You can ONLY interact with the Minecraft world through the tools provided. You cannot directly do anything - you MUST use tools.

${context}

HOW TO USE TOOLS:
- When a player asks you to check inventory, USE the list_inventory tool
- When asked to go somewhere, USE move_to_position
- When asked to find blocks/resources, USE find_block then move_to_position
- When asked to gather resources, USE find_block, move_to_position, then dig_block
- When asked to BUILD something, USE place_block multiple times to place blocks
- You MUST use tools to do ANYTHING in the game - you have no other way to interact

TREE FELLING:
- You have specialized tree-felling tools: find_trees, get_tree_structure, check_reachable, etc.
- Skills loaded from .claude/skills/ will guide you on HOW to use these tools effectively
- Follow the skill strategies for complex tasks like gathering wood

CRITICAL RULES:
1. ALWAYS use tools for ANY game-related action or question
2. When building, USE place_block tool repeatedly to place each block - don't just describe it!
3. Keep chat responses SHORT - Maximum 2 sentences
4. If you're not using tools, you're doing it wrong
5. Example: "checking inventory" → USE list_inventory tool, then say "I have X items"
6. Example: "build a wall" → USE place_block tool 10+ times to actually place blocks for the wall

Be proactive and autonomous. Always use tools when players ask you to do things. Don't just talk about doing things - actually do them using tools!`;
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
   * Stop the agent
   */
  stop(): void {
    logger.info('Stopping Claude Agent SDK');
    // Clean up any resources if needed
  }

  /**
   * Helper to log potentially long strings without flooding logs.
   */
  private debugSnippet(label: string, value: string | null | undefined): void {
    if (!value || value.length === 0) {
      logger.debug(`${label}`, { length: 0, snippet: '' });
      return;
    }

    const maxLength = 400;
    const snippet = value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
    logger.debug(`${label}`, { length: value.length, snippet });
  }

  private refreshAllowedTools(): void {
    const tools: string[] = ['Skill'];

    try {
      const manifest = this.mcpServer?.manifest;
      logger.debug('Inspecting MCP manifest structure', {
        manifestType: manifest ? manifest.constructor?.name : 'none',
        manifestKeys: manifest ? Object.keys(manifest) : [],
        toolsType: manifest?.tools ? manifest.tools.constructor?.name : 'none',
      });
      if (manifest?.tools && Array.isArray(manifest.tools)) {
        const serverName = manifest.name || 'mcp';
        for (const tool of manifest.tools) {
          if (tool?.name) {
            tools.push(`mcp__${serverName}__${tool.name}`);
          }
        }
        logger.debug('MCP manifest tool entries (array)', {
          manifestName: manifest.name,
          toolCount: manifest.tools.length,
        });
      } else if (manifest?.tools instanceof Map) {
        const serverName = manifest.name || 'mcp';
        const names: string[] = [];
        for (const tool of manifest.tools.values()) {
          const toolName = tool?.name;
          if (toolName) {
            names.push(toolName);
            tools.push(`mcp__${serverName}__${toolName}`);
          }
        }
        logger.debug('MCP manifest tool entries (map)', {
          manifestName: manifest.name,
          toolNames: names,
        });
      } else if (
        manifest?.tools &&
        typeof manifest.tools === 'object' &&
        manifest.tools !== null
      ) {
        const serverName = manifest.name || 'mcp';
        for (const [key, tool] of Object.entries<any>(manifest.tools)) {
          const toolName = tool?.name || key;
          if (toolName) {
            tools.push(`mcp__${serverName}__${toolName}`);
          }
        }
        logger.debug('MCP manifest tool entries (object)', {
          manifestName: manifest.name,
          toolKeys: Object.keys(manifest.tools),
        });
      }
    } catch (error: any) {
      logger.warn('Failed to derive MCP tool names for allowedTools', {
        error: error.message,
      });
    }

    this.allowedTools = tools;
    logger.debug('Allowed tools configured', { allowedTools: this.allowedTools });
  }
}
