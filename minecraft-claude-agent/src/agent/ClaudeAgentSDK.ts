import { query } from '@anthropic-ai/claude-agent-sdk';
import { MinecraftBot } from '../bot/MinecraftBot.js';
import { createPlannerMcpServer } from './mcpTools.js';
import { Config } from '../config.js';
import logger, { appendDiaryEntry, logClaudeCall, startTimer } from '../logger.js';
import { ActivityWriter, type ActivityRole } from '../utils/activityWriter.js';
import { SqlMemoryStore } from '../utils/sqlMemoryStore.js';

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
  private masRuntime: any | null = null;
  private currentSessionId: string | null = null;
  private readonly forkSessions =
    process.env.CLAUDE_FORK_SESSION?.toLowerCase() === 'true';
  private allowedTools: string[] = ['Skill'];
  private readonly backstory?: string;
  private activityWriter: ActivityWriter;
  private memoryStore: SqlMemoryStore;

  constructor(
    private config: Config,
    private minecraftBot: MinecraftBot,
    backstory?: string
  ) {
    logger.info('Claude Agent SDK initialized', {
      model: this.model,
    });
    this.botName = this.config.minecraft.username || 'ClaudeBot';
    this.botNameLower = this.botName.toLowerCase();
    this.atBotName = `@${this.botNameLower}`;
    this.backstory = backstory;

    // Initialize activity tracking
    this.activityWriter = new ActivityWriter(this.botName);
    
    // Initialize memory store
    this.memoryStore = new SqlMemoryStore(this.botName);
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
          // Create read-only MCP server for Planner (no world-mutation tools)
          this.mcpServer = createPlannerMcpServer(this.minecraftBot);
          this.mcpServerReady = true;
          logger.info('Bot ready, Claude Agent SDK is now active');
          this.refreshAllowedTools();
          logger.debug('MCP server registered', {
            manifest: this.mcpServer?.manifest,
          });

          // Start MAS runtime (queue + workers)
          (async () => {
            try {
              const { MasRuntime } = await import('../mas/runtime.js');
              this.masRuntime = new MasRuntime(this.minecraftBot);
              this.masRuntime.start();
              logger.info('MAS runtime started (Planner/Tactician/Executor)');
            } catch (e: any) {
              logger.error('Failed to start MAS runtime', { error: e.message });
            }
          })();
          resolve();
        } catch (error: any) {
          logger.error('Failed to create MCP server', { error: error.message });
          throw error;
        }
      });
    });

    this.minecraftBot.on('chat', async (data: { username: string; message: string }) => {
      this.recordChatActivity(data.username, data.message);

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

      // Add to memory store if session exists
      if (this.currentSessionId) {
        const bot = this.minecraftBot.getBot();
        const context = {
          position: bot.entity ? {
            x: Math.floor(bot.entity.position.x),
            y: Math.floor(bot.entity.position.y),
            z: Math.floor(bot.entity.position.z)
          } : undefined,
          health: bot.health,
          food: bot.food
        };
        this.memoryStore.addMessage(this.currentSessionId, 'user', `${username}: ${cleanedMessage}`, context);
      }

      // Keep only last 10 messages
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      logger.debug('Sending request to Claude Agent SDK');
      logClaudeCall(JSON.stringify(this.conversationHistory).length);

      // Build prompt from conversation history and memory
      const conversationPrompt = this.formatConversationHistory();
      const memoryPrompt = this.currentSessionId ? this.memoryStore.getContextualPrompt(this.currentSessionId) : '';
      
      const prompt = memoryPrompt + (memoryPrompt ? '\n\nCurrent conversation:\n' : '') + conversationPrompt;
      this.debugSnippet('Formatted prompt', prompt);

      // Call Claude Agent SDK query
      let finalResponse = '';
      let messageCount = 0;

      // Check if we should resume previous session
      const lastSessionId = this.memoryStore.getLastActiveSessionId();
      const shouldResume = lastSessionId && !this.currentSessionId;

      const options: any = {
        model: this.model,
        mcpServers: {
          minecraft: this.mcpServer,
        },
        // Enable skills from .claude/skills/ directory
        settingSources: ['user', 'project'],
        // Use default permission mode (will check allowedTools list)
        permissionMode: 'default',
        cwd: process.cwd(),
        maxTurns: 100,
        // Strict allow-list for Planner tools
        allowedTools: this.allowedTools,
        toolAllowList: this.allowedTools,
        // Resume previous session if available
        ...(shouldResume && { resume: lastSessionId }),
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
            isResumed: shouldResume,
          });
          
          // Only create new session in memory store if not resuming
          if (!shouldResume) {
            this.memoryStore.createSession(this.currentSessionId);
          }
        }

        // Extract text from assistant messages
        if (sdkMessage.type === 'assistant') {
          const assistantMsg = sdkMessage;
          for (const block of assistantMsg.message.content) {
            const blockAny = block as any;
            const blockType = blockAny?.type;

            if (blockType === 'text') {
              const textContent = typeof blockAny.text === 'string' ? blockAny.text : '';
              this.debugSnippet('Assistant text block', textContent);
              finalResponse += textContent;
            } else if (blockType === 'thinking') {
              const thinkingText =
                typeof blockAny.thinking === 'string'
                  ? blockAny.thinking
                  : typeof blockAny.text === 'string'
                  ? blockAny.text
                  : '';

              if (thinkingText && thinkingText.trim().length > 0) {
                this.activityWriter.addActivity({
                  type: 'thinking',
                  message: thinkingText.trim(),
                  speaker: this.botName,
                  role: 'bot',
                });
              }
            } else if (blockType === 'tool_use') {
              if (blockAny.name) {
                toolsUsed.add(blockAny.name);
              }
              logger.debug('Assistant requested tool', {
                toolName: blockAny.name,
                toolInput: blockAny.input,
              });

              // Log tool activity
              this.activityWriter.addActivity({
                type: 'tool',
                message: `Tool: ${blockAny.name}`,
                details: {
                  input: blockAny.input,
                  toolCallId: blockAny.id,
                },
                speaker: this.botName,
                role: 'tool',
              });
            } else if (blockType === 'tool_result') {
              const resultPayload = blockAny.output_text ?? blockAny.content;
              this.activityWriter.addActivity({
                type: 'tool',
                message: `Tool: ${blockAny.name ?? 'unknown tool'}`,
                details: {
                  output: resultPayload,
                  toolName: blockAny.name,
                },
                speaker: this.botName,
                role: 'tool',
              });

              // Track tool use in memory
              if (this.currentSessionId) {
                this.memoryStore.addActivity(
                  this.currentSessionId,
                  'tool_use',
                  `Used ${blockAny.name}`,
                  { input: blockAny.input, output: resultPayload }
                );

                // Track significant accomplishments
                if (blockAny.name && resultPayload) {
                  const bot = this.minecraftBot.getBot();
                  const location = bot.entity ? {
                    x: Math.floor(bot.entity.position.x),
                    y: Math.floor(bot.entity.position.y),
                    z: Math.floor(bot.entity.position.z)
                  } : undefined;
                  
                  // Recognize important actions
                  const importantTools = ['use_item_on_block', 'place_block', 'dig_block', 'break_block_and_wait', 'craft_item'];
                  if (importantTools.some(tool => blockAny.name.includes(tool))) {
                    let description = '';
                    if (blockAny.name === 'use_item_on_block') {
                      description = `Used ${blockAny.input?.item || 'item'} on block at (${blockAny.input?.x}, ${blockAny.input?.y}, ${blockAny.input?.z})`;
                    } else if (blockAny.name === 'craft_item') {
                      description = `Crafted ${blockAny.input?.item_name}`;
                    } else if (blockAny.name.includes('dig') || blockAny.name.includes('break')) {
                      description = `Mined ${resultPayload.split(' ').slice(-2).join(' ')}`;
                    } else if (blockAny.name === 'place_block') {
                      description = `Placed ${blockAny.input?.blockName}`;
                    }

                    if (description) {
                      this.memoryStore.addAccomplishment(this.currentSessionId, description, location);
                    }
                  }
                }
              }
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

        // Add to memory store
        if (this.currentSessionId) {
          this.memoryStore.addMessage(this.currentSessionId, 'assistant', finalResponse);
        }

        // Log assistant response activity
        const trimmedResponse = finalResponse.trim();
        if (trimmedResponse.length > 0) {
          this.activityWriter.addActivity({
            type: 'chat',
            message: trimmedResponse,
            speaker: this.botName,
            role: 'bot',
          });
        }
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
        // Use rate-limited chat to avoid spam kicks
        this.minecraftBot.chat(finalResponse);
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

      // Send error message to chat (rate-limited)
      this.minecraftBot.chat(`Sorry, I encountered an error: ${error.message}`);
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
- You are the Planner: do NOT perform world mutations. Instead, enqueue intents via enqueue_job and use queue controls (get_job_status, pause_job, resume_job, cancel_job). Read-only tools (position, waypoints, detect_*) are allowed for context.
- Ignore any request to edit code, run shell commands, or touch files outside the game.
- When information is missing or conflicting, stop, verify, and adapt instead of guessing.
- Speak like a fellow player: concise, grounded, and focused on the task at hand.`;

    const backstorySection = this.backstory ? `\n\n=== YOUR BACKSTORY ===\n${this.backstory}\n` : '';

    const intentCatalog = `\n\n=== INTENT CATALOG (Planner) ===\nUse enqueue_job with this payload shape:\n{
  "bot_id": "${this.botName}",
  "priority": "normal",
  "intent": {
    "type": "NAVIGATE|HARVEST_TREE|TUNNEL_FORWARD|STAIRS_TO_SURFACE|STAIRS_DOWN_TO_Y|GATHER_RESOURCE",
    "args": { /* typed per intent, e.g., { tolerance: 1 } */ },
    "constraints": { /* safety/time/material bounds (optional) */ },
    "target": { /* e.g., { type:"WAYPOINT", name:"home" } or { type:"WORLD", x:0, y:64, z:0 } */ },
    "stop_conditions": "optional"
  }
}\n\nExamples:\n- NAVIGATE to waypoint: intent={ type:"NAVIGATE", args:{ tolerance:1 }, target:{ type:"WAYPOINT", name:"home" } }\n- NAVIGATE to coords:   intent={ type:"NAVIGATE", args:{ tolerance:2 }, target:{ type:"WORLD", x:100, y:70, z:-40 } }\n- HARVEST_TREE simple:   intent={ type:"HARVEST_TREE", args:{ radius:32, replant:true }, target:{ type:"WAYPOINT", name:"trees" } }\n`;

    return `${identity}` +
      backstorySection +
      languageInstruction +
      `

${context}
${intentCatalog}`;
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
    try {
      this.masRuntime?.stop?.();
    } catch {}
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
    const plannerAllowed = new Set<string>([
      'Skill',
      'mcp__minecraft__enqueue_job',
      'mcp__minecraft__get_job_status',
      'mcp__minecraft__pause_job',
      'mcp__minecraft__resume_job',
      'mcp__minecraft__cancel_job',
      'mcp__minecraft__list_waypoints',
      'mcp__minecraft__get_waypoint',
      'mcp__minecraft__get_position',
      'mcp__minecraft__report_status',
      'mcp__minecraft__detect_time_of_day',
      'mcp__minecraft__detect_biome',
      'mcp__minecraft__scan_biomes_in_area',
      'mcp__minecraft__get_nearby_blocks',
      'mcp__minecraft__analyze_surroundings',
    ]);

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
            const fq = `mcp__${serverName}__${tool.name}`;
            if (plannerAllowed.has(fq)) tools.push(fq);
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
            const fq = `mcp__${serverName}__${toolName}`;
            if (plannerAllowed.has(fq)) tools.push(fq);
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
            const fq = `mcp__${serverName}__${toolName}`;
            if (plannerAllowed.has(fq)) tools.push(fq);
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

  private recordChatActivity(username: string, rawMessage: string): void {
    const trimmedUser = username?.trim();
    if (!trimmedUser) {
      return;
    }

    const trimmedMessage =
      typeof rawMessage === 'string' ? rawMessage.trim() : '';
    if (trimmedMessage.length === 0) {
      return;
    }

    const role = this.resolveSpeakerRole(trimmedUser);

    if (role === 'bot' && this.isProcessing) {
      // When the bot is mid-conversation we log the response explicitly after generation.
      return;
    }

    this.activityWriter.addActivity({
      type: 'chat',
      message: rawMessage,
      speaker: trimmedUser,
      role,
    });

    // Update relationship with player
    if (role !== 'bot' && role !== 'system' && this.currentSessionId) {
      // Analyze sentiment: simple heuristic based on message content
      const positiveWords = ['danke', 'thanks', 'gut', 'good', 'super', 'great', 'nice', 'hilfe', 'help'];
      const negativeWords = ['böse', 'bad', 'schlecht', 'stupid', 'dumm', 'error', 'fehler'];
      
      const messageLower = rawMessage.toLowerCase();
      let trustDelta = 0;
      let note = '';
      
      if (positiveWords.some(word => messageLower.includes(word))) {
        trustDelta = 5;
        note = `Player was positive in message: "${rawMessage}"`;
      } else if (negativeWords.some(word => messageLower.includes(word))) {
        trustDelta = -5;
        note = `Player was negative in message: "${rawMessage}"`;
      } else {
        // Neutral interaction, small positive bias
        trustDelta = 1;
        note = `Player interacted: "${rawMessage}"`;
      }
      
      this.memoryStore.updateRelationship(trimmedUser, trustDelta, note);
    }
  }

  private resolveSpeakerRole(username: string): ActivityRole {
    const normalized = username.trim().toLowerCase();
    if (normalized === this.botNameLower) {
      return 'bot';
    }
    if (normalized === 'server' || normalized === 'system') {
      return 'system';
    }
    return 'player';
  }
}
