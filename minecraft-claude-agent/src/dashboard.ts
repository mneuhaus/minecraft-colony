/**
 * Standalone Dashboard Server (deprecated)
 *
 * This file is kept for backward compatibility but is deprecated.
 * Use `bun run colony` to start the unified colony runtime instead.
 */

import { BotManager } from './runtime/BotManager.js';
import { startDashboardServer } from './runtime/dashboardServer.js';

const PORT = Number(process.env.DASHBOARD_PORT || 4242);

console.warn('Warning: This standalone dashboard is deprecated.');
console.warn('Use `bun run colony` to start the unified colony runtime instead.');

// Create a BotManager instance (but don't start bots automatically)
const botManager = new BotManager('bots.yaml');

startDashboardServer(botManager, PORT);

console.log(`Dashboard running on http://localhost:${PORT}`);
console.log('Note: Bots must be started manually via the API or dashboard UI.');
