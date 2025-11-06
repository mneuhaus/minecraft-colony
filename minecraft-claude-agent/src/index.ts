// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import { config } from './config.js';
import { MinecraftBot } from './bot/MinecraftBot.js';
import { ClaudeAgentSDK } from './agent/ClaudeAgentSDK.js';
import { createCraftscriptJob, getCraftscriptStatus, cancelCraftscriptJob } from './agent/craftscriptJobs.js';
import logger from './logger.js';

/**
 * Main entry point for the Claude-powered Minecraft bot
 */
async function main() {
  logger.info('Starting Claude Minecraft Agent');

  // Load backstory from environment if provided
  const backstory = process.env.BOT_BACKSTORY;

  // Create instances
  const minecraftBot = new MinecraftBot(config);
  const claudeAgent = new ClaudeAgentSDK(config, minecraftBot, backstory);

  // Log control port for diagnostics
  const controlPort = process.env.CONTROL_PORT ? parseInt(process.env.CONTROL_PORT, 10) : undefined;
  logger.info('Startup diagnostics', { CONTROL_PORT: controlPort || 'unset' });

  // IPC control for CraftScript (dashboard → bot)
  if (typeof (process as any).send === 'function') {
    process.on('message', async (msg: any) => {
      try {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'craftscript:start') {
          const script = String(msg.script||'');
          const id = createCraftscriptJob(minecraftBot, script, claudeAgent.getActivityWriter() as any, config.minecraft.username);
          (process as any).send?.({ type:'craftscript:started', id: msg.id, job_id: id });
        } else if (msg.type === 'craftscript:status') {
          const st = getCraftscriptStatus(String(msg.job_id||''));
          (process as any).send?.({ type:'craftscript:status', id: msg.id, status: st||null });
        } else if (msg.type === 'craftscript:cancel') {
          cancelCraftscriptJob(String(msg.job_id||''));
          (process as any).send?.({ type:'craftscript:canceled', id: msg.id, ok: true });
        }
      } catch (e) {
        try { (process as any).send?.({ type:'craftscript:error', id: msg?.id, error: String((e as any)?.message||e) }); } catch {}
      }
    });
  }

  // Handle bot errors to prevent crashes
  minecraftBot.on('error', (error) => {
    logger.error('Bot encountered an error', {
      error: error.message,
      stack: error.stack
    });
    // Don't crash the process, just log the error
    // The bot's reconnection logic will handle recovery
  });

  // Handle shutdown gracefully
  const shutdown = () => {
    logger.info('Shutting down...');
    claudeAgent.stop();
    minecraftBot.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Start the Claude agent event loop BEFORE connecting so it can listen for events
    claudeAgent.start();
    logger.info('Claude Agent event listeners registered');

    // Connect to Minecraft server
    logger.info('Connecting to Minecraft server...');
    await minecraftBot.connect();
    logger.info('Successfully connected to Minecraft server');

    // Log successful startup
    logger.info('='.repeat(60));
    logger.info('Claude Minecraft Agent is ready!');
    logger.info('The bot will respond to chat messages and game events.');
    logger.info('Press Ctrl+C to stop the agent.');
    logger.info('='.repeat(60));
  } catch (error: any) {
    logger.error('Failed to start agent', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  logger.error('Fatal error in main()', { error: error.message, stack: error.stack });
  process.exit(1);
});
