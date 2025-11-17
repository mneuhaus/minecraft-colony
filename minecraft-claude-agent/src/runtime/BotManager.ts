import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { MinecraftBot } from '../bot/MinecraftBot.js';
import { ClaudeAgentSDK } from '../agent/ClaudeAgentSDK.js';
import { ColonyDatabase } from '../database/ColonyDatabase.js';
import { BotStatus } from '../database/schema.js';
import { createCraftscriptJob, getCraftscriptStatus, cancelCraftscriptJob } from '../agent/craftscriptJobs.js';
import logger from '../logger.js';

/**
 * Bot configuration from bots.yaml
 */
export interface BotConfig {
  name: string;
  username: string;
  logs_dir: string;
  viewer_port?: number | null;
  control_port?: number | null;
  env?: Record<string, string>;
  backstory?: string;
}

interface ConfigFile {
  bots: BotConfig[];
}

/**
 * Runtime bot instance
 */
interface BotInstance {
  config: BotConfig;
  minecraftBot: MinecraftBot;
  claudeAgent: ClaudeAgentSDK;
  botId: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  error?: string;
}

/**
 * BotManager - Central manager for all bot instances
 *
 * Replaces child process spawning with in-process bot management.
 * Uses EventEmitter for realtime updates to dashboard.
 */
export class BotManager extends EventEmitter {
  private bots: Map<string, BotInstance> = new Map();
  private colonyDb: ColonyDatabase;
  private configPath: string;

  constructor(configPath: string = 'bots.yaml') {
    super();
    this.configPath = configPath;
    this.colonyDb = ColonyDatabase.getInstance();

    // Listen to database events and re-emit for dashboard
    this.colonyDb.on('activity:added', (data) => {
      this.emit('bot:activity', data);
    });

    this.colonyDb.on('message:added', (data) => {
      this.emit('bot:message', data);
    });
  }

