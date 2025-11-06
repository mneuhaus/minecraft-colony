/**
 * Dashboard Server - Simplified with BotManager Integration
 *
 * This replaces the old dashboard server with a much simpler version:
 * - Uses BotManager for direct bot control (no IPC/spawn)
 * - Uses ColonyDatabase for all data access (no duplicate SQLite opens)
 * - No /ingest WebSocket (bots emit events via BotManager EventEmitter)
 * - Direct method calls for CraftScript (no fallback complexity)
 */

import { Hono } from 'hono';
import { createAdaptorServer } from '@hono/node-server';
import { cors } from 'hono/cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mcAssets from 'minecraft-assets';
import WebSocket, { WebSocketServer } from 'ws';
import { BotManager } from './BotManager.js';
import { ColonyDatabase } from '../database/ColonyDatabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MINECRAFT_VERSION = process.env.MINECRAFT_VERSION || '1.20';
const assets: any = mcAssets(MINECRAFT_VERSION);

// Build timeline history from shared database (replaces buildHistoryFromActivity)
function buildHistoryFromDatabase(botId: number, limit: number, beforeTs: number): any[] {
  const colonyDb = ColonyDatabase.getInstance();
  const db = colonyDb.getDb();
  const messages: any[] = [];

  try {
    // Get messages (chat)
    const rowsMsg = db.prepare(`
      SELECT role, content, timestamp
      FROM messages
      WHERE bot_id = ? AND timestamp < ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(botId, Math.floor(beforeTs / 1000), limit);

    for (const r of rowsMsg) {
      const row = r as any;
      const ts = (Number(row.timestamp) || 0) * 1000;
      const dir = String(row.role) === 'user' ? 'in' : 'out';
      const from = dir === 'in' ? 'player' : `bot_${botId}`;

      messages.push({
        id: `chat-${ts}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'chat',
        bot_id: botId,
        ts,
        payload: {
          from,
          text: String(row.content || ''),
          channel: 'chat',
          direction: dir
        }
      });
    }

    // Get activities (thinking/tool/system)
    const rowsAct = db.prepare(`
      SELECT type, description, timestamp, data
      FROM activities
      WHERE bot_id = ? AND timestamp < ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(botId, Math.floor(beforeTs / 1000), limit);

    for (const a of rowsAct) {
      const activity = a as any;
      const ts = (Number(activity.timestamp) || 0) * 1000;
      const t = String(activity.type || '').toLowerCase();
      let data: any = {};

      try {
        data = activity.data ? JSON.parse(String(activity.data)) : {};
      } catch (e) {
        console.warn(`Failed to parse activity data for bot ${botId}:`, e);
      }

      if (t === 'thinking') {
        messages.push({
          id: `think-${ts}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'chat',
          bot_id: botId,
          ts,
          payload: {
            from: 'Planner',
            text: String(activity.description || ''),
            channel: 'system',
            direction: 'out',
            kind: 'thinking'
          }
        });
      } else if (t === 'tool' || t === 'tool_use') {
        messages.push({
          id: `tool-${ts}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'tool',
          bot_id: botId,
          ts,
          payload: {
            tool_name: data?.name || 'tool',
            params_summary: data || {},
            output: data?.output,
            input: data?.input,
            duration_ms: data?.duration_ms,
            ok: true
          }
        });
      } else if (t === 'error' || t === 'warn' || t === 'info') {
        messages.push({
          id: `sys-${ts}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'system',
          bot_id: botId,
          ts,
          payload: {
            level: t === 'warn' ? 'warn' : t,
            message: String(activity.description || '')
          }
        });
      } else if (t === 'skill') {
        messages.push({
          id: `skill-${ts}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'skill',
          bot_id: botId,
          ts,
          payload: {
            name: activity.description,
            description: data?.description || ''
          }
        });
      }
    }

    messages.sort((a, b) => a.ts - b.ts);
    return messages.slice(-limit);

  } catch (error) {
    console.error(`Error loading history for bot ${botId}:`, error);
    return [];
  }
}

export function createDashboardApp(botManager: BotManager) {
  const app = new Hono();
  app.use('*', cors());

  // ============================================================================
  // Bot Status & Control
  // ============================================================================

  app.get('/api/bots', (c) => {
    try {
      const statuses = botManager.getAllBotStatuses();
      return c.json(statuses);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/api/bots/:name', (c) => {
    try {
      const name = c.req.param('name');
      const status = botManager.getBotStatus(name);

      if (!status) {
        return c.json({ error: 'Bot not found' }, 404);
      }

      return c.json(status);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/api/bots/:name/start', async (c) => {
    try {
      const name = c.req.param('name');
      const configs = botManager.loadConfig();
      const config = configs.find((b) => b.name === name);

      if (!config) {
        return c.json({ error: 'Bot not found in config' }, 404);
      }

      await botManager.startBot(config);
      return c.json({ success: true, message: `Bot ${name} started` });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/api/bots/:name/stop', async (c) => {
    try {
      const name = c.req.param('name');
      await botManager.stopBot(name);
      return c.json({ success: true, message: `Bot ${name} stopped` });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/api/bots/:name/restart', async (c) => {
    try {
      const name = c.req.param('name');
      await botManager.restartBot(name);
      return c.json({ success: true, message: `Bot ${name} restarted` });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // CraftScript Execution (Direct method call - no IPC!)
  // ============================================================================

  app.post('/api/bots/:name/craftscript', async (c) => {
    try {
      const name = c.req.param('name');
      const body = await c.req.json();
      const script = String(body?.script || '').trim();

      if (!script) {
        return c.json({ error: 'script required' }, 400);
      }

      const result = await botManager.executeCraftScript(name, script);
      return c.json({ ok: true, job_id: result.job_id });

    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/api/craftscript/:job_id/status', (c) => {
    try {
      const jobId = c.req.param('job_id');
      const status = botManager.getCraftScriptStatus(jobId);

      if (!status) {
        return c.json({ error: 'Job not found' }, 404);
      }

      return c.json(status);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/api/craftscript/:job_id/cancel', (c) => {
    try {
      const jobId = c.req.param('job_id');
      botManager.cancelCraftScript(jobId);
      return c.json({ ok: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // Timeline / Events
  // ============================================================================

  app.get('/api/bots/:name/events', (c) => {
    try {
      const name = c.req.param('name');
      const colonyDb = ColonyDatabase.getInstance();
      const botId = colonyDb.getBotId(name);

      if (!botId) {
        return c.json({ error: 'Bot not found' }, 404);
      }

      const limit = Math.max(1, Math.min(Number(c.req.query('limit') || 100), 500));
      const beforeTs = Number(c.req.query('before_ts') || Date.now());

      const events = buildHistoryFromDatabase(botId, limit, beforeTs);
      return c.json({ events });

    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // Minecraft Assets (block textures, etc.)
  // ============================================================================

  app.get('/api/minecraft/blocks', (c) => {
    try {
      const blocks: any[] = [];
      for (const [id, block] of Object.entries(assets.blocksArray || [])) {
        const b = block as any;
        blocks.push({
          id: Number(id),
          name: b.name,
          displayName: b.displayName
        });
      }
      return c.json(blocks);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/api/minecraft/block/:id/texture', (c) => {
    try {
      const blockId = Number(c.req.param('id'));
      const block = assets.blocksArray?.[blockId];

      if (!block) {
        return c.json({ error: 'Block not found' }, 404);
      }

      const texturePath = block.texture;
      if (texturePath) {
        return c.json({ texture: texturePath });
      }

      return c.json({ texture: null });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // Static UI
  // ============================================================================

  // When running from compiled dist/runtime/dashboardServer.js, UI is at dist/dashboard
  // When running from source, UI is also at dist/dashboard (built by vite)
  const uiDistPath = path.resolve(__dirname, '..', '..', 'dist', 'dashboard');

  app.get('/', (c) => {
    const indexPath = path.join(uiDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf-8');
      return c.html(html);
    }
    return c.text('Dashboard UI not built. Run: bun run dashboard:build', 404);
  });

  app.get('/assets/*', (c) => {
    const assetPath = c.req.path.replace('/assets/', '');
    const fullPath = path.join(uiDistPath, 'assets', assetPath);

    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath);

      const mimeTypes: Record<string, string> = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };

      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      c.header('Content-Type', mimeType);
      return c.body(content);
    }

    return c.text('Not found', 404);
  });

  return app;
}

/**
 * Start Dashboard Server with WebSocket support
 */
export function startDashboardServer(botManager: BotManager, port: number = 4242) {
  const app = createDashboardApp(botManager);
  const server = createAdaptorServer({ fetch: app.fetch });

  // WebSocket server for dashboard clients (no /ingest needed!)
  const wss = new WebSocketServer({ noServer: true });

  // Track connected clients
  const clients = new Set<WebSocket>();

  // Broadcast helper
  function broadcast(message: any) {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  // Listen to BotManager events and broadcast to dashboard clients
  // No more /ingest WebSocket - just use EventEmitter!

  botManager.on('bot:activity', (data) => {
    broadcast({
      type: 'activity',
      bot_id: data.botId,
      ts: Date.now(),
      activity_type: data.type,
      description: data.description
    });
  });

  botManager.on('bot:message', (data) => {
    broadcast({
      type: 'chat',
      bot_id: data.botId,
      ts: Date.now(),
      from: data.role === 'user' ? 'player' : `bot_${data.botId}`,
      text: data.content,
      direction: data.role === 'user' ? 'in' : 'out'
    });
  });

  botManager.on('bot:started', (data) => {
    broadcast({ type: 'bot:started', bot_id: data.botId, name: data.name });
  });

  botManager.on('bot:stopped', (data) => {
    broadcast({ type: 'bot:stopped', bot_id: data.botId, name: data.name });
  });

  botManager.on('bot:error', (data) => {
    broadcast({ type: 'bot:error', bot_id: data.botId, name: data.name, error: data.error });
  });

  // WebSocket /ws connection handler
  wss.on('connection', (ws: WebSocket) => {
    console.log('[Dashboard] Client connected to /ws');
    clients.add(ws);

    ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(String(buf));
        if (!msg || typeof msg !== 'object') return;

        // History request
        if (msg.type === 'history' && msg.bot_name) {
          const colonyDb = ColonyDatabase.getInstance();
          const botId = colonyDb.getBotId(msg.bot_name);

          if (botId) {
            const limit = Math.max(1, Math.min(Number(msg.limit || 100), 500));
            const beforeTs = Number(msg.before_ts || Date.now());
            const events = buildHistoryFromDatabase(botId, limit, beforeTs);

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'history',
                bot_id: botId,
                bot_name: msg.bot_name,
                events
              }));
            }
          }
        }
      } catch (error) {
        console.error('[Dashboard] Error handling WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('[Dashboard] WebSocket client error:', error);
    });

    ws.on('close', () => {
      console.log('[Dashboard] Client disconnected from /ws');
      clients.delete(ws);
    });
  });

  // HTTP upgrade handler
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;

    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Start server
  server.listen(port, () => {
    console.log(`[Dashboard] Server running on http://localhost:${port}`);
    console.log(`[Dashboard] WebSocket available at ws://localhost:${port}/ws`);
  });

  return { server, wss };
}
