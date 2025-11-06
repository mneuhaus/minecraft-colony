#!/usr/bin/env ts-node

/**
 * Colony Runtime - Unified Bot Manager + Dashboard Server
 *
 * This replaces the old child-process spawning architecture with a single-process design:
 * - BotManager runs all bots as in-memory instances
 * - Dashboard Server uses BotManager directly (no IPC/HTTP fallbacks)
 * - ColonyDatabase provides single source of truth for all data
 */

import { BotManager } from './BotManager.js';
import { startDashboardServer } from './dashboardServer.js';
import fs from 'fs';
import path from 'path';

const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT || 4242);

async function main() {
  console.log('=== Minecraft Colony Runtime (Unified Architecture) ===');

  // Write PID file
  const pidFile = path.resolve(process.cwd(), 'colony-runtime.pid');
  try {
    fs.writeFileSync(pidFile, String(process.pid));
  } catch (error) {
    console.warn('Failed to write PID file:', error);
  }

  // Create BotManager instance
  const botManager = new BotManager('bots.yaml');

  // Start Dashboard Server
  console.log(`Starting dashboard on http://localhost:${DASHBOARD_PORT}`);
  const { server, wss } = startDashboardServer(botManager, DASHBOARD_PORT);

  // Start all configured bots
  try {
    await botManager.startAll();
  } catch (error) {
    console.error('Error starting bots:', error);
    // Continue even if some bots fail to start
  }

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down colony...`);

    try {
      // Stop all bots
      await botManager.shutdown();

      // Close WebSocket server
      wss.close();

      // Close HTTP server
      server.close();

      // Remove PID file
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }

      console.log('Colony shutdown complete.');
      process.exit(0);

    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log('\n' + '='.repeat(70));
  console.log('Colony Runtime is ready!');
  console.log(`Dashboard: http://localhost:${DASHBOARD_PORT}`);
  console.log(`WebSocket: ws://localhost:${DASHBOARD_PORT}/ws`);
  console.log('Press Ctrl+C to stop the colony.');
  console.log('='.repeat(70) + '\n');
}

main().catch((error) => {
  console.error('Colony runtime failed to start:', error);
  const pidFile = path.resolve(process.cwd(), 'colony-runtime.pid');
  try {
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
  } catch (_) {}
  process.exit(1);
});
