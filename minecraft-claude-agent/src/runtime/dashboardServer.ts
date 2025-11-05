import { Hono } from 'hono';
import { createAdaptorServer } from '@hono/node-server';
import { cors } from 'hono/cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mcAssets from 'minecraft-assets';
import BetterSqlite from 'better-sqlite3';
const Database: any = (BetterSqlite as any);
import WebSocket, { WebSocketServer } from 'ws';
import { SqlMemoryStore } from '../utils/sqlMemoryStore.js';
// MAS removed; endpoints delegated elsewhere or disabled
import {
  loadConfig,
  getBotStatus,
  getAllStatuses,
  BotStatus,
  startBot,
  stopBot,
} from './botControl.js';
// MAS routes removed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MINECRAFT_VERSION = process.env.MINECRAFT_VERSION || '1.20';
const assets: any = mcAssets(MINECRAFT_VERSION);

// Helper function to load bot history from SQLite
function buildHistoryFromActivity(botId: string, limit: number, beforeTs: number): any[] {
  const dbPath = path.resolve('logs', 'memories', `${botId}.db`);
  if (!fs.existsSync(dbPath)) {
    console.log(`No database found for bot ${botId} at ${dbPath}`);
    return [];
  }

  let db: any = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const messages: any[] = [];

    // Messages (chat)
    const rowsMsg = db.prepare(`
      SELECT m.role, m.content, m.timestamp
      FROM messages m
      JOIN sessions s ON m.session_id = s.session_id
      WHERE s.bot_name = ? AND m.timestamp < ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `).all(botId, Math.floor(beforeTs/1000), limit);

    for (const r of rowsMsg) {
      const ts = (Number(r.timestamp)||0)*1000;
      const dir = String(r.role)==='user'?'in':'out';
      const from = dir==='in'?'player':botId;
      const id = `chat-${ts}-${Math.random().toString(36).slice(2, 7)}`;
      messages.push({
        id,
        type:'chat',
        bot_id: botId,
        ts,
        payload:{
          from,
          text: String(r.content||''),
          channel:'chat',
          direction: dir
        }
      });
    }

    // Activities (thinking/tool/system)
    const rowsAct = db.prepare(`
      SELECT a.type, a.description, a.timestamp, a.data
      FROM activities a
      JOIN sessions s ON a.session_id = s.session_id
      WHERE s.bot_name = ? AND a.timestamp < ?
      ORDER BY a.timestamp DESC
      LIMIT ?
    `).all(botId, Math.floor(beforeTs/1000), limit);

    for (const a of rowsAct) {
      const ts = (Number(a.timestamp)||0)*1000;
      const t = String(a.type||'').toLowerCase();
      let data:any={};
      try {
        data = a.data ? JSON.parse(String(a.data)) : {};
      } catch (e) {
        console.warn(`Failed to parse activity data for ${botId}:`, e);
      }

      if (t==='thinking') {
        messages.push({
          id: `think-${ts}-${Math.random().toString(36).slice(2, 7)}`,
          type:'chat',
          bot_id: botId,
          ts,
          payload:{
            from:'Planner',
            text:String(a.description||''),
            channel:'system',
            direction:'out',
            kind:'thinking'
          }
        });
      } else if (t==='tool' || t==='tool_use') {
        messages.push({
          id: `tool-${ts}-${Math.random().toString(36).slice(2, 7)}`,
          type:'tool',
          bot_id: botId,
          ts,
          payload:{
            tool_name:data?.name||'tool',
            params_summary:data||{},
            output:data?.output,
            input:data?.input,
            duration_ms:data?.duration_ms,
            ok:true
          }
        });
      } else if (t==='error' || t==='warn' || t==='info') {
        messages.push({
          id: `sys-${ts}-${Math.random().toString(36).slice(2, 7)}`,
          type:'system',
          bot_id: botId,
          ts,
          payload:{
            level: t==='warn'?'warn':t,
            message:String(a.description||'')
          }
        });
      } else if (t==='skill') {
        messages.push({
          id: `skill-${ts}-${Math.random().toString(36).slice(2, 7)}`,
          type:'skill',
          bot_id: botId,
          ts,
          payload:{
            name:a.description,
            description:data?.description||''
          }
        });
      }
    }

    messages.sort((a,b)=>a.ts-b.ts);
    return messages.slice(-limit);
  } catch (error) {
    console.error(`Error loading history for bot ${botId}:`, error);
    return [];
  } finally {
    try {
      if (db) db.close();
    } catch (e) {
      console.warn(`Failed to close database for ${botId}:`, e);
    }
  }
}

