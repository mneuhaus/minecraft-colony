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
import { ColonyDatabase, ISSUE_SEVERITIES, ISSUE_STATES, type IssueState } from '../database/ColonyDatabase.js';

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
            tool_name: data?.name || (activity.description || 'tool'),
            params_summary: data || {},
            output: (data && (data.output !== undefined)) ? data.output : JSON.stringify(data || {}),
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

  // Lightweight runtime inventory snapshot for sidebar/overview
  app.get('/api/bots/:name/inventory', (c) => {
    try {
      const name = c.req.param('name');
      const instance = botManager.getBot(name);
      if (!instance) return c.json({ ok: false, error: 'not_running' }, 404);

      const bot = instance.minecraftBot.getBot();
      const items = bot.inventory.items().map((i: any) => ({ name: i.name, count: i.count }));
      const totalTypes = Array.from(new Set(items.map((i: any) => i.name))).length;
      const slotsUsed = Math.min(items.length, 36);
      return c.json({ ok: true, totalTypes, slotsUsed, totalSlots: 36, items });
    } catch (error: any) {
      return c.json({ ok: false, error: error.message }, 500);
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

  app.post('/api/bots/:name/reset', async (c) => {
    try {
      const name = c.req.param('name');
      const colonyDb = ColonyDatabase.getInstance();
      const db = colonyDb.getDb();
      const botId = colonyDb.getBotId(name);

      if (!botId) {
        return c.json({ error: 'Bot not found' }, 404);
      }

      // Stop bot if running
      try {
        await botManager.stopBot(name);
      } catch {}

      // Clear all bot data from database
      db.prepare('DELETE FROM messages WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM tool_calls WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM craftscript_jobs WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM craftscript_block_changes WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM craftscript_functions WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM craftscript_function_versions WHERE function_id IN (SELECT id FROM craftscript_functions WHERE bot_id = ?)').run(botId);
      db.prepare('DELETE FROM memory WHERE bot_id = ?').run(botId);
      db.prepare('DELETE FROM blueprints WHERE bot_id = ?').run(botId);

      // Restart bot using existing config
      const instance = botManager.getBot(name);
      const config = instance?.config ?? botManager.loadConfig().find((b) => b.name === name);
      if (!config) {
        return c.json({ error: 'Bot config not found' }, 404);
      }
      await botManager.startBot(config);

      return c.json({ success: true, message: `Bot ${name} reset and restarted` });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // =========================================================================
  // Issue Tracker API
  // =========================================================================

  app.get('/api/issues', (c) => {
    try {
      const colonyDb = ColonyDatabase.getInstance();
      let botId: number | null = null;
      const botName = c.req.query('bot');
      if (botName) {
        const id = colonyDb.getBotId(botName);
        if (id === null) return c.json({ error: 'Bot not found' }, 404);
        botId = id;
      }

      const stateParam = c.req.query('state');
      let states: IssueState[] | undefined;
      if (stateParam) {
        const requested = stateParam.split(',').map((s) => s.trim()).filter(Boolean);
        const invalid = requested.filter((s) => !ISSUE_STATES.includes(s as any));
        if (invalid.length) {
          return c.json({ error: `Invalid state(s): ${invalid.join(', ')}` }, 400);
        }
        states = requested as IssueState[];
      }

      let assignedBotId: number | null | undefined = undefined;
      const assignedParam = c.req.query('assigned');
      if (assignedParam) {
        if (assignedParam === 'none') {
          assignedBotId = null;
        } else {
          const id = colonyDb.getBotId(assignedParam);
          if (id === null) return c.json({ error: 'Assigned bot not found' }, 404);
          assignedBotId = id;
        }
      }

      const issues = colonyDb.listIssues({ botId, state: states, assignedBotId });
      return c.json(issues);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/api/issues', async (c) => {
    try {
      const body = await c.req.json();
      const title = String(body?.title || '').trim();
      const description = String(body?.description || '').trim();
      if (!title || !description) {
        return c.json({ error: 'title and description required' }, 400);
      }

      const colonyDb = ColonyDatabase.getInstance();
      let botId: number | null = null;
      const botName = String(body?.bot || body?.bot_name || '').trim();
      if (botName) {
        const id = colonyDb.getBotId(botName);
        if (id === null) return c.json({ error: 'Bot not found' }, 404);
        botId = id;
      }

      const severity = ISSUE_SEVERITIES.includes(body?.severity) ? body.severity : 'medium';
      const issue = colonyDb.createIssue(botId, title, description, body?.created_by || body?.reporter || null, severity);
      return c.json(issue, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/api/issues/:id', (c) => {
    try {
      const id = Number(c.req.param('id'));
      const colonyDb = ColonyDatabase.getInstance();
      const detail = colonyDb.getIssueDetail(id);
      if (!detail) return c.json({ error: 'Issue not found' }, 404);
      return c.json(detail);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.patch('/api/issues/:id', async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const body = await c.req.json();
      const colonyDb = ColonyDatabase.getInstance();

      const updates: any = {};

      if (body.state) {
        if (!ISSUE_STATES.includes(body.state)) {
          return c.json({ error: 'Invalid state' }, 400);
        }
        updates.state = body.state;
      }

      if (body.assigned_to !== undefined) {
        updates.assigned_to = body.assigned_to;
      }

      if (body.assigned_bot !== undefined) {
        if (body.assigned_bot === null || body.assigned_bot === '') {
          updates.assigned_bot_id = null;
        } else {
          const botId = colonyDb.getBotId(String(body.assigned_bot));
          if (botId === null) return c.json({ error: 'Assigned bot not found' }, 404);
          updates.assigned_bot_id = botId;
        }
      }

      if (body.severity) {
        if (!ISSUE_SEVERITIES.includes(body.severity)) {
          return c.json({ error: 'Invalid severity' }, 400);
        }
        updates.severity = body.severity;
      }

      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.updated_by !== undefined) updates.updated_by = body.updated_by;

      const issue = colonyDb.updateIssue(id, updates);
      if (!issue) return c.json({ error: 'Issue not found' }, 404);
      return c.json(issue);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/api/issues/:id/comments', async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const body = await c.req.json();
      const text = String(body?.body || '').trim();
      if (!text) return c.json({ error: 'body required' }, 400);
      const colonyDb = ColonyDatabase.getInstance();
      const issue = colonyDb.getIssue(id);
      if (!issue) return c.json({ error: 'Issue not found' }, 404);
      const comment = colonyDb.addIssueComment(id, body?.author || null, text);
      return c.json(comment, 201);
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

  app.get('/api/craftscript/:job_id/trace', (c) => {
    try {
      const jobId = c.req.param('job_id');
      const colonyDb = ColonyDatabase.getInstance();
      const db = colonyDb.getDb();

      // Get block changes from database
      const changes = db.prepare(`
        SELECT action, x, y, z, block_id, previous_block_id, command, timestamp
        FROM craftscript_block_changes
        WHERE job_id = ?
        ORDER BY timestamp ASC
      `).all(jobId);

      const result = {
        job_id: jobId,
        total_changes: changes.length,
        changes
      };

      return c.json(result);
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

  // ============================================================================
  // Blueprints API
  // ============================================================================

  app.get('/api/blueprints', async (c) => {
    try {
      const mod = await import('../tools/blueprints/storage.js');
      return c.json(mod.listBlueprints());
    } catch (e: any) {
      return c.json({ error: e?.message || String(e) }, 500);
    }
  });

  app.get('/api/blueprints/:name', async (c) => {
    try {
      const mod = await import('../tools/blueprints/storage.js');
      const name = c.req.param('name');
      const bp = mod.getBlueprint(name);
      if (!bp) return c.json({ error: 'not_found' }, 404);
      const v = mod.validateBlueprint(bp);
      return c.json({ ok: v.ok, issues: v.issues, blueprint: bp });
    } catch (e: any) {
      return c.json({ error: e?.message || String(e) }, 500);
    }
  });

  app.post('/api/blueprints', async (c) => {
    try {
      const body = await c.req.json();
      const mod = await import('../tools/blueprints/storage.js');
      const bp = mod.createBlueprint(body);
      return c.json(bp);
    } catch (e: any) {
      return c.json({ error: e?.message || String(e) }, 400);
    }
  });

  app.put('/api/blueprints/:name', async (c) => {
    try {
      const name = c.req.param('name');
      const body = await c.req.json();
      const mod = await import('../tools/blueprints/storage.js');
      const bp = mod.updateBlueprint(name, body);
      return c.json(bp);
    } catch (e: any) {
      return c.json({ error: e?.message || String(e) }, 400);
    }
  });

  app.delete('/api/blueprints/:name', async (c) => {
    try {
      const name = c.req.param('name');
      const mod = await import('../tools/blueprints/storage.js');
      const ok = mod.removeBlueprint(name);
      return c.json({ ok });
    } catch (e: any) {
      return c.json({ error: e?.message || String(e) }, 500);
    }
  });

  app.post('/api/blueprints/:name/instantiate', async (c) => {
    try {
      const name = c.req.param('name');
      const body = await c.req.json();
      const mod = await import('../tools/blueprints/storage.js');
      const bp = mod.getBlueprint(name);
      if (!bp) return c.json({ error: 'not_found' }, 404);
      const origin = body?.origin || { x: 0, y: 0, z: 0 };
      const rotation = body?.rotation ?? 0;
      const vox = mod.instantiateBlueprint(bp, origin, rotation);
      return c.json({ ok: true, count: vox.length, voxels: vox });
    } catch (e: any) {
      return c.json({ error: e?.message || String(e) }, 400);
    }
  });

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

  // Item texture endpoint - serves actual PNG files (with base64 fallback from minecraft-assets)
  app.get('/api/minecraft/item/:name/texture', (c) => {
    try {
      const itemName = c.req.param('name');
      const cleanName = itemName.replace(/^minecraft:/, '');

      // Prefer the minecraft-assets API when available
      try {
        const key = (assets as any).getTexture?.(cleanName) || null;
        if (key) {
          // 1) Try physical file under assets.directory
          const filePath = path.resolve((assets as any).directory || '', `${key}.png`);
          if (filePath && fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            c.header('Content-Type', 'image/png');
            c.header('Cache-Control', 'public, max-age=86400');
            return c.body(buf);
          }
          // 2) Fallback to base64 embedded content
          const base = path.basename(String(key));
          const dataUrl = (assets as any).textureContent?.[base]?.texture || (assets as any).textureContent?.[cleanName]?.texture;
          if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
            const b64 = dataUrl.split(',')[1];
            const buf = Buffer.from(b64, 'base64');
            c.header('Content-Type', 'image/png');
            c.header('Cache-Control', 'public, max-age=86400');
            return c.body(buf);
          }
        }
      } catch {}

      // Legacy static path fallback (older minecraft-assets layout)
      try {
        const assetsPath = path.join(__dirname, '..', '..', 'node_modules', 'minecraft-assets', 'minecraft-assets', 'data', MINECRAFT_VERSION);
        const itemPath = path.join(assetsPath, 'items', `${cleanName}.png`);
        if (fs.existsSync(itemPath)) {
          const imageBuffer = fs.readFileSync(itemPath);
          c.header('Content-Type', 'image/png');
          c.header('Cache-Control', 'public, max-age=86400');
          return c.body(imageBuffer);
        }
        const blockPath = path.join(assetsPath, 'blocks', `${cleanName}.png`);
        if (fs.existsSync(blockPath)) {
          const imageBuffer = fs.readFileSync(blockPath);
          c.header('Content-Type', 'image/png');
          c.header('Cache-Control', 'public, max-age=86400');
          return c.body(imageBuffer);
        }
      } catch {}

      // Final base64 fallback by name
      try {
        const dataUrl = (assets as any).getImageContent?.(cleanName);
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          const b64 = dataUrl.split(',')[1];
          const buf = Buffer.from(b64, 'base64');
          c.header('Content-Type', 'image/png');
          c.header('Cache-Control', 'public, max-age=86400');
          return c.body(buf);
        }
      } catch {}

      return c.text('Item texture not found', 404);
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
    const ts = Date.now();
    const t = String(data.type || '').toLowerCase();
    // Normalize into timeline-friendly shapes used by UI and history
    if (t === 'thinking') {
      broadcast({
        id: `think-${ts}-${Math.random().toString(36).slice(2,7)}`,
        type: 'chat',
        bot_id: data.botId,
        ts,
        payload: {
          from: 'Planner',
          text: String(data.description || ''),
          channel: 'system',
          direction: 'out',
          kind: 'thinking'
        }
      });
      return;
    }

    if (t === 'tool' || t === 'tool_use') {
      const d: any = data.data || {};
      broadcast({
        id: `tool-${ts}-${Math.random().toString(36).slice(2,7)}`,
        type: 'tool',
        bot_id: data.botId,
        ts,
        payload: {
          tool_name: d?.tool_name || d?.name || (data.description || 'tool'),
          params_summary: d?.params_summary || d?.input || {},
          output: (d && (d.output !== undefined)) ? d.output : JSON.stringify(d || {}),
          input: d?.input,
          duration_ms: d?.duration_ms,
          ok: !d?.error
        }
      });
      return;
    }

    if (t === 'error' || t === 'warn' || t === 'info' || t === 'system') {
      broadcast({
        id: `sys-${ts}-${Math.random().toString(36).slice(2,7)}`,
        type: 'system',
        bot_id: data.botId,
        ts,
        payload: {
          level: t === 'warn' ? 'warn' : t,
          message: String(data.description || '')
        }
      });
      return;
    }

    // Fallback generic activity (not expected by UI but kept for completeness)
    broadcast({
      type: 'activity',
      bot_id: data.botId,
      ts,
      activity_type: data.type,
      description: data.description,
      data: data.data || null
    });
  });

  botManager.on('bot:message', (data) => {
    const dir = data.role === 'user' ? 'in' : 'out';
    const from = dir === 'in' ? 'player' : `bot_${data.botId}`;
    const ts = Date.now();
    broadcast({
      id: `chat-${ts}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'chat',
      bot_id: data.botId,
      ts,
      payload: {
        from,
        text: data.content,
        channel: 'chat',
        direction: dir
      }
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
