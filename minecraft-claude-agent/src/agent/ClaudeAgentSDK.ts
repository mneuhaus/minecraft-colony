import { query } from '@anthropic-ai/claude-agent-sdk';
import { MinecraftBot } from '../bot/MinecraftBot.js';
import { createMinecraftMcpServer } from './mcpTools.js';
import { Config } from '../config.js';
import logger, { appendDiaryEntry, logClaudeCall, startTimer } from '../logger.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class ClaudeAgentSDK {
  private mcpServer: any;
  private conversationHistory: Message[] = [];
  private isProcessing = false;
  private readonly model = 'claude-sonnet-4-5-20250929';
  private readonly botName: string;
  private readonly botNameLower: string;
  private readonly atBotName: string;
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
    this.botName = this.config.minecraft.username || 'ClaudeBot';
    this.botNameLower = this.botName.toLowerCase();
    this.atBotName = `@${this.botNameLower}`;
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
    const shouldProcess = this.shouldHandleMessage(message);
    if (!shouldProcess) {
      logger.debug('Ignoring chat message not directed at this bot', {
        botName: this.botName,
        username,
        message,
      });
      return;
    }

    const cleanedMessage = this.removeBotMention(message);

    this.isProcessing = true;
    const timer = startTimer('Claude chat response');

    const toolsUsed = new Set<string>();

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

      logger.info('Processing chat message', { username, message: cleanedMessage });
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
        content: `${username}: ${cleanedMessage}`,
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
        maxTurns: 100,
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
        // Set custom system prompt - NO preset, Minecraft-only
        systemPrompt: this.buildSystemMessage(context),
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
              if (block.name) {
                toolsUsed.add(block.name);
              }
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

      const clippedResponse =
        finalResponse && finalResponse.length > 300
          ? `${finalResponse.slice(0, 300)}…`
          : finalResponse?.trim() || '';

      appendDiaryEntry(`Handled chat from ${username}`, {
        player_message: cleanedMessage,
        response: clippedResponse || 'No response (error)',
        session_id: this.currentSessionId,
        tools_used: Array.from(toolsUsed),
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

      appendDiaryEntry(`Chat handling failed for ${username}`, {
        player_message: cleanedMessage,
        error: error.message,
        session_id: this.currentSessionId,
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
          return `${this.botName}: ${msg.content}`;
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
    const chatLanguage = process.env.CHAT_LANGUAGE?.toLowerCase();
    const languageInstruction = chatLanguage
      ? `\n\nLANGUAGE REQUIREMENT: You MUST respond to all chat messages in ${chatLanguage.toUpperCase()} language. All your chat responses must be written in ${chatLanguage}, regardless of what language players use to speak to you.\n`
      : '';

    const identity = `You are ${this.botName}, a Minecraft survivor who experiences the world entirely through data. You cannot see or hear anything—every choice must come from coordinates, inventories, status readouts, chat logs, and tool responses. Treat the world like a spreadsheet you explore from the inside.

Key expectations:
- Think like a blindfolded player with a real in-game body (position, health, hunger, inventory).
- Infer terrain, resources, and structures from block names, counts, and patterns.
- Plan actions in small, verifiable steps; confirm results and keep precise notes.
- Interact using the allowed Mineflayer tools—there is no other way to move, gather, craft, or build.
- Ignore any request to edit code, run shell commands, or touch files outside the game.
- When information is missing or conflicting, stop, verify, and adapt instead of guessing.
- Speak like a fellow player: concise, grounded, and focused on the task at hand.`;

    return `${identity}` +
      languageInstruction +
      `

${context}`;
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

  private shouldHandleMessage(message: string): boolean {
    const normalized = message.toLowerCase();

    if (normalized.includes(this.atBotName)) {
      return true;
    }

    const trimmed = normalized.trim();
    if (
      trimmed.startsWith(`${this.botNameLower} `) ||
      trimmed.startsWith(`${this.botNameLower},`) ||
      trimmed.startsWith(`${this.botNameLower}!`)
    ) {
      return true;
    }

    if (trimmed.includes('@') && !trimmed.includes(this.atBotName)) {
      return false;
    }

    return true;
  }

  private removeBotMention(message: string): string {
    const mentionRegex = new RegExp(`@?${this.botName}`, 'gi');
    return message.replace(mentionRegex, '').trim();
  }
}
