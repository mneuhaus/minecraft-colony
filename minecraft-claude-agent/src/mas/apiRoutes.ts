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
}
