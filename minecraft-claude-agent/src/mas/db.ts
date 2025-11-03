import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class MasDatabase {
  private db: Database.Database;

  constructor(dbPath = path.resolve('logs', 'mas', 'mas.db')) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        bot_id TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        kind TEXT NOT NULL CHECK(kind IN ('intent','program')),
        phase TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        updated_at INTEGER NOT NULL,
        ended_at INTEGER,
        lease_until INTEGER,
        error TEXT
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs_payloads (
        job_id TEXT PRIMARY KEY,
        intent_type TEXT,
        intent_args TEXT,
        constraints TEXT,
        plan_mcrn TEXT,
        plan_summary TEXT,
        FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS job_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        i INTEGER NOT NULL,
        ts INTEGER NOT NULL,
        op TEXT NOT NULL,
        outcome TEXT NOT NULL,
        ms INTEGER NOT NULL,
        details TEXT,
        FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(phase, state, priority, updated_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_lease ON jobs(lease_until);
      CREATE INDEX IF NOT EXISTS idx_job_steps_job ON job_steps(job_id);
    `);
  }

  handle(): any {
    return this.db;
  }
}

export function now(): number {
  return Date.now();
}