export function createDashboardApp() {
  const app = new Hono();
  app.use('*', cors());

  app.get('/api/bots', (c) => {
    try {
      return c.json(getAllStatuses());
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/api/bots/:name', (c) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === c.req.param('name'));
      if (!bot) {
        return c.json({ error: 'Bot not found' }, 404);
      }
      const status: BotStatus = getBotStatus(bot);
      return c.json(status);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // Reset a bot's memory/activity/logs and restart the bot (with confirmation expected client-side)
  app.post('/api/bots/:name/reset', async (c) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === c.req.param('name'));
      if (!bot) {
        return c.json({ error: 'Bot not found' }, 404);
      }

      // Stop bot if running
      try { stopBot(bot); } catch {}

      const botName = bot.name;
      // Clear activity file
      try {
        const actPath = path.resolve('logs', `${botName}.activity.json`);
        fs.mkdirSync(path.dirname(actPath), { recursive: true });
        fs.writeFileSync(actPath, '[]\n', 'utf-8');
      } catch {}

      // Clear state file
      try {
        const statePath = path.resolve('logs', `${botName}.state.json`);
        if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
      } catch {}

      // Clear diary
      try {
        const diaryPath = path.resolve(bot.logs_dir, 'diary.md');
        fs.mkdirSync(path.dirname(diaryPath), { recursive: true });
        fs.writeFileSync(
          diaryPath,
          `# Diary reset\n\nReset at ${new Date().toISOString()}\n`,
          'utf-8'
        );
      } catch {}

      // Remove memory DB files
      try {
        const memDir = path.resolve('logs', 'memories');
        const base = path.resolve(memDir, `${botName}.db`);
        const candidates = [base, `${base}-wal`, `${base}-shm`];
        for (const f of candidates) {
          try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
        }
      } catch {}

      // Optionally clear bot-specific log file
      const clearLog = c.req.query('clear_log');
      if (clearLog === 'true') {
        try {
          const logPath = path.resolve(bot.logs_dir, `${bot.name}.log`);
          if (fs.existsSync(logPath)) fs.writeFileSync(logPath, `---\nLog reset at ${new Date().toISOString()}\n`, 'utf-8');
        } catch {}
      }

      // Restart bot
      try { startBot(bot); } catch {}

      return c.json({ ok: true, reset: true, bot: botName });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/api/logs/:botName', (c) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === c.req.param('botName'));
      if (!bot) {
        return c.json({ error: 'Bot not found' }, 404);
      }

      const logPath = path.resolve(bot.logs_dir, `${bot.name}.log`);
      if (!fs.existsSync(logPath)) {
        return c.text('Log file not found', 404);
      }

      const content = fs.readFileSync(logPath, 'utf-8');
      return c.text(content, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/api/diary/:botName', (c) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === c.req.param('botName'));
      if (!bot) {
        return c.json({ error: 'Bot not found' }, 404);
      }

      const diaryPath = path.resolve(bot.logs_dir, 'diary.md');
      if (!fs.existsSync(diaryPath)) {
        return c.text('Diary file not found', 404);
      }

      const content = fs.readFileSync(diaryPath, 'utf-8');
      return c.text(content, 200, { 'Content-Type': 'text/markdown; charset=utf-8' });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // Legacy endpoint (JSON activity). We migrated to SQL + WebSocket. Return 410 Gone.
  app.get('/api/activity/:botName', (c) => {
    return c.json({ error: 'Deprecated: use WebSocket /ws with {type:"history"} for activity history.' }, 410);
  });

  app.get('/api/texture/:itemName', (c) => {
    try {
      const itemName = String(c.req.param('itemName'));
      // minecraft-assets modern API: use getTexture(name) and assets.directory
      let textureKey: string | null = null;
      try {
        textureKey = (assets as any).getTexture?.(itemName) || null;
      } catch {}

      // Fallback: try mcData name variants (singular/plural) if needed
      if (!textureKey && itemName.endsWith('s')) {
        try { textureKey = (assets as any).getTexture?.(itemName.slice(0, -1)) || null; } catch {}
      }

      if (textureKey) {
        // Try physical file first
        const filePath = path.resolve((assets as any).directory, `${textureKey}.png`);
        if (fs.existsSync(filePath)) {
          try {
            const buf = fs.readFileSync(filePath);
            return c.body(buf, 200, { 'Content-Type': 'image/png' });
          } catch {}
        }

        // Else decode embedded base64 from textureContent using basename
        const base = path.basename(textureKey);
        const candidates = [base, itemName];
        for (const key of candidates) {
          const dataUrl = (assets as any).textureContent?.[key]?.texture;
          if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
            const base64 = dataUrl.split(',')[1];
            const buf = Buffer.from(base64, 'base64');
            return c.body(buf, 200, { 'Content-Type': 'image/png' });
          }
        }
      }

      // Final fallback: try getImageContent by name
      try {
        const dataUrl = (assets as any).getImageContent?.(itemName);
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          const base64 = dataUrl.split(',')[1];
          const buf = Buffer.from(base64, 'base64');
          return c.body(buf, 200, { 'Content-Type': 'image/png' });
        }
      } catch {}

      return c.json({ error: 'Texture not found' }, 404);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // Debug helper for textures
  app.get('/api/texture-debug/:itemName', (c) => {
    const itemName = String(c.req.param('itemName'));
    const info: any = { itemName };
    try {
      info.version = (assets as any).version;
      info.directory = (assets as any).directory;
      const key = (assets as any).getTexture?.(itemName) || null;
      info.textureKey = key;
      if (key) {
        const filePath = path.resolve((assets as any).directory, `${key}.png`);
        info.filePath = filePath;
        info.fileExists = fs.existsSync(filePath);
        const base = path.basename(key);
        const dataUrl = (assets as any).textureContent?.[base]?.texture;
        info.base64Available = typeof dataUrl === 'string' && dataUrl.startsWith('data:image/');
      }
      return c.json(info);
    } catch (e: any) {
      info.error = e?.message || String(e);
      return c.json(info);
    }
  });

  // Serve Vue dashboard build at '/'
  app.get('/', (c) => {
    const vueIndex = path.resolve(__dirname, '../../dist/dashboard/index.html');
    if (!fs.existsSync(vueIndex)) {
      return c.text('Dashboard not built. Run: pnpm run dashboard:build', 500);
    }
    const html = fs.readFileSync(vueIndex, 'utf-8');
    return c.html(html);
  });

  // Serve built dashboard assets
  app.get('/assets/*', (c) => {
    const target = c.req.path.replace(/^\/+/, '');
    const asset = path.resolve(__dirname, '../../dist/dashboard', target.replace(/^assets\//, 'assets/'));
    if (fs.existsSync(asset)) {
      const buf = fs.readFileSync(asset);
      // Set correct MIME type
      const ext = path.extname(asset).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      return c.body(buf, 200, { 'Content-Type': contentType });
    }
    return c.text('Not found', 404);
  });

  // Favicon (return 204 No Content to avoid 404)
  app.get('/favicon.ico', (c) => {
    return c.body(null, 204);
  });

  // Serve timeline test page
  app.get('/timeline-test', (c) => {
    const testPath = path.resolve(__dirname, 'timeline-test.html');
    if (fs.existsSync(testPath)) {
      const content = fs.readFileSync(testPath, 'utf-8');
      return c.html(content);
    }
    return c.text('Timeline test page not found', 404);
  });

  // Debug endpoint for timeline (MAS removed)
  app.get('/api/timeline/debug', (c) => {
    return c.json({ error: 'timeline debug not available (MAS removed)' }, 501);
  });

  // API endpoint for bot events – reads from SQLite
  app.get('/api/bots/:name/events', (c) => {
    try {
      const botName = c.req.param('name');
      const limit = parseInt(c.req.query('limit') || '100');
      const before_ts = parseInt(c.req.query('before_ts') || String(Date.now()));

      // Load events from SQLite
      const events = buildHistoryFromActivity(botName, limit, before_ts);
      return c.json(events);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // MAS API endpoints removed in simplified architecture

  return app;
}

export function startDashboardServer(port: number) {
  const app = createDashboardApp();

  // Create HTTP server using Hono adapter
  const server = createAdaptorServer({
    fetch: app.fetch,
    port,
  });

  // WebSocket for live updates (activity only) and low-latency ingest from agents
  const wss = new WebSocketServer({
    noServer: true,
    clientTracking: true,
    perMessageDeflate: false
  });
  const ingestWss = new WebSocketServer({
    noServer: true,
    clientTracking: true,
    perMessageDeflate: false
  });
  const lastActivityTsByBot: Record<string, number> = {};
  const sqlStores: Map<string, SqlMemoryStore> = new Map();

  function getStore(botId: string): SqlMemoryStore {
    let store = sqlStores.get(botId);
    if (!store) {
      store = new SqlMemoryStore(botId);
      sqlStores.set(botId, store);
    }
    return store;
  }

  function ensureSessionId(store: SqlMemoryStore): string {
    const existing = store.getLastActiveSessionId();
    if (existing) return existing;
    const sid = `ingest-${Date.now()}`;
    store.createSession(sid);
    return sid;
  }

  // Handle WebSocket upgrade manually
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (pathname === '/ingest') {
      ingestWss.handleUpgrade(request, socket, head, (ws) => {
        ingestWss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Dashboard client connected to /ws');

    ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(String(buf));
        if (!msg || typeof msg !== 'object') return;
        // Single-bot history request
        if (msg.type === 'history' && msg.bot_id) {
          const botId = String(msg.bot_id);
          const limit = Math.max(1, Math.min(Number(msg.limit || 100), 500));
          const beforeTs = Number(msg.before_ts || Date.now());
          const events = buildHistoryFromActivity(botId, limit, beforeTs);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'history', bot_id: botId, events }));
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
    });

    ws.on('close', () => {
      console.log('Dashboard client disconnected from /ws');
    });
  });

  // Accept realtime activity from agents and broadcast immediately
  ingestWss.on('connection', (ws: WebSocket) => {
    console.log('Agent connected to /ingest');

    ws.on('error', (error) => {
      console.error('Ingest WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('Agent disconnected from /ingest');
    });

    ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(String(buf));
        if (msg && msg.type === 'activity' && msg.bot_id && msg.item) {
          const botId = String(msg.bot_id);
          const a = msg.item as any;
          // Timestamp
          const ts = Date.parse(a.timestamp || '') || Date.now();
          lastActivityTsByBot[botId] = Math.max(lastActivityTsByBot[botId] || 0, ts);

          // Persist to per-bot SQLite (best-effort)
          try {
            const store = getStore(botId);
            const sessionId = ensureSessionId(store);
            const t = String(a.type || '').toLowerCase();
            if (t === 'chat') {
              const role = a.role === 'bot' ? 'assistant' : a.role === 'player' ? 'user' : 'system';
              const content = role === 'user' && a.speaker ? `${a.speaker}: ${a.message}` : String(a.message || '');
              store.addMessage(sessionId, role as any, content);
            } else if (t === 'thinking') {
              store.addActivity(sessionId, 'thinking', String(a.message || ''), {});
            } else if (t === 'tool') {
              const name = (a.details?.name) || (typeof a.message === 'string' && a.message.startsWith('Tool:') ? a.message.replace(/^Tool:\s*/, '') : 'tool');
              const data: any = {
                name,
                input: a.details?.input,
                output: a.details?.output,
                duration_ms: a.details?.duration_ms,
              };
              store.addActivity(sessionId, 'tool', `Used ${name}`, data);
            } else if (t === 'skill') {
              const name = String(a.message || a.details?.name || 'skill');
              const data: any = { description: a.details?.description || '' };
              store.addActivity(sessionId, 'skill', name, data);
            } else if (t === 'error' || t === 'warn' || t === 'info') {
              store.addActivity(sessionId, t, String(a.message || ''), a.details || {});
            }
          } catch (e) {
            // Do not crash on persistence errors; just log
            console.warn('Failed to persist ingest activity to SQLite', e);
          }

          const messages: any[] = [];
          if (a.type === 'chat') {
            messages.push({ type: 'chat', bot_id: botId, ts, from: a.speaker || (a.role === 'bot' ? botId : 'player'), text: a.message, channel: 'chat', direction: a.role === 'bot' ? 'out' : 'in' });
          } else if (a.type === 'thinking') {
            messages.push({ type: 'chat', bot_id: botId, ts, from: 'Planner', text: a.message, channel: 'system', direction: 'out', kind: 'thinking' });
          } else if (a.type === 'tool') {
            const toolName = (a.message && String(a.message).startsWith('Tool:')) ? String(a.message).replace(/^Tool:\s*/, '') : (a.details?.name || 'tool');
            const summary = a.details?.output ?? a.details?.input;
            let params_summary: any = summary;
            if (typeof summary === 'string') { try { params_summary = JSON.parse(summary); } catch { params_summary = summary; } }
            messages.push({ type: 'tool', bot_id: botId, ts, ok: true, tool_name: toolName, params_summary, output: a.details?.output, input: a.details?.input, duration_ms: a.details?.duration_ms });
          } else if (a.type === 'skill') {
            messages.push({ type: 'skill', bot_id: botId, ts, name: a.message, description: a.details?.description || '' });
          } else if (a.type === 'error' || a.type === 'warn' || a.type === 'info') {
            messages.push({ type: 'system', bot_id: botId, ts, payload: { level: a.type, message: a.message } });
          }
          if (messages.length) broadcast(wss, messages);
        }
      } catch {
        // ignore malformed message
      }
    });
  });

  // No polling – rely on realtime ingest and explicit history requests

  server.listen(port, () => {
    console.log(`Minecraft Colony dashboard listening on http://localhost:${port}`);
    console.log(`WebSocket at ws://localhost:${port}/ws`);
  });

  function broadcast(wss: WebSocketServer, messages: any[]) {
    if (messages.length === 0) return;
    const text = messages.length === 1 ? JSON.stringify(messages[0]) : JSON.stringify(messages);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(text); } catch {}
      }
    }
  }
}
