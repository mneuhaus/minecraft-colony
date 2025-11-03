// Full-cycle integration (Planner stub -> Tactician -> Executor)
// Planner stub uses the same enqueue function the MCP tool uses.
import path from 'path';
import fs from 'fs';
import { MasRuntime } from '../runtime.js';
import { enqueuePlannerJob } from '../planner.js';

class FakeInnerBot {
  username = 'TestBot';
  pathfinder = { goto: async (_goal: any) => {} };
  async lookAt(_vec3: any, _force: boolean) { /* no-op */ }
}

class FakeMinecraftBot {
  private inner = new FakeInnerBot();
  on(_evt: string, _cb: any) { /* no-op for this test */ }
  getBot() { return this.inner as any; }
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const dbDir = path.resolve('logs', 'mas-test');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, `planner-itest-${Date.now()}.db`);
  process.env.MAS_DB_PATH = dbPath;

  // Start MAS runtime workers (tactician + executor)
  const runtime = new MasRuntime(new FakeMinecraftBot() as any);
  runtime.start();

  // Planner stub enqueues a NAVIGATE WORLD intent using the same function as MCP tool
  const jobId = enqueuePlannerJob({
    bot_id: 'TestBot',
    priority: 'normal',
    intent: {
      type: 'NAVIGATE',
      args: { tolerance: 1 },
      target: { type: 'WORLD', x: 15, y: 70, z: 3 },
    },
  }, 'TestBot');

  // Wait for completion
  const start = Date.now();
  let success = false;
  while (Date.now() - start < 10000) {
    const { default: Better } = await import('better-sqlite3');
    const db = new (Better as any)(dbPath);
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
    db.close();
    if (row && row.phase === 'done' && row.state === 'success') { success = true; break; }
    await sleep(100);
  }

  runtime.stop();

  if (!success) {
    console.error('FAIL: Planner-cycle job did not complete.');
    process.exit(1);
  }
  console.log('PASS: Planner→Tactician→Executor cycle');
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
