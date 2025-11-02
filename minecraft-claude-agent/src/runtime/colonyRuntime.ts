#!/usr/bin/env ts-node
import { loadConfig, startBots, stopBots } from './botControl.js';
import { startDashboardServer } from './dashboardServer.js';

const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT || 4242);

async function main() {
  console.log('=== Minecraft Colony Runtime ===');

  const bots = loadConfig();
  if (!bots.length) {
    console.warn('No bots defined in bots.yaml. Nothing to start.');
  } else {
    console.log(`Starting ${bots.length} bot(s)...`);
    await startBots(bots);
  }

  console.log(`Starting dashboard on http://localhost:${DASHBOARD_PORT}`);
  startDashboardServer(DASHBOARD_PORT);

  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Stopping bots...`);
    try {
      stopBots(loadConfig());
    } catch (error) {
      console.error('Error stopping bots:', error);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Colony runtime failed to start:', error);
  process.exit(1);
});
