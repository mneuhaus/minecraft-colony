import express, { Express } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mcAssets from 'minecraft-assets';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { MasDatabase } from '../mas/db.js';
import {
  loadConfig,
  getBotStatus,
  getAllStatuses,
  BotStatus,
} from './botControl.js';
import { registerMasRoutes } from '../mas/apiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MINECRAFT_VERSION = process.env.MINECRAFT_VERSION || '1.20';
const assets: any = mcAssets(MINECRAFT_VERSION);

export function createDashboardApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/bots', (_req, res) => {
    try {
      res.json(getAllStatuses());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/bots/:name', (req, res) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === req.params.name);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      const status: BotStatus = getBotStatus(bot);
      return res.json(status);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/logs/:botName', (req, res) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === req.params.botName);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      const logPath = path.resolve(bot.logs_dir, `${bot.name}.log`);
      if (!fs.existsSync(logPath)) {
        return res.status(404).send('Log file not found');
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.sendFile(logPath);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/diary/:botName', (req, res) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === req.params.botName);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      const diaryPath = path.resolve(bot.logs_dir, 'diary.md');
      if (!fs.existsSync(diaryPath)) {
        return res.status(404).send('Diary file not found');
      }

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.sendFile(diaryPath);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Serve activity JSON for chat/thoughts/tools stream
  app.get('/api/activity/:botName', (req, res) => {
    try {
      const botName = req.params.botName;
      const file = path.resolve('logs', `${botName}.activity.json`);
      if (!fs.existsSync(file)) {
        return res.status(404).json([]);
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.sendFile(file);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/texture/:itemName', (req, res) => {
    try {
      const itemName = String(req.params.itemName);
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
            const stream = fs.createReadStream(filePath);
            res.setHeader('Content-Type', 'image/png');
            return void stream.pipe(res);
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
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Length', String(buf.length));
            return void res.end(buf);
          }
        }
      }

      // Final fallback: try getImageContent by name
      try {
        const dataUrl = (assets as any).getImageContent?.(itemName);
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          const base64 = dataUrl.split(',')[1];
          const buf = Buffer.from(base64, 'base64');
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Length', String(buf.length));
          return void res.end(buf);
        }
      } catch {}

      return void res.status(404).json({ error: 'Texture not found' });
    } catch (error: any) {
      return void res.status(500).json({ error: error.message });
    }
  });

  // Debug helper for textures
  app.get('/api/texture-debug/:itemName', (req, res) => {
    const itemName = String(req.params.itemName);
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
      return void res.json(info);
    } catch (e: any) {
      info.error = e?.message || String(e);
      return void res.json(info);
    }
  });

  // Serve Timeline as the main view at '/'
  app.get('/', (_req, res) => {
    const timelinePath = path.resolve(__dirname, 'timeline.html');
    res.sendFile(timelinePath);
  });

  // Back-compat: keep /timeline but point to the same file
  app.get('/timeline', (_req, res) => {
    const timelinePath = path.resolve(__dirname, 'timeline.html');
    res.sendFile(timelinePath);
  });

  // Serve timeline JS
  app.get('/timeline.js', (_req, res) => {
    const timelineJsPath = path.resolve(__dirname, 'timeline.js');
    res.sendFile(timelineJsPath);
  });

  // Serve timeline test page
  app.get('/timeline-test', (_req, res) => {
    const testPath = path.resolve(__dirname, 'timeline-test.html');
    res.sendFile(testPath);
  });

  // Debug endpoint for timeline
  app.get('/api/timeline/debug', (_req, res) => {
    const db = new MasDatabase();
    const h = db.handle();
    
    const recentJobs = h.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 5').all();
    const recentSteps = h.prepare('SELECT * FROM job_steps ORDER BY id DESC LIMIT 10').all();
    
    res.json({
      jobs_count: recentJobs.length,
      steps_count: recentSteps.length,
      recent_jobs: recentJobs,
      recent_steps: recentSteps
    });
  });

  // API endpoint for bot events (for timeline)
  app.get('/api/bots/:name/events', (req, res) => {
    try {
      const botName = req.params.name;
      const limit = parseInt(req.query.limit as string) || 100;
      const before_ts = parseInt(req.query.before_ts as string) || Date.now();
      
      const db = new MasDatabase();
      const h = db.handle();
      
      // Combine jobs and steps into timeline events
      const events: any[] = [];
      
      // Get recent jobs
      const jobs = h.prepare(`
        SELECT j.*, jp.intent_type, jp.intent_args, jp.plan_mcrn, jp.plan_summary
        FROM jobs j
        LEFT JOIN jobs_payloads jp ON j.id = jp.job_id
        WHERE j.bot_id = ? AND j.created_at < ?
        ORDER BY j.created_at DESC
        LIMIT ?
      `).all(botName, before_ts, Math.floor(limit / 2));
      
      // Convert jobs to events
      jobs.forEach((job: any) => {
        // Job created event
        events.push({
          id: `job-${job.id}-created`,
          ts: job.created_at,
          bot_id: job.bot_id,
          type: 'job',
          payload: {
            job_id: job.id,
            phase: job.phase,
            state: job.state,
            kind: job.kind,
            priority: job.priority,
            intent_type: job.intent_type,
            intent_args: job.intent_args ? JSON.parse(job.intent_args) : null
          }
        });
        
        // Plan event if exists
        if (job.plan_mcrn) {
          events.push({
            id: `job-${job.id}-plan`,
            ts: job.started_at || job.created_at + 100,
            bot_id: job.bot_id,
            type: 'plan',
            payload: {
              job_id: job.id,
              plan_mcrn: job.plan_mcrn,
              plan_summary: job.plan_summary ? JSON.parse(job.plan_summary) : null
            }
          });
        }
      });
      
      // Get recent steps for these jobs
      if (jobs.length > 0) {
        const jobIds = jobs.map((j: any) => j.id);
        const placeholders = jobIds.map(() => '?').join(',');
        const steps = h.prepare(`
          SELECT * FROM job_steps
          WHERE job_id IN (${placeholders})
          ORDER BY id ASC
        `).all(...jobIds);
        
        // Convert steps to events
        steps.forEach((step: any) => {
          events.push({
            id: `step-${step.id}`,
            ts: step.ts,
            bot_id: botName,
            type: 'step',
            payload: {
              job_id: step.job_id,
              i: step.i,
              op: step.op,
              outcome: step.outcome,
              ms: step.ms,
              details: step.details ? JSON.parse(step.details) : null
            }
          });
        });
      }
      
      // Sort by timestamp and return
      // Include recent activity (chat/thinking/tools) from activity.json
      try {
        const activityPath = path.resolve('logs', `${botName}.activity.json`);
        if (fs.existsSync(activityPath)) {
          const raw = fs.readFileSync(activityPath, 'utf-8');
          const activity = JSON.parse(raw) as Array<any>;
          for (const a of activity) {
            const ts = Date.parse(a.timestamp || '') || Date.now();
            if (ts >= before_ts) continue; // respect before_ts window
            if (a.type === 'chat') {
              events.push({
                id: `chat-${ts}-${Math.random().toString(36).slice(2, 7)}`,
                ts,
                bot_id: botName,
                type: 'chat',
                payload: {
                  from: a.speaker || (a.role === 'bot' ? botName : 'player'),
                  text: a.message,
                  channel: 'chat',
                  direction: a.role === 'bot' ? 'out' : 'in'
                }
              });
            } else if (a.type === 'thinking') {
              events.push({
                id: `think-${ts}-${Math.random().toString(36).slice(2, 7)}`,
                ts,
                bot_id: botName,
                type: 'chat',
                payload: {
                  from: 'Planner',
                  text: a.message,
                  channel: 'system',
                  direction: 'out',
                  kind: 'thinking'
                }
              });
            } else if (a.type === 'tool') {
              // Tool execution summary
              const toolName = (a.message && String(a.message).startsWith('Tool:')) ? String(a.message).replace(/^Tool:\s*/, '') : (a.details?.name || 'tool');
              // Prefer output for summary if present; otherwise input
              const summary = a.details?.output ?? a.details?.input;
              let params_summary: any = summary;
              if (typeof summary === 'string') {
                try { params_summary = JSON.parse(summary); } catch { params_summary = summary; }
              }
              events.push({
                id: `tool-${ts}-${Math.random().toString(36).slice(2, 7)}`,
                ts,
                bot_id: botName,
                type: 'tool',
                payload: {
                  tool_name: toolName,
                  params_summary,
                  output: a.details?.output,
                  input: a.details?.input,
                  duration_ms: a.details?.duration_ms,
                  ok: true
                }
              });
            } else if (a.type === 'skill') {
              events.push({
                id: `skill-${ts}-${Math.random().toString(36).slice(2, 7)}`,
                ts,
                bot_id: botName,
                type: 'skill',
                payload: {
                  name: a.message,
                  description: a.details?.description || ''
                }
              });
            } else if (a.type === 'error' || a.type === 'warn' || a.type === 'info') {
              events.push({
                id: `evt-${ts}-${Math.random().toString(36).slice(2, 7)}`,
                ts,
                bot_id: botName,
                type: 'system',
                payload: { level: a.type, message: a.message }
              });
            }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to merge activity events:', (e as any)?.message || e);
      }

      events.sort((a, b) => a.ts - b.ts);
      res.json(events.slice(-limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Register MAS API endpoints
  registerMasRoutes(app);

  return app;
}

export function startDashboardServer(port: number) {
  const app = createDashboardApp();
  const server = http.createServer(app);

  // WebSocket for live MAS updates
  const wss = new WebSocketServer({ server, path: '/ws' });
  let lastStepId = 0;
  let lastJobsUpdatedAt = 0;
  const lastActivityTsByBot: Record<string, number> = {};

  wss.on('connection', (ws: WebSocket) => {
    ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }));
  });

  // Poll MAS DB for changes and broadcast
  const db = new MasDatabase();
  setInterval(() => {
    try {
      const h = db.handle();
      // New steps
      const steps = h
        .prepare('SELECT * FROM job_steps WHERE id > ? ORDER BY id ASC')
        .all(lastStepId);
      if (steps.length) {
        lastStepId = Math.max(
          lastStepId,
          ...steps.map((s: any) => Number(s.id) || 0)
        );
        const payloads = steps.map((s: any) => {
          // Get bot_id from job
          const job = h.prepare('SELECT bot_id FROM jobs WHERE id = ?').get(s.job_id);
          return {
            type: 'job_step',
            bot_id: job?.bot_id || 'unknown',
            job_id: s.job_id,
            i: s.i,
            ts: s.ts,
            op: s.op,
            outcome: s.outcome,
            ms: s.ms,
            details: s.details ? JSON.parse(s.details) : undefined,
          };
        });
        broadcast(wss, payloads);
      }

      // Updated jobs
      const jobs = h
        .prepare('SELECT * FROM jobs WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 100')
        .all(lastJobsUpdatedAt);
      if (jobs.length) {
        lastJobsUpdatedAt = Math.max(
          lastJobsUpdatedAt,
          ...jobs.map((j: any) => Number(j.updated_at) || 0)
        );
        const payloads = jobs.map((j: any) => ({ 
          type: 'job_update', 
          bot_id: j.bot_id,
          job: j 
        }));
        broadcast(wss, payloads);
      }

      // New activity items (chat/thinking/tool) from activity.json files
      try {
        const logsDir = path.resolve('logs');
        if (fs.existsSync(logsDir)) {
          const files = fs.readdirSync(logsDir).filter((f) => f.endsWith('.activity.json'));
          const messages: any[] = [];
          for (const file of files) {
            const botId = file.replace(/\.activity\.json$/, '');
            const baseTs = lastActivityTsByBot[botId] || 0;
            const raw = fs.readFileSync(path.join(logsDir, file), 'utf-8');
            const arr = JSON.parse(raw) as Array<any>;
            const nextItems = arr
              .map((a) => ({ a, ts: Date.parse(a.timestamp || '') || 0 }))
              .filter(({ ts }) => ts > baseTs)
              .sort((x, y) => x.ts - y.ts);
            if (nextItems.length) {
              lastActivityTsByBot[botId] = Math.max(baseTs, nextItems[nextItems.length - 1].ts);
              for (const { a, ts } of nextItems) {
                if (a.type === 'chat') {
                  messages.push({
                    type: 'chat',
                    bot_id: botId,
                    ts,
                    from: a.speaker || (a.role === 'bot' ? botId : 'player'),
                    text: a.message,
                    channel: 'chat',
                    direction: a.role === 'bot' ? 'out' : 'in',
                  });
                } else if (a.type === 'thinking') {
                  messages.push({
                    type: 'chat',
                    bot_id: botId,
                    ts,
                    from: 'Planner',
                    text: a.message,
                    channel: 'system',
                    direction: 'out',
                    kind: 'thinking',
                  });
                } else if (a.type === 'tool') {
                  const toolName = (a.message && String(a.message).startsWith('Tool:')) ? String(a.message).replace(/^Tool:\s*/, '') : (a.details?.name || 'tool');
                  const summary = a.details?.output ?? a.details?.input;
                  let params_summary: any = summary;
                  if (typeof summary === 'string') {
                    try { params_summary = JSON.parse(summary); } catch { params_summary = summary; }
                  }
                  messages.push({
                    type: 'tool',
                    bot_id: botId,
                    ts,
                    job_id: undefined,
                    ok: true,
                    tool_name: toolName,
                    params_summary,
                    output: a.details?.output,
                    input: a.details?.input,
                    duration_ms: a.details?.duration_ms,
                  });
                } else if (a.type === 'skill') {
                  messages.push({
                    type: 'skill',
                    bot_id: botId,
                    ts,
                    name: a.message,
                    description: a.details?.description || ''
                  });
                }
              }
            }
          }
          if (messages.length) {
            broadcast(wss, messages);
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Activity WS poll error:', (e as any)?.message || e);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('MAS WS poll error:', (e as any)?.message || e);
    }
  }, 1000);

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