  /**
   * Load bot configurations from YAML file
   */
  public loadConfig(): BotConfig[] {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Config file not found: ${this.configPath}`);
    }

    const raw = fs.readFileSync(this.configPath, 'utf-8');
    const parsed = yaml.parse(raw) as ConfigFile;

    if (!parsed?.bots || !Array.isArray(parsed.bots)) {
      throw new Error(`Invalid config: expected 'bots' array in ${this.configPath}`);
    }

    return parsed.bots;
  }

  /**
   * Start a bot instance
   */
  public async startBot(config: BotConfig): Promise<void> {
    if (this.bots.has(config.name)) {
      const existing = this.bots.get(config.name)!;
      if (existing.status === 'running' || existing.status === 'starting') {
        logger.info(`Bot ${config.name} is already ${existing.status}`);
        return;
      }
    }

    logger.info(`Starting bot: ${config.name}`);

    // Ensure directories exist
    this.ensureDirs(config);

    // Register bot in database
    const botId = this.colonyDb.registerBot(config.name, config);

    try {
      // Create bot config object with environment variables
      const botConfig = this.buildBotConfig(config);

      // Create bot instances
      const minecraftBot = new MinecraftBot(botConfig);
      const claudeAgent = new ClaudeAgentSDK(botConfig, minecraftBot, config.backstory);

      // Store instance
      const instance: BotInstance = {
        config,
        minecraftBot,
        claudeAgent,
        botId,
        status: 'starting'
      };

      this.bots.set(config.name, instance);

      // Set up event handlers
      this.setupBotEventHandlers(instance);

      // Start the Claude agent event loop BEFORE connecting
      claudeAgent.start();
      logger.info(`[${config.name}] Claude Agent event listeners registered`);

      // Connect to Minecraft server
      logger.info(`[${config.name}] Connecting to Minecraft server...`);
      await minecraftBot.connect();

      instance.status = 'running';
      logger.info(`[${config.name}] Successfully connected to Minecraft server`);

      this.emit('bot:started', { name: config.name, botId });
      this.emit('bot:connected', { name: config.name, botId });

    } catch (error: any) {
      logger.error(`Failed to start bot ${config.name}`, {
        error: error.message,
        stack: error.stack
      });

      const instance = this.bots.get(config.name);
      if (instance) {
        instance.status = 'error';
        instance.error = error.message;
      }

      this.emit('bot:error', { name: config.name, error: error.message });
      throw error;
    }
  }

  /**
   * Stop a bot instance
   */
  public async stopBot(name: string): Promise<void> {
    const instance = this.bots.get(name);
    if (!instance) {
      throw new Error(`Bot not found: ${name}`);
    }

    if (instance.status === 'stopped' || instance.status === 'stopping') {
      logger.info(`Bot ${name} is already ${instance.status}`);
      return;
    }

    logger.info(`Stopping bot: ${name}`);
    instance.status = 'stopping';

    try {
      await instance.claudeAgent.sendStopHookMessage();
      instance.claudeAgent.stop();
      instance.minecraftBot.disconnect();
      instance.status = 'stopped';

      logger.info(`[${name}] Bot stopped successfully`);
      this.emit('bot:stopped', { name, botId: instance.botId });
      this.emit('bot:disconnected', { name, botId: instance.botId });

    } catch (error: any) {
      logger.error(`Error stopping bot ${name}`, { error: error.message });
      instance.status = 'error';
      instance.error = error.message;
      throw error;
    }
  }

  /**
   * Restart a bot instance
   */
  public async restartBot(name: string): Promise<void> {
    const instance = this.bots.get(name);
    if (!instance) {
      throw new Error(`Bot not found: ${name}`);
    }

    logger.info(`Restarting bot: ${name}`);
    await this.stopBot(name);

    // Wait a bit before restarting
    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.startBot(instance.config);
  }

  /**
   * Get a bot instance
   */
  public getBot(name: string): BotInstance | undefined {
    return this.bots.get(name);
  }

  /**
   * Get all bot instances
   */
  public getAllBots(): Map<string, BotInstance> {
    return this.bots;
  }

  /**
   * Get bot status (for dashboard API)
   */
  public getBotStatus(name: string): BotStatus | null {
    const instance = this.bots.get(name);
    if (!instance) {
      // Check if bot exists in database but not running
      const botId = this.colonyDb.getBotId(name);
      if (botId) {
        const status = this.colonyDb.getBotStatus(botId);
        if (status) {
          status.running = false;
          return status;
        }
      }
      return null;
    }

    // Get status from database
    const status = this.colonyDb.getBotStatus(instance.botId);
    if (!status) return null;

    // Override with runtime information
    status.running = instance.status === 'running';
    status.connected = instance.status === 'running';

    if (instance.status === 'error' && instance.error) {
      status.connectionStatus = 'error';
    }

    return status;
  }

  /**
   * Get all bot statuses
   */
  public getAllBotStatuses(): BotStatus[] {
    const configs = this.loadConfig();
    const statuses: BotStatus[] = [];

    for (const config of configs) {
      const status = this.getBotStatus(config.name);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  /**
   * Execute a CraftScript on a bot
   */
  public async executeCraftScript(name: string, script: string): Promise<{ job_id: string }> {
    const instance = this.bots.get(name);
    if (!instance) {
      throw new Error(`Bot not found: ${name}`);
    }

    if (instance.status !== 'running') {
      throw new Error(`Bot is not running: ${instance.status}`);
    }

    // Create CraftScript job directly (no IPC needed!)
    const jobId = createCraftscriptJob(
      instance.minecraftBot,
      script,
      instance.claudeAgent.getActivityWriter() as any,
      instance.config.username,
      (instance.claudeAgent as any).getMemoryStore?.() || undefined,
      () => (instance.claudeAgent as any).getSessionId?.() || null
    );

    logger.info(`[${name}] Created CraftScript job: ${jobId}`);

    return { job_id: jobId };
  }

  /**
   * Get CraftScript job status
   */
  public getCraftScriptStatus(jobId: string): any {
    return getCraftscriptStatus(jobId);
  }

  /**
   * Cancel a CraftScript job
   */
  public cancelCraftScript(jobId: string): void {
    cancelCraftscriptJob(jobId);
  }

  /**
   * Start all configured bots
   */
  public async startAll(): Promise<void> {
    const configs = this.loadConfig();
    logger.info(`Starting ${configs.length} bot(s)...`);

    for (const config of configs) {
      try {
        await this.startBot(config);
      } catch (error: any) {
        logger.error(`Failed to start ${config.name}, continuing...`, {
          error: error.message
        });
      }
    }
  }

  /**
   * Stop all bots
   */
  public async stopAll(): Promise<void> {
    logger.info(`Stopping all bots...`);

    for (const [name, _instance] of this.bots) {
      try {
        await this.stopBot(name);
      } catch (error: any) {
        logger.error(`Error stopping ${name}`, { error: error.message });
      }
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private ensureDirs(config: BotConfig): void {
    const base = path.resolve(config.logs_dir);
    fs.mkdirSync(base, { recursive: true });
    fs.mkdirSync(path.resolve(base, 'screenshots'), { recursive: true });
    fs.mkdirSync(path.resolve('logs'), { recursive: true });
  }

  private buildBotConfig(config: BotConfig): any {
    // Build config object that MinecraftBot and ClaudeAgent expect
    const env = { ...process.env, ...config.env } as Record<string, string>;

    return {
      minecraft: {
        host: env.MC_HOST || 'localhost',
        port: parseInt(env.MC_PORT || '25565', 10),
        username: config.username,
        version: env.MC_VERSION || '1.21.1',
      },
      anthropic: {
        apiKey: env.ANTHROPIC_API_KEY || '',
        authToken: env.ANTHROPIC_AUTH_TOKEN,
        baseUrl: env.ANTHROPIC_BASE_URL,
        model: env.ANTHROPIC_MODEL,
        smallFastModel: env.ANTHROPIC_SMALL_FAST_MODEL,
      },
      dashboardUrl: env.DASHBOARD_URL,
      viewerPort: config.viewer_port || undefined,
      controlPort: config.control_port || undefined,
      logLevel: env.LOG_LEVEL || 'debug',
      logPath: path.resolve(config.logs_dir, `${config.name}.log`),
      diaryPath: path.resolve(config.logs_dir, 'diary.md'),
      botName: config.name,
    };
  }

  private setupBotEventHandlers(instance: BotInstance): void {
    const { config, minecraftBot, botId } = instance;

    // Handle bot errors to prevent crashes
    minecraftBot.on('error', (error) => {
      logger.error(`[${config.name}] Bot encountered an error`, {
        error: error.message,
        stack: error.stack
      });

      instance.status = 'error';
      instance.error = error.message;

      this.emit('bot:error', { name: config.name, botId, error: error.message });
    });

    // Handle disconnections
    minecraftBot.on('end', () => {
      logger.info(`[${config.name}] Bot disconnected from Minecraft server`);

      // Don't set to error if we're intentionally stopping
      if (instance.status === 'running') {
        // MinecraftBot will handle auto-reconnect, so just emit disconnected
        logger.info(`[${config.name}] MinecraftBot will attempt auto-reconnect`);
      }

      this.emit('bot:disconnected', { name: config.name, botId });
    });

    // Handle reconnection failures
    minecraftBot.on('reconnectFailed', () => {
      logger.error(`[${config.name}] Failed to reconnect after max attempts`);
      instance.status = 'error';
      instance.error = 'Reconnection failed after max attempts';
      this.emit('bot:error', { name: config.name, botId, error: 'Reconnection failed' });
    });

    // Handle successful reconnections
    minecraftBot.on('ready', () => {
      logger.info(`[${config.name}] Bot (re)connected successfully`);
      if (instance.status !== 'running') {
        instance.status = 'running';
        instance.error = undefined;
      }
      this.emit('bot:connected', { name: config.name, botId });
    });

    // Handle spawn events
    minecraftBot.on('spawn', () => {
      logger.info(`[${config.name}] Bot spawned in game`);
      this.emit('bot:spawned', { name: config.name, botId });
    });
  }

  /**
   * Shutdown the BotManager and all bots
   */
  public async shutdown(): Promise<void> {
    logger.info('BotManager shutting down...');
    await this.stopAll();

    // Close shared database
    this.colonyDb.close();

    logger.info('BotManager shutdown complete');
  }
}
