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
      const itemName = req.params.itemName;
      const item = assets.itemsByName[itemName];

      if (item?.textures?.length) {
        const texturePath = path.resolve(assets.texturePath, item.textures[0]);
        if (fs.existsSync(texturePath)) {
          res.setHeader('Content-Type', 'image/png');
          return res.sendFile(texturePath);
        }
      }

      const block = assets.blocksByName[itemName];
      if (block?.textures?.length) {
        const texturePath = path.resolve(assets.texturePath, block.textures[0]);
        if (fs.existsSync(texturePath)) {
          res.setHeader('Content-Type', 'image/png');
          return res.sendFile(texturePath);
        }
      }

      return res.status(404).json({ error: 'Texture not found' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Serve dashboard HTML
  app.get('/', (_req, res) => {
    const dashboardPath = path.resolve(__dirname, 'dashboard.html');
    res.sendFile(dashboardPath);
  });

  // Serve timeline HTML
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
