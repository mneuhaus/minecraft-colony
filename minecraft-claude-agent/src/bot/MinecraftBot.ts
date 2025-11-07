import mineflayer, { Bot } from 'mineflayer';
import { pathfinder, Movements } from 'mineflayer-pathfinder';
import { EventEmitter } from 'events';
import logger, { logChat, logHealth } from '../logger.js';
import { Config } from '../config.js';
// Removed JSON state writer; status is derived from SQL via the agent

let prismarineViewer: { mineflayer: (bot: Bot, options: { port: number; firstPerson: boolean }) => void } | null = null;

export interface BotEventData {
  type: string;
  data: any;
  timestamp: number;
}

/**
 * Wrapper class for mineflayer bot with event handling and helper methods
 */
export class MinecraftBot extends EventEmitter {
  private bot: Bot | null = null;
  private chatHistory: Array<{ username: string; message: string; timestamp: number }> = [];
  private readonly maxChatHistory = 50;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // ms
  private viewerPort = parseInt(process.env.VIEWER_PORT || '3000', 10);
  // Legacy JSON timers removed
  // private stateUpdateInterval: NodeJS.Timeout | null = null;
  // private readonly stateUpdateFrequency = 0;
  // private messageCheckInterval: NodeJS.Timeout | null = null;
  // private readonly messageCheckFrequency = 0;

  // Chat rate limiting
  private chatQueue: string[] = [];
  private chatTimer: NodeJS.Timeout | null = null;
  private lastChatAt = 0;
  private readonly chatCooldownMs = parseInt(process.env.CHAT_COOLDOWN_MS || '1500', 10);
  private readonly chatMaxLen = parseInt(process.env.CHAT_MAX_LEN || '240', 10);
  private recentChatSet: Array<{ text: string; ts: number }> = [];

  constructor(private config: Config) {
    super();
  }

