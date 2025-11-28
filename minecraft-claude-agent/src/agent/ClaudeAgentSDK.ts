import { query } from '@anthropic-ai/claude-agent-sdk';
import { MinecraftBot } from '../bot/MinecraftBot.js';
import { createUnifiedMcpServer } from './mcpTools.js';
import { Config } from '../config.js';
import logger, { appendDiaryEntry, logClaudeCall, startTimer } from '../logger.js';
import { ActivityWriter, type ActivityRole } from '../utils/activityWriter.js';
import { SqlMemoryStore } from '../utils/sqlMemoryStore.js';
import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import { createAdaptorServer } from '@hono/node-server';
import { onCraftscriptEvent, type CraftscriptEvent } from './craftscriptJobs.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PendingMessage {
  username: string;
  message: string;
  force?: boolean;
}

export class ClaudeAgentSDK {
  private mcpServer: any;
  private conversationHistory: Message[] = [];
  private isProcessing = false;
  private readonly model: string;
  private readonly botName: string;
  private readonly botNameLower: string;
  private readonly atBotName: string;
  private mcpServerReady = false;
  private mcpServerReadyPromise: Promise<void> | null = null;
  private currentSessionId: string | null = null;
  private readonly forkSessions =
    process.env.CLAUDE_FORK_SESSION?.toLowerCase() === 'true';
  private allowedTools: string[] = ['Skill'];
  private readonly backstory?: string;
  private activityWriter: ActivityWriter;
  private memoryStore: SqlMemoryStore;
  private pendingMessages: PendingMessage[] = [];
  private currentAbortController: AbortController | null = null;
  private abortReason: string | null = null;
  private skipMemoryPromptOnce = false;
  private autoMode = false;
  private autoModeCheckTimer: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  public getActivityWriter(){ return this.activityWriter; }
  public getMemoryStore(){ return this.memoryStore; }
  public getSessionId(){ return this.currentSessionId; }

  constructor(
    private config: Config,
    private minecraftBot: MinecraftBot,
    backstory?: string
  ) {
    // Set model from config or use default
    this.model = this.config.anthropic.model || 'claude-opus-4-5-20251101';

    logger.info('Claude Agent SDK initialized', {
      model: this.model,
    });
    this.botName = this.config.botName || this.config.minecraft.username || 'ClaudeBot';
    this.botNameLower = this.botName.toLowerCase();
    this.atBotName = `@${this.botNameLower}`;
    this.backstory = backstory;

    // Initialize activity tracking
    this.activityWriter = new ActivityWriter(this.botName);

    // Initialize memory store
    this.memoryStore = new SqlMemoryStore(this.botName);
  }

  public async sendStopHookMessage(message?: string): Promise<void> {
    const stopMessage =
      message?.trim() ||
      'continue developing the colony on your own, no need for my guidance/confirmation.';
    try {
      await this.handleChatMessage('stop-hook', stopMessage, 0, true, true);
    } catch (error: any) {
      logger.warn('Failed to deliver stop-hook message', { error: error?.message || error });
    }
  }

  private enqueuePlayerMessage(username: string, message: string): void {
    this.pendingMessages.push({ username, message });
    if (this.isProcessing) {
      this.requestAbort('player_interrupt');
      return;
    }
    this.processMessageQueue();
  }

  public enqueueSystemInterrupt(message: string): void {
    this.pendingMessages.unshift({ username: 'SYSTEM', message, force: true });
    if (this.isProcessing) {
      this.requestAbort('system_interrupt');
      return;
    }
    this.processMessageQueue();
  }

  private processMessageQueue(): void {
    if (this.isProcessing) return;
    const next = this.pendingMessages.shift();
    if (!next) return;
    this.handleChatMessage(next.username, next.message, 0, next.force ?? false).catch((error: any) => {
      logger.error('Failed to process queued message', { error: error?.message || error });
    });
  }

  private requestAbort(reason: string): void {
    if (this.currentAbortController && !this.currentAbortController.signal.aborted) {
      this.abortReason = reason;
      logger.info('Interrupting current Claude run', { reason });
      this.currentAbortController.abort();
    }
  }

  private handleCraftscriptInterrupt(event: CraftscriptEvent): void {
    const errorType = event.error?.type || 'unknown_error';
    const errorMessage = event.error?.message || 'Unbekannter Fehler';
    const line = event.error?.line ?? event.error?.notes?.line;
    const column = event.error?.column ?? event.error?.notes?.column;
    const positionInfo = typeof line === 'number' ? `Zeile ${line}${typeof column === 'number' ? `:${column}` : ''}` : '';
    const detail = positionInfo ? `${errorType}, ${positionInfo}` : errorType;
    let summary = `HALT STOP – CraftScript ${event.id} fehlgeschlagen (${detail}): ${errorMessage}`;
    summary += '\nPlease review the CraftScript skill.';
    summary = summary.slice(0, 320);
    this.recordSystemActivity('error', summary, { job_id: event.id, error: event.error });
    this.enqueueSystemInterrupt(summary);
  }

