import type { Express } from 'express';
import { MasDatabase } from './db.js';
import { JobQueue } from './queue.js';

export function registerMasRoutes(app: Express) {
  app.get('/api/jobs', (_req, res) => {
    try {
      const db = new MasDatabase();
      const rows = db
        .handle()
        .prepare(`SELECT id, bot_id, priority, kind, phase, state, created_at, updated_at, ended_at FROM jobs ORDER BY created_at DESC LIMIT 200`)
        .all();
      return void res.json(rows);
    } catch (e: any) {
      return void res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/jobs/:id', (req, res) => {
    try {
      const db = new MasDatabase();
      const queue = new JobQueue(db);
      const status = queue.getJobStatus(req.params.id);
      if (!status) return void res.status(404).json({ error: 'not_found' });
      return void res.json(status);
    } catch (e: any) {
      return void res.status(500).json({ error: e.message });
    }
  });

  // List steps for a job
  app.get('/api/jobs/:id/steps', (req, res) => {
    try {
      const db = new MasDatabase();
      const steps = db
        .handle()
        .prepare('SELECT id, i, ts, op, outcome, ms, details FROM job_steps WHERE job_id = ? ORDER BY i ASC')
        .all(req.params.id)
        .map((s: any) => ({ ...s, details: s.details ? JSON.parse(s.details) : undefined }));
      return void res.json(steps);
    } catch (e: any) {
      return void res.status(500).json({ error: e.message });
    }
  });

  // Job controls
  app.post('/api/jobs/:id/pause', (req, res) => {
    try {
      const db = new MasDatabase();
      const queue = new JobQueue(db);
      queue.pauseJob(req.params.id);
      return void res.json({ ok: true });
    } catch (e: any) {
      return void res.status(500).json({ error: e.message });
    }
  });
  app.post('/api/jobs/:id/resume', (req, res) => {
    try {
      const db = new MasDatabase();
      const queue = new JobQueue(db);
      queue.resumeJob(req.params.id);
      return void res.json({ ok: true });
    } catch (e: any) {
      return void res.status(500).json({ error: e.message });
    }
  });
  app.post('/api/jobs/:id/cancel', (req, res) => {
    try {
      const db = new MasDatabase();
      const queue = new JobQueue(db);
      queue.cancelJob(req.params.id);
      return void res.json({ ok: true });
    } catch (e: any) {
      return void res.status(500).json({ error: e.message });
    }
  });
}