  /**
   * Connect to the Minecraft server
   */
  async connect(): Promise<void> {
    logger.info('Connecting to Minecraft server', {
      host: this.config.minecraft.host,
      port: this.config.minecraft.port,
      username: this.config.minecraft.username,
    });

    this.bot = mineflayer.createBot({
      host: this.config.minecraft.host,
      port: this.config.minecraft.port,
      username: this.config.minecraft.username,
      version: false as any, // Auto-detect server version
    });

    // Guard against a Mineflayer edge-case where removeAllListeners can throw
    // in certain plugin callbacks (observed in digging.js on death). Keep the
    // process stable by binding the method and swallowing bad invocations.
    try {
      const bound = (this.bot as any).removeAllListeners?.bind(this.bot);
      if (bound) {
        (this.bot as any).removeAllListeners = (...args: any[]) => {
          try { return bound(...args); }
          catch (e: any) { logger.warn('removeAllListeners guard', { error: e?.message || String(e) }); return this.bot; }
        };
      }
    } catch {}

    // Ensure pathfinder plugin is loaded
    try {
      (this.bot as any).loadPlugin(pathfinder as any);
    } catch (e: any) {
      logger.warn('Failed to load pathfinder plugin', { error: e?.message || String(e) });
    }

    this.setupEventHandlers();

    // Wait for spawn
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 30 seconds'));
      }, 30000);

      this.bot!.once('spawn', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.bot!.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Set up all event handlers for the bot
   */
  private setupEventHandlers(): void {
    if (!this.bot) return;

    // Spawn event - bot successfully joined the server
    this.bot.once('spawn', async () => {
      logger.info('Bot spawned successfully', {
        username: this.bot!.username,
        position: this.bot!.entity?.position,
        gameMode: this.bot!.game.gameMode,
      });

      // Set up pathfinder movements
      const defaultMove = new Movements(this.bot!);
      this.bot!.pathfinder.setMovements(defaultMove);

      // Start the 3D viewer
      void this.startViewer();

      // Don't chat here - bot client might not be ready yet
      this.reconnectAttempts = 0;

      // JSON state/message files removed; relying on SQL via agent loop

      // Emit ready event
      this.emit('ready', {
        position: this.bot!.entity?.position,
        health: this.bot!.health,
        food: this.bot!.food,
        gameMode: this.bot!.game.gameMode,
      });
    });

    // Chat event - someone sent a message
    this.bot.on('chat', (username, message) => {
      if (username === this.bot!.username) return; // Ignore own messages

      logChat(username, message);

      // Add to chat history
      this.chatHistory.push({
        username,
        message,
        timestamp: Date.now(),
      });

      // Trim history if too long
      if (this.chatHistory.length > this.maxChatHistory) {
        this.chatHistory.shift();
      }

      // Emit chat event for Claude agent
      this.emit('chat', { username, message, timestamp: Date.now() });
    });

    // Health and food updates
    this.bot.on('health', () => {
      logHealth(this.bot!.health, this.bot!.food);

      // Update state file
      this.updateStateFile();

      // Emit health event if critically low
      if (this.bot!.health < 10) {
        this.emit('lowHealth', { health: this.bot!.health, food: this.bot!.food });
      }
    });

    // Inventory updates - update state when items collected/dropped
    this.bot.on('playerCollect', () => {
      this.updateStateFile();
    });

    // Entity hurt - bot took damage
    this.bot.on('entityHurt', (entity) => {
      if (entity === this.bot!.entity) {
        logger.warn('Bot took damage', {
          health: this.bot!.health,
          position: this.bot!.entity?.position,
        });
        this.emit('damaged', { health: this.bot!.health });
      }
    });

    // Player joined
    this.bot.on('playerJoined', (player) => {
      logger.info('Player joined', { username: player.username });
      this.emit('playerJoined', { username: player.username });
    });

    // Player left
    this.bot.on('playerLeft', (player) => {
      logger.info('Player left', { username: player.username });
      this.emit('playerLeft', { username: player.username });
    });

    // Error handling
    this.bot.on('error', (error) => {
      logger.error('Bot error', { error: error.message, stack: error.stack });
      this.emit('error', error);
    });

    // Kicked from server
    this.bot.on('kicked', (reason) => {
      logger.error('Bot was kicked', { reason });
      this.emit('kicked', { reason });
      this.handleDisconnect();
    });

    // End - disconnected
    this.bot.on('end', () => {
      logger.warn('Bot disconnected from server');
      this.emit('disconnected');
      this.handleDisconnect();
    });

    // Death
    this.bot.on('death', () => {
      logger.warn('Bot died', {
        position: this.bot!.entity?.position,
        killedBy: 'unknown', // mineflayer doesn't provide death reason easily
      });
      this.emit('death');
    });

    // Respawn
    this.bot.on('respawn', () => {
      logger.info('Bot respawned');
      this.emit('respawn');
    });
  }

  /**
   * Rate-limited chat wrapper to prevent spam kicks
   * Splits long messages, queues and sends with cooldown spacing.
   */
  chat(text: string): void {
    if (!text || typeof text !== 'string') return;
    // Split by newlines and chunk to max length
    const chunks: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      let l = line.trim();
      while (l.length > this.chatMaxLen) {
        chunks.push(l.slice(0, this.chatMaxLen));
        l = l.slice(this.chatMaxLen);
      }
      if (l.length > 0) chunks.push(l);
    }

    // De-dupe against recent messages (5s window)
    const now = Date.now();
    this.recentChatSet = this.recentChatSet.filter((m) => now - m.ts < 5000);
    for (const c of chunks) {
      if (this.recentChatSet.find((m) => m.text === c)) continue; // skip duplicate burst
      this.chatQueue.push(c);
      this.recentChatSet.push({ text: c, ts: now });
    }
    this.processChatQueue();
  }

  private processChatQueue(): void {
    if (this.chatTimer || this.chatQueue.length === 0) return;
    const sendNext = () => {
      if (!this.bot || this.chatQueue.length === 0) {
        this.chatTimer = null;
        return;
      }
      const delay = Math.max(0, this.lastChatAt + this.chatCooldownMs - Date.now());
      this.chatTimer = setTimeout(() => {
        const msg = this.chatQueue.shift()!;
        try {
          this.bot!.chat(msg);
          this.lastChatAt = Date.now();
        } catch (e: any) {
          logger.warn('chat() send failed, dropping message', { error: e?.message || String(e) });
        }
        this.chatTimer = null;
        if (this.chatQueue.length > 0) {
          this.processChatQueue();
        }
      }, delay);
    };
    sendNext();
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private handleDisconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, {
      delay: `${this.reconnectDelay}ms`,
    });

    setTimeout(() => {
      this.connect().catch((error) => {
        logger.error('Reconnection failed', { error: error.message });
      });
    }, this.reconnectDelay);
  }

  /**
   * Start the prismarine-viewer 3D web interface
   */
  private async startViewer(): Promise<void> {
    if (!this.bot) return;
    if (process.env.DISABLE_VIEWER?.toLowerCase() === 'true') {
      logger.info('Prismarine viewer disabled via DISABLE_VIEWER');
      return;
    }

    try {
      if (!prismarineViewer) {
        prismarineViewer = await import('prismarine-viewer');
      }
      prismarineViewer.mineflayer(this.bot, { port: this.viewerPort, firstPerson: true });
      logger.info(`Prismarine viewer started at http://localhost:${this.viewerPort}`);
      this.emit('viewerStarted', { port: this.viewerPort, url: `http://localhost:${this.viewerPort}` });
    } catch (error: any) {
      logger.error('Failed to start prismarine viewer', { error: error.message });
    }
  }

  /**
   * Get the viewer URL
   */
  getViewerUrl(): string {
    return `http://localhost:${this.viewerPort}`;
  }

  /**
   * Get the current bot instance
   */
  getBot(): Bot {
    if (!this.bot) {
      throw new Error('Bot is not connected');
    }
    return this.bot;
  }

  /**
   * Get recent chat history
   */
  getChatHistory(count: number = 10): Array<{ username: string; message: string; timestamp: number }> {
    return this.chatHistory.slice(-count);
  }

  /**
   * Get current bot state for context
   */
  getState() {
    if (!this.bot || !this.bot.entity) {
      return null;
    }

    return {
      position: {
        x: Math.floor(this.bot.entity.position.x),
        y: Math.floor(this.bot.entity.position.y),
        z: Math.floor(this.bot.entity.position.z),
      },
      health: this.bot.health,
      food: this.bot.food,
      gameMode: this.bot.game.gameMode,
      inventory: this.bot.inventory.items().map((item) => ({
        name: item.name,
        count: item.count,
      })),
    };
  }

  /**
   * Write current state to JSON file for dashboard
   */
  private updateStateFile(): void { /* removed */ }

  /**
   * Start periodic state file updates
   */
  // private startStateUpdates(): void { /* removed */ }

  /**
   * Stop periodic state file updates
   */
  // private stopStateUpdates(): void { /* removed */ }

  /**
   * Start periodic bot message checking
   */
  // private startMessageChecking(): void { /* removed */ }

  /**
   * Stop periodic bot message checking
   */
  // private stopMessageChecking(): void { /* removed */ }

  /**
   * Check for new bot messages and emit them as chat events
   */
  // private async checkBotMessages(): Promise<void> { /* removed */ }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    // this.stopStateUpdates();
    // this.stopMessageChecking();
    if (this.bot) {
      logger.info('Disconnecting from server');
      this.bot.quit();
      this.bot = null;
    }
  }
}