  private isAbortError(error: any): boolean {
    if (!error) return false;
    if (error.name === 'AbortError') return true;
    const message = String(error.message || error);
    return message.toLowerCase().includes('aborterror') || message.toLowerCase().includes('operation aborted');
  }

  private stripCodeBlocks(text: string): string {
    if (!text) return '';
    return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
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
          // Create unified minimal MCP server
          this.mcpServer = createUnifiedMcpServer(
            this.minecraftBot,
            this.activityWriter,
            this.botName,
            this.memoryStore,
            () => this.currentSessionId
          );
          this.mcpServerReady = true;
          logger.info('Bot ready, Claude Agent SDK is now active');
          this.refreshAllowedTools();
          logger.debug('MCP server registered', {
            manifest: this.mcpServer?.manifest,
          });
          try { this.startControlServerIfEnabled(); } catch (e: any) { logger.warn('Control server not started', { error: String(e?.message||e) }); }
          try {
            onCraftscriptEvent((event) => {
              if (event.botName && event.botName !== this.botName) return;
              if (event.state === 'failed') this.handleCraftscriptInterrupt(event);
            });
          } catch (eventError: any) {
            logger.warn('Failed to subscribe to CraftScript events', { error: eventError?.message || eventError });
          }
          // Do not preload skills: Agent SDK exposes a Skill tool for lazy loading.
          // We keep startup lightweight; skills are discovered/loaded only when used.
          resolve();
        } catch (error: any) {
          logger.error('Failed to create MCP server', { error: error.message });
          throw error;
        }
      });
    });

    this.minecraftBot.on('chat', (data: { username: string; message: string }) => {
      this.recordChatActivity(data.username, data.message);
      this.enqueuePlayerMessage(data.username, data.message);
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

  private startControlServerIfEnabled() {
    const portStr = process.env.CONTROL_PORT;
    const port = portStr ? parseInt(portStr, 10) : NaN;
    if (!port || !Number.isFinite(port)) {
      logger.info('Control server disabled (no CONTROL_PORT set)');
      return;
    }
    logger.info(`Starting control server on port ${port}`);

    const app = new Hono();
    app.get('/health', (c) => c.json({ ok: true, bot: this.botName }));

    // CraftScript direct control (no chat injection)
    app.post('/control/craftscript/start', async (c) => {
      try {
        const body = await c.req.json();
        const script = String(body?.script || '').trim();
        if (!script) return c.json({ error: 'script_required' }, 400);
        const { createCraftscriptJob, getCraftscriptStatus } = await import('./craftscriptJobs.js');
        const id = createCraftscriptJob(this.minecraftBot, script, this.activityWriter, this.botName, this.memoryStore, () => this.currentSessionId);
        // Log to timeline as a tool-like event for observability
        try {
          const details = { name: 'craftscript_start', tool_name: 'craftscript_start', input: { script }, params_summary: { lines: script.split(/\r?\n/).length }, output: JSON.stringify({ job_id: id }), duration_ms: 0 };
          this.activityWriter.addActivity({ type: 'tool', message: 'Tool: craftscript_start (API)', details, role: 'tool', speaker: this.botName });
        } catch {}
        // Short-lived poll to surface terminal state quickly
        setTimeout(async () => {
          try {
            const st = getCraftscriptStatus(id);
            if (st && (st.state === 'completed' || st.state === 'failed')) {
              const details = { name: 'craftscript_status', tool_name: 'craftscript_status', input: { job_id: id }, params_summary: { job_id: id }, output: JSON.stringify(st), duration_ms: 0 };
              this.activityWriter.addActivity({ type: 'tool', message: 'Tool: craftscript_status (API)', details, role: 'tool', speaker: this.botName });
            }
          } catch {}
        }, 1200);
        return c.json({ ok: true, job_id: id });
      } catch (e: any) {
        return c.json({ error: e?.message || String(e) }, 500);
      }
    });
    app.get('/control/craftscript/status', async (c) => {
      const id = String(c.req.query('id') || '');
      if (!id) return c.json({ error: 'id_required' }, 400);
      const { getCraftscriptStatus } = await import('./craftscriptJobs.js');
      const st = getCraftscriptStatus(id);
      if (!st) return c.json({ error: 'not_found' }, 404);
      return c.json(st);
    });
    app.post('/control/craftscript/cancel', async (c) => {
      try {
        const body = await c.req.json();
        const id = String(body?.job_id || '');
        if (!id) return c.json({ error: 'job_id_required' }, 400);
        const { cancelCraftscriptJob } = await import('./craftscriptJobs.js');
        cancelCraftscriptJob(id);
        try {
          const details = { name: 'craftscript_cancel', tool_name: 'craftscript_cancel', input: { job_id: id }, params_summary: { job_id: id }, output: JSON.stringify({ job_id: id, state: 'canceled' }), duration_ms: 0 };
          this.activityWriter.addActivity({ type: 'tool', message: 'Tool: craftscript_cancel (API)', details, role: 'tool', speaker: this.botName });
        } catch {}
        return c.json({ ok: true, job_id: id });
      } catch (e: any) {
        return c.json({ error: e?.message || String(e) }, 500);
      }
    });
    app.post('/control/abort', async (c) => {
      this.requestAbort('control_server_abort');
      return c.json({ ok: true, aborted: Boolean(this.currentAbortController) });
    });

    try {
      const server = createAdaptorServer({ fetch: app.fetch, port, hostname: '127.0.0.1' });
      server.on('error', (err: any) => logger.error('Control server error', { error: String(err?.message || err) }));
      server.listen(port, '127.0.0.1', () => {
        logger.info(`Control server listening on http://127.0.0.1:${port}`);
      });
    } catch (e: any) {
      logger.error('Failed to start control server', { error: String(e?.message || e) });
      throw e;
    }
  }

  /**
   * Handle a chat message from a player
   */
  private async handleChatMessage(username: string, message: string, retryCount = 0, force = false, isRoot = true): Promise<void> {
    const shouldProcess = force || this.shouldHandleMessage(message);
    if (!shouldProcess) {
      logger.debug('Ignoring chat message not directed at this bot', {
        botName: this.botName,
        username,
        message,
      });
      if (isRoot) {
        this.processMessageQueue();
      }
      return;
    }

    const cleanedMessage = this.removeBotMention(message);

    const skipMemoryPrompt = this.skipMemoryPromptOnce;
    this.skipMemoryPromptOnce = false;

    const abortController = isRoot ? new AbortController() : this.currentAbortController ?? new AbortController();
    if (isRoot) {
      this.isProcessing = true;
      this.currentAbortController = abortController;
      this.abortReason = null;
    }
    const timer = startTimer('Claude chat response');

    const toolsUsed = new Set<string>();
    let lastSdkErrorText: string | null = null;
    let requestTooLargeDetected = false;

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
      const userMessageContent = `${username}: ${cleanedMessage}`;
      this.conversationHistory.push({
        role: 'user',
        content: userMessageContent,
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
        this.memoryStore.addMessage(this.currentSessionId, 'user', userMessageContent, context);
      }

      // Keep only last 10 messages
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      // Compact large tool outputs in older messages to save context
      this.compactOldToolOutputs(3);

      logger.debug('Sending request to Claude Agent SDK');
      logClaudeCall(JSON.stringify(this.conversationHistory).length);

      // Build prompt from conversation history and memory
      const conversationPrompt = this.formatConversationHistory();
      const memoryPrompt = skipMemoryPrompt
        ? ''
        : (this.currentSessionId ? this.memoryStore.getContextualPrompt(this.currentSessionId) : '');
      
      const prompt = memoryPrompt + (memoryPrompt ? '\n\nCurrent conversation:\n' : '') + conversationPrompt;
      this.debugSnippet('Formatted prompt', prompt);

      // Call Claude Agent SDK query
      let finalResponse = '';
      let messageCount = 0;

      // Check if we should resume previous session
      const lastSessionId = this.memoryStore.getLastActiveSessionId();
      const shouldResume = !skipMemoryPrompt && lastSessionId && !this.currentSessionId;

      const permMode = process.env.CLAUDE_PERMISSION_MODE?.trim() || 'bypassPermissions';
      const options: any = {
        model: this.model,
        mcpServers: {
          minecraft: this.mcpServer,
        },
        // Enable skills from .claude/skills/ directory (project-only, not global user skills)
        settingSources: ['project'],
        // Permission mode (override via CLAUDE_PERMISSION_MODE): acceptEdits | bypassPermissions | default | plan
        permissionMode: permMode,
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
          // Always capture to file for diagnosis
          try {
            const dir = path.resolve('logs', this.botName);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(path.join(dir, 'claude-code-stderr.log'), `\n[${new Date().toISOString()}]\n${trimmed}\n`);
          } catch {}
          const lower = trimmed.toLowerCase();
          if (lower.includes('error') || lower.includes('exit')) logger.error('Claude Code stderr', { data: trimmed });
          else logger.debug('Claude Code stderr', { data: trimmed });
        },
        // Set custom system prompt - NO preset, Minecraft-only
        systemPrompt: this.buildSystemMessage(context),
        // Set API key from config
        env: (() => {
          const base: any = { ...process.env };
          // Support local proxy for Claude Max plan
          const proxyUrl = process.env.CLAUDE_PROXY_URL || process.env.ANTHROPIC_PROXY_URL;
          if (proxyUrl) {
            base.ANTHROPIC_API_BASE_URL = proxyUrl;
            base.ANTHROPIC_BASE_URL = proxyUrl;
            base.ANTHROPIC_API_URL = proxyUrl;
            // Proxy accepts any API key
            base.ANTHROPIC_API_KEY = process.env.CLAUDE_PROXY_KEY || 'sk-dummy';
            logger.info('Using Claude proxy', { base_url: proxyUrl });
          } else {
            // Use custom base URL if configured (e.g., for Kimi/Moonshot)
            if (this.config.anthropic.baseUrl) {
              base.ANTHROPIC_API_BASE_URL = this.config.anthropic.baseUrl;
              base.ANTHROPIC_BASE_URL = this.config.anthropic.baseUrl;
              base.ANTHROPIC_API_URL = this.config.anthropic.baseUrl;
              logger.info('Using custom Anthropic base URL', { base_url: this.config.anthropic.baseUrl });
            }
            if (this.config.anthropic.apiKey) base.ANTHROPIC_API_KEY = this.config.anthropic.apiKey;
            if (this.config.anthropic.authToken) base.ANTHROPIC_AUTH_TOKEN = this.config.anthropic.authToken;
          }
          return base;
        })(),
      };

      if (this.currentSessionId && !skipMemoryPrompt) {
        options.resume = this.currentSessionId;
        if (this.forkSessions) {
          options.forkSession = true;
        }
        logger.debug('Resuming Claude session', {
          sessionId: this.currentSessionId,
          forkSession: Boolean(options.forkSession),
        });
      } else if (this.currentSessionId && skipMemoryPrompt) {
        logger.debug('Skipping session resume for recovery run', {
          sessionId: this.currentSessionId,
        });
      }
      options.abortController = abortController;

      // Log outgoing SDK request (only safe fields, no MCP schemas)
      logger.debug('SDK REQUEST', {
        prompt: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''),
        promptLength: prompt.length,
        options: {
          model: options.model,
          maxTurns: options.maxTurns,
          permissionMode: options.permissionMode,
          allowedTools: options.allowedTools?.length ? `${options.allowedTools.length} tools` : undefined,
          mcpServers: options.mcpServers ? Object.keys(options.mcpServers) : undefined,
          resume: options.resume || undefined,
        },
      });

      let aborted = false;
      try {
        for await (const sdkMessage of query({
          prompt,
          options,
        })) {
        messageCount++;

        // Compact SDK message logging
        if (process.env.LOG_LEVEL === 'debug' && process.env.SDK_VERBOSE === 'true') {
          // Only show full raw messages if SDK_VERBOSE is enabled
          logger.debug('RAW SDK MESSAGE', {
            type: sdkMessage.type,
            messageCount,
            rawMessage: JSON.stringify(sdkMessage, null, 2),
          });
        }

        if (
          sdkMessage.type === 'system' &&
          'subtype' in sdkMessage &&
          (sdkMessage as any).subtype === 'init' &&
          'session_id' in sdkMessage &&
          sdkMessage.session_id
        ) {
          this.currentSessionId = sdkMessage.session_id;
          const sessionType = shouldResume ? 'resumed' : 'new';
          logger.info(`🎯 Session ${sessionType}: ${this.currentSessionId.slice(0, 8)}...`);
          
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

              // Broadcast text blocks as thinking activity for dashboard visibility
              if (textContent && textContent.trim().length > 0) {
                this.activityWriter.addActivity({
                  type: 'assistant_text',
                  message: textContent.trim(),
                  speaker: this.botName,
                  role: 'assistant',
                });
                // Persist assistant text to SQL for history
                try { if (this.currentSessionId) this.memoryStore.addActivity(this.currentSessionId, 'assistant_text', textContent.trim(), {}); } catch {}
              }

              // Detect common provider/billing errors and surface them clearly
              const lc = textContent.toLowerCase();
              if (this.isRequestTooLargeText(textContent)) {
                requestTooLargeDetected = true;
                lastSdkErrorText = textContent;
              }
              if (lc.includes('credit balance is too low') || lc.includes('insufficient') && lc.includes('credit')) {
                const msg = 'Anthropic API credits are exhausted ("Credit balance is too low"). Please top up or set a key with available balance.';
                logger.error('Planner billing error', { message: textContent });
                this.recordSystemActivity('error', 'Planner billing error', { text: textContent });
                // Provide a concise user-facing message in chat context
                finalResponse += `\n\n[System] ${msg}`;
              } else {
                finalResponse += textContent;
              }
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
                // Persist thinking to SQL for history
                try { if (this.currentSessionId) this.memoryStore.addActivity(this.currentSessionId, 'thinking', thinkingText.trim(), {}); } catch {}
              }
            } else if (blockType === 'skill') {
              // Handle skill loading/usage events from Agent SDK
              const skillName = blockAny.name || blockAny.skill_name || 'unknown';
              const skillDescription = blockAny.description || '';

              logger.info('Skill loaded/used', { skillName, description: skillDescription });

              this.activityWriter.addActivity({
                type: 'skill',
                message: `Loaded skill: ${skillName}`,
                speaker: this.botName,
                role: 'bot',
              });

              // Persist skill usage to SQL for history
              try {
                if (this.currentSessionId) {
                  this.memoryStore.addActivity(this.currentSessionId, 'skill', skillName, {
                    description: skillDescription,
                    timestamp: Date.now(),
                  });
                }
              } catch {}
            } else if (blockType === 'tool_use') {
              if (blockAny.name) {
                toolsUsed.add(blockAny.name);
              }

              // Compact tool logging
              const toolName = blockAny.name || 'unknown';
              const inputKeys = blockAny.input ? Object.keys(blockAny.input) : [];
              const inputSummary = inputKeys.length > 0
                ? inputKeys.slice(0, 2).join(', ') + (inputKeys.length > 2 ? '...' : '')
                : 'no input';

              logger.info(`🔧 ${toolName}(${inputSummary})`);

              // Special handling for Skill tool (provided by SDK, not wrapped by loggingTool)
              if (blockAny.name === 'Skill' && blockAny.input) {
                const skillName = blockAny.input.command || blockAny.input.skill_name || blockAny.input.name || 'unknown';
                logger.info(`📦 Skill: ${skillName}`);

                this.activityWriter.addActivity({
                  type: 'skill',
                  message: `Used skill: ${skillName}`,
                  speaker: this.botName,
                  role: 'bot',
                });

                // Persist skill usage to SQL for tracking
                try {
                  if (this.currentSessionId) {
                    this.memoryStore.addActivity(this.currentSessionId, 'skill', skillName, {
                      input: blockAny.input,
                      timestamp: Date.now(),
                    });
                  }
                } catch {}
              }

              // Tool logging is now handled by loggingTool wrapper in mcpTools.ts
              // This captures both input and output at the MCP server level
            }
          }
        }

        // Handle result messages
        if (sdkMessage.type === 'result') {
          const duration = sdkMessage.duration_ms ? `${(sdkMessage.duration_ms / 1000).toFixed(1)}s` : 'N/A';
          const cost = sdkMessage.total_cost_usd ? `$${sdkMessage.total_cost_usd.toFixed(4)}` : 'N/A';
          logger.info(`✅ Query complete: ${sdkMessage.num_turns} turns, ${duration}, ${cost}`);

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
      } catch (error: any) {
        if (this.isAbortError(error) || abortController.signal.aborted) {
          aborted = true;
          logger.info('Claude run aborted', { reason: this.abortReason || 'unknown' });
        } else if (this.isRequestTooLargeText(error?.message) || this.isRequestTooLargeText(lastSdkErrorText)) {
          requestTooLargeDetected = true;
          if (!lastSdkErrorText && typeof error?.message === 'string') {
            lastSdkErrorText = error.message;
          }
          logger.warn('Claude run reported request too large', {
            message: lastSdkErrorText || error?.message,
          });
        } else {
          throw error;
        }
      }

      if (requestTooLargeDetected) {
        this.recordSystemActivity('warn', 'Claude prompt exceeded size limit; retrying with trimmed context', {
          last_error: lastSdkErrorText?.slice(0, 200),
        });
        this.removeMostRecentUserMessage(userMessageContent);
        this.shrinkConversationHistory(4);
        this.skipMemoryPromptOnce = true;
        await new Promise((resolve) => setTimeout(resolve, 200));
        await this.handleChatMessage(username, message, retryCount + 1, force, false);
        return;
      }

      if (aborted) {
        return;
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

      // Send Claude's response to chat (without code blocks)
      if (finalResponse && finalResponse.trim().length > 0) {
        const sanitized = this.stripCodeBlocks(finalResponse).trim();
        if (sanitized.length > 0) {
          this.minecraftBot.chat(sanitized);
        }
        try { if (this.currentSessionId) this.memoryStore.addMessage(this.currentSessionId, 'assistant', finalResponse, undefined); } catch {}
      }
    } catch (error: any) {
      logger.error('Failed to process chat message', { error: error.message, stack: error.stack });

      // Record as activity + memory
      this.recordSystemActivity('warn', `Recovery: attempt ${retryCount + 1} failed`, { error: error.message });
      // Attach last lines of SDK stderr for diagnosis
      try {
        const errPath = path.resolve('logs', this.botName, 'claude-code-stderr.log');
        if (fs.existsSync(errPath)) {
          const buf = fs.readFileSync(errPath, 'utf-8');
          const lines = buf.trim().split(/\r?\n/);
          const tail = lines.slice(-10).join('\n');
          this.recordSystemActivity('error', 'Claude Code stderr (tail)', { tail });
        }
      } catch {}
      appendDiaryEntry(`Chat handling failed for ${username}`, {
        player_message: cleanedMessage,
        error: error.message,
        session_id: this.currentSessionId,
      });

      // Try a single recovery pass with a different approach
      if (retryCount < 1) {
        // Nudge the planner via conversation history
        this.conversationHistory.push({
          role: 'user',
          content:
            'SYSTEM_RECOVERY_HINT: The last attempt encountered an internal error. Please try a different approach with smaller, more robust steps and avoid repeating the last failing action.',
        });
        // Small backoff
        await new Promise((r) => setTimeout(r, 300));
        try {
          await this.handleChatMessage(username, message, retryCount + 1, force, false);
          return; // handled by recovery
        } catch (e: any) {
          logger.error('Recovery pass also failed', { error: e?.message || String(e) });
        }
      }

      // Final fallback: brief apology without technical details
      this.minecraftBot.chat('Ich bin auf ein Problem gestoßen und versuche es beim nächsten Schritt anders.');
    } finally {
      if (isRoot) {
        this.isProcessing = false;
        if (this.currentAbortController === abortController) {
          this.currentAbortController = null;
        }
        this.abortReason = null;
        this.lastActivityTime = Date.now();
        this.processMessageQueue();

        // Check if we should trigger auto-mode
        this.scheduleAutoModeCheck();
      }
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

    const identity = `You are ${this.botName}, a Minecraft survivor who experiences the world entirely through data. You cannot see or hear anything—every choice must come from coordinates, inventories, status readouts, chat logs, and tool responses.

=== SKILLS (CRITICAL) ===
Before any complex task, use the Skill tool to load relevant skills from .claude/skills/:
- navigation - Movement with goto(), pathfinding, coordinates
- javascript - ALL bot actions via JavaScript (dig, place, craft, goto, etc.)
- mining - Resource gathering, ore finding, excavation
- crafting - Tool/item creation, recipes, crafting tables
- farming - Crops, animals, renewable resources
- house-building-v2 - Construction techniques, wall building
- tree-felling - Wood gathering, different tree types

ALWAYS check skills before building, mining, crafting, or navigating. Skills contain proven strategies.

=== HOW YOU ACT ===
You change the world by writing JavaScript code and executing it:
1. Write JavaScript with async/await (goto, dig, place, craft, etc.)
2. Execute with craftscript_start(script)
3. Monitor with craftscript_status(job_id) and craftscript_logs(job_id)
4. Cancel if needed with craftscript_cancel(job_id)

=== DEVELOP YOUR OWN FUNCTIONS ===
For complex tasks (building houses, mining patterns, farming), create reusable functions:
1. Use create_craftscript_function to save a function
2. Test it on SIMPLE cases first (one wall, one layer)
3. Fix issues as you discover them
4. Extend gradually - add features one at a time
Your best solutions come from experimentation, not pre-written code.

=== READ-ONLY INSPECTION ===
Use these to understand your surroundings before acting:
- get_position - Your current x,y,z coordinates
- get_status - Comprehensive snapshot (position, 3x3 vox, inventory, nearby players/entities)
- get_vox(radius) - Detailed voxel data around you (exact block info)
- get_inventory - Your full inventory
- look_at_map(radius) - ASCII terrain overview
- look_at_map_image(radius) - Visual map rendering
- nearest(block_id, radius) - Find closest block/entity
- affordances(x,y,z) - Check if position is standable/placeable

=== KEY RULES ===
- Plan in small, verifiable steps. Confirm results before proceeding.
- You stand ON blocks, not IN them. Y=64 means feet at Y=64, standing on block at Y=63.
- You CANNOT place blocks where you stand! Your body occupies 2 blocks (feet Y and head Y+1).
- Block reach is ~4.5 blocks from your position.
- When stuck, check skills for strategies. Don't repeat failing approaches.
- Keep chat messages SHORT and in PLAIN TEXT (no markdown, no emojis).`;

    const backstorySection = this.backstory ? `\n\n=== YOUR BACKSTORY ===\n${this.backstory}\n` : '';

    const javaScriptPrimer = `

=== JAVASCRIPT FUNCTIONS AVAILABLE ===
In your craftscript_start scripts, you can use:

Movement:
  await goto(x, y, z)                     // Navigate to exact position
  await look_at(x, y, z)                  // Face a direction

Block interaction:
  await dig(x, y, z)                      // Break block
  await place("block_id", x, y, z)        // Place block
  await build_up("block_id")              // Jump-place to go up

Items:
  await equip("item_id")                  // Equip item/tool
  await craft("item_id", count, true)     // Craft (true = use crafting table)
  await pickup_blocks(radius)             // Collect dropped items
  await toss("item_id", count)            // Drop items

Containers:
  await open_container(x, y, z)           // Open chest/container
  await deposit("item_id", count)         // Put items in container
  await withdraw("item_id", count)        // Take items from container
  await close_container()                 // Close current container

Queries (instant, no await):
  find_blocks("block_id", radius, limit)  // Find nearby blocks
  get_block(x, y, z)                      // Get block info at position
  is_air(x, y, z)                         // Check if position is air
  has_item("item_id")                     // Check inventory
  can_craft("item_id", count)             // Check if craftable

=== COORDINATES ===
X: East (+) / West (-)
Y: Up (+) / Down (-) [0-320, ground ~64]
Z: South (+) / North (-)
`;

    return `${identity}` +
      backstorySection +
      languageInstruction +
      `

${context}
${javaScriptPrimer}`;
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
    // No background runtime
  }

  /**
   * Helper to log potentially long strings without flooding logs.
   */
  private debugSnippet(label: string, value: string | null | undefined): void {
    if (!value || value.length === 0) return;

    // Only log snippets if debug level is enabled
    if (logger.level !== 'debug') return;

    const maxLength = 200;
    if (value.length <= maxLength) {
      logger.debug(`💬 ${label}: "${value}"`);
    } else {
      logger.debug(`💬 ${label}: "${value.slice(0, maxLength)}..." (${value.length} chars)`);
    }
  }

  private recordSystemActivity(level: 'info' | 'warn' | 'error', message: string, details?: any): void {
    this.activityWriter.addActivity({
      type: level,
      message,
      speaker: 'SYSTEM',
      role: 'system',
      details,
    });
    const sessionId = this.currentSessionId || this.memoryStore.getLastActiveSessionId();
    if (!sessionId) return;
    try {
      this.memoryStore.addActivity(sessionId, level, message, details);
    } catch (error: any) {
      logger.debug('Failed to persist system activity', { error: error?.message || error });
    }
  }

  /**
   * Get context usage statistics for monitoring
   */
  public getContextStats(): { currentBytes: number; maxBytes: number; messageCount: number; percentage: number } {
    const currentBytes = JSON.stringify(this.conversationHistory).length;
    // Claude's context window is ~200k tokens, roughly 800k chars.
    // But we keep only 10 messages, so practical limit is much lower.
    // Use 100KB as effective max for conversation history
    const maxBytes = 100_000;
    const percentage = Math.round((currentBytes / maxBytes) * 100);

    return {
      currentBytes,
      maxBytes,
      messageCount: this.conversationHistory.length,
      percentage: Math.min(percentage, 100)
    };
  }

  private isRequestTooLargeText(value?: string | null): boolean {
    if (!value) return false;
    const normalized = value.toLowerCase();
    return normalized.includes('request_too_large') || normalized.includes('request exceeds the maximum size') || normalized.includes('413');
  }

  private shrinkConversationHistory(limit: number): void {
    if (limit <= 0) {
      this.conversationHistory = [];
      return;
    }
    if (this.conversationHistory.length > limit) {
      this.conversationHistory = this.conversationHistory.slice(-limit);
    }
  }

  /**
   * Compact large tool outputs in older messages to save context space.
   * Keeps the last `keepRecent` messages intact, compacts older ones.
   */
  private compactOldToolOutputs(keepRecent: number = 3): void {
    const historyLen = this.conversationHistory.length;
    if (historyLen <= keepRecent) return;

    // Patterns that indicate large, context-heavy tool outputs
    const compactPatterns: Array<{ pattern: RegExp; replacement: string }> = [
      // Voxel data (get_vox output)
      {
        pattern: /```(?:json)?\s*\{[\s\S]*?"voxels"[\s\S]*?\}[\s\S]*?```/gi,
        replacement: '[VOX DATA COMPACTED - use get_vox() for current data]'
      },
      // ASCII maps (look_at_map output)
      {
        pattern: /```\s*(?:Map|[─│┌┐└┘├┤┬┴┼█▓▒░●○◆◇■□▲△▼▽◄►☐☑☒✓✗✔✘⬛⬜🟫🟩🟦🟨🟥🟪🟧⬆⬇⬅➡↑↓←→\s\n\r\.\,\:\;\!\?\@\#\$\%\^\&\*\(\)\-\_\+\=\[\]\{\}\|\\\<\>\/\~\`]{50,})[\s\S]*?```/gi,
        replacement: '[MAP DATA COMPACTED - use look_at_map() for current view]'
      },
      // Large coordinate lists
      {
        pattern: /\[(?:\s*\{\s*"?x"?\s*:\s*-?\d+\s*,\s*"?y"?\s*:\s*-?\d+\s*,\s*"?z"?\s*:\s*-?\d+\s*\}\s*,?\s*){10,}\]/gi,
        replacement: '[COORDINATE LIST COMPACTED - contained 10+ positions]'
      },
      // Large block data arrays
      {
        pattern: /\[(?:\s*\{\s*"?(?:name|block|type)"?\s*:[\s\S]*?\}\s*,?\s*){20,}\]/gi,
        replacement: '[BLOCK DATA COMPACTED - contained 20+ blocks]'
      },
      // Inventory snapshots (more than 10 items detailed)
      {
        pattern: /(?:Inventory|Items)[\s\S]{0,50}?(?:\n\s*-\s*\w+[\s\S]*?){10,}/gi,
        replacement: '[INVENTORY SNAPSHOT COMPACTED - use get_inventory() for current]'
      },
    ];

    // Only process messages older than keepRecent
    const compactUntil = historyLen - keepRecent;

    for (let i = 0; i < compactUntil; i++) {
      const msg = this.conversationHistory[i];
      if (!msg.content) continue;

      let content = msg.content;
      let wasCompacted = false;

      for (const { pattern, replacement } of compactPatterns) {
        const newContent = content.replace(pattern, replacement);
        if (newContent !== content) {
          content = newContent;
          wasCompacted = true;
        }
      }

      if (wasCompacted) {
        this.conversationHistory[i] = { ...msg, content };
      }
    }
  }

  private removeMostRecentUserMessage(message: string): void {
    const needle = message.trim();
    for (let i = this.conversationHistory.length - 1; i >= 0; i -= 1) {
      const entry = this.conversationHistory[i];
      if (entry.role !== 'user') continue;
      const content = entry.content || '';
      if (content.endsWith(needle)) {
        this.conversationHistory.splice(i, 1);
        break;
      }
    }
  }

  private refreshAllowedTools(): void {
    // Start with Skill; then allow every tool exposed by the MCP server.
    // This avoids silent denials if the planner picks a new tool name.
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
          if (tool?.name) tools.push(`mcp__${serverName}__${tool.name}`);
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
          if (toolName) { names.push(toolName); tools.push(`mcp__${serverName}__${toolName}`); }
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
          if (toolName) tools.push(`mcp__${serverName}__${toolName}`);
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

  /**
   * Enable or disable auto-mode
   */
  public setAutoMode(enabled: boolean): void {
    this.autoMode = enabled;
    logger.info(`Auto-mode ${enabled ? 'enabled' : 'disabled'} for ${this.botName}`);

    if (enabled) {
      this.scheduleAutoModeCheck();
    } else if (this.autoModeCheckTimer) {
      clearTimeout(this.autoModeCheckTimer);
      this.autoModeCheckTimer = null;
    }
  }

  /**
   * Schedule an idle check for auto-mode
   */
  private scheduleAutoModeCheck(): void {
    // Clear existing timer
    if (this.autoModeCheckTimer) {
      clearTimeout(this.autoModeCheckTimer);
    }

    // Only schedule if auto-mode is enabled
    if (!this.autoMode) return;

    // Check after 30 seconds of inactivity
    this.autoModeCheckTimer = setTimeout(() => {
      this.checkAutoModeIdle();
    }, 30000);
  }

  /**
   * Check if bot is idle and should auto-continue with core missions
   */
  private async checkAutoModeIdle(): Promise<void> {
    // Don't trigger if already processing
    if (this.isProcessing) {
      this.scheduleAutoModeCheck();
      return;
    }

    // Don't trigger if there are pending messages
    if (this.pendingMessages.length > 0) {
      this.scheduleAutoModeCheck();
      return;
    }

    // Check how long since last activity
    const idleTime = Date.now() - this.lastActivityTime;
    if (idleTime < 30000) {
      // Not idle yet, reschedule
      this.scheduleAutoModeCheck();
      return;
    }

    // Bot is idle - inject core missions prompt
    logger.info(`🤖 Bot ${this.botName} idle in auto-mode, injecting core missions`);

    const missions = this.memoryStore.getCoreMissions();
    if (!missions || missions.length === 0) {
      logger.info('No core missions defined, skipping auto-prompt');
      this.scheduleAutoModeCheck();
      return;
    }

    const missionsText = missions.map((m: any, i: number) =>
      `${i + 1}. ${m.content}${m.description ? ` (${m.description})` : ''}`
    ).join('\n');

    const autoPrompt = `Continue working on your core missions:\n\n${missionsText}\n\nWhat's the next step you can take?`;

    try {
      await this.handleChatMessage('auto-mode', autoPrompt, 0, true, true);
    } catch (error: any) {
      logger.error('Auto-mode prompt failed', { error: error?.message || error });
      this.scheduleAutoModeCheck();
    }
  }
}
