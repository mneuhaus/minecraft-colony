import mineflayer, { Bot } from 'mineflayer';
import { pathfinder, Movements } from 'mineflayer-pathfinder';
import { EventEmitter } from 'events';
import logger, { logChat, logHealth } from '../logger.js';
import { Config } from '../config.js';
import { writeStateFile } from '../utils/stateWriter.js';

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
  private stateUpdateInterval: NodeJS.Timeout | null = null;
  private readonly stateUpdateFrequency = 2000; // Update state every 2 seconds
  private messageCheckInterval: NodeJS.Timeout | null = null;
  private readonly messageCheckFrequency = 30000; // Check for bot messages every 30 seconds
  private chatQueue: string[] = [];
  private chatTimer: NodeJS.Timeout | null = null;
  private lastChatAt = 0;
  private readonly chatMinIntervalMs = parseInt(process.env.CHAT_MIN_INTERVAL_MS || '1200', 10);

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
      plugins: { pathfinder },
    });

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

      // Write initial state
      this.updateStateFile();

      // Start periodic state updates
      this.startStateUpdates();

      // Start periodic bot message checking
      this.startMessageChecking();

      // Emit ready event
      this.emit('ready', {
        position: this.bot!.entity?.position,
        health: this.bot!.health,
        food: this.bot!.food,
        gameMode: this.bot!.game.gameMode,
      });
    });

    // Handle kicked/disconnect/end events with bounded reconnects
    this.bot.on('kicked', (reason) => {
      logger.error('Bot was kicked', { reason });
      this.emit('kicked', { reason });
      this.handleDisconnect();
    });

    this.bot.on('end', (reason) => {
      logger.warn('Bot connection ended', { reason });
      this.emit('end', { reason });
      this.handleDisconnect();
    });

    this.bot.on('error', (error: any) => {
      logger.error('Bot error', { error: error.message, stack: error.stack });
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
  private updateStateFile(): void {
    const state = this.getState();
    if (state) {
      const botName = process.env.BOT_NAME || this.config.minecraft.username;
      const logsDir = process.env.LOGS_DIR || 'logs';
      writeStateFile(botName, logsDir, state);
    }
  }

  /**
   * Start periodic state file updates
   */
  private startStateUpdates(): void {
    // Clear any existing interval
    this.stopStateUpdates();

    // Create new interval for periodic updates
    this.stateUpdateInterval = setInterval(() => {
      this.updateStateFile();
    }, this.stateUpdateFrequency);

    logger.debug('Started periodic state updates', {
      frequency: `${this.stateUpdateFrequency}ms`
    });
  }

  /**
   * Stop periodic state file updates
   */
  private stopStateUpdates(): void {
    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval);
      this.stateUpdateInterval = null;
      logger.debug('Stopped periodic state updates');
    }
  }

  /**
   * Start periodic bot message checking
   */
  private startMessageChecking(): void {
    // Clear any existing interval
    this.stopMessageChecking();

    // Create new interval for checking bot messages
    this.messageCheckInterval = setInterval(() => {
      this.checkBotMessages();
    }, this.messageCheckFrequency);

    logger.debug('Started periodic bot message checking', {
      frequency: `${this.messageCheckFrequency}ms`
    });
  }

  /**
   * Stop periodic bot message checking
   */
  private stopMessageChecking(): void {
    if (this.messageCheckInterval) {
      clearInterval(this.messageCheckInterval);
      this.messageCheckInterval = null;
      logger.debug('Stopped periodic bot message checking');
    }
  }

  /**
   * Check for new bot messages and emit them as chat events
   */
  private async checkBotMessages(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');

      const botName = process.env.BOT_NAME || this.config.minecraft.username;
      const messagesDir = path.resolve(process.cwd(), 'messages');
      const inboxPath = path.join(messagesDir, `${botName}.json`);

      if (!fs.existsSync(inboxPath)) {
        return; // No messages
      }

      const existing = fs.readFileSync(inboxPath, 'utf-8');
      const messages: Array<{
        id: string;
        timestamp: string;
        sender: string;
        recipient: string;
        message: string;
        priority: 'low' | 'normal' | 'high';
        read: boolean;
      }> = JSON.parse(existing);

      // Find unread messages
      const unreadMessages = messages.filter(m => !m.read);

      if (unreadMessages.length > 0) {
        logger.info(`Found ${unreadMessages.length} unread bot message(s)`);

        // Emit each unread message as a chat event (as if it came from the sender bot)
        for (const msg of unreadMessages) {
          const syntheticMessage = `[Bot Message] ${msg.message}`;
          logger.debug('Emitting bot message as chat event', {
            sender: msg.sender,
            message: syntheticMessage
          });

          // Emit as chat event so Claude agent processes it
          this.emit('chat', {
            username: msg.sender,
            message: syntheticMessage,
            timestamp: new Date(msg.timestamp).getTime()
          });
        }

        // Mark messages as read
        const updatedMessages = messages.map(m =>
          unreadMessages.find(um => um.id === m.id) ? { ...m, read: true } : m
        );
        fs.writeFileSync(inboxPath, JSON.stringify(updatedMessages, null, 2));
      }
    } catch (error: any) {
      logger.error('Failed to check bot messages', { error: error.message });
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.stopStateUpdates();
    this.stopMessageChecking();
    // Stop chat queue
    if (this.chatTimer) {
      clearTimeout(this.chatTimer);
      this.chatTimer = null;
    }
    this.chatQueue = [];
    if (this.bot) {
      logger.info('Disconnecting from server');
      this.bot.quit();
      this.bot = null;
    }
  }

  /**
   * Rate-limited chat: ensures we don't get kicked for spam
   */
  chat(text: string): void {
    const trimmed = (text || '').toString().trim();
    if (!trimmed) return;
    // Clamp length to avoid multi-packet spam
    const clamped = trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed;
    this.chatQueue.push(clamped);
    this.drainChatQueue();
  }

  private drainChatQueue(): void {
    if (!this.bot) return;
    if (this.chatTimer) return; // already scheduled

    const now = Date.now();
    const delta = now - this.lastChatAt;
    const wait = delta >= this.chatMinIntervalMs ? 0 : this.chatMinIntervalMs - delta;

    this.chatTimer = setTimeout(() => {
      this.chatTimer = null;
      const next = this.chatQueue.shift();
      if (!next || !this.bot) return;
      try {
        this.bot.chat(next);
      } catch (e) {
        // ignore send errors
      }
      this.lastChatAt = Date.now();
      if (this.chatQueue.length > 0) {
        this.drainChatQueue();
      }
    }, wait);
  }
}
