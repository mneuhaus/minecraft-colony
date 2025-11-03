// Integration test for MAS core: enqueue intent → tactician compiles → executor runs
import path from 'path';
import fs from 'fs';
import { MasDatabase } from '../db.js';
import { JobQueue } from '../queue.js';
import { TacticianWorker } from '../workers/tactician.js';
import { ExecutorWorker } from '../workers/executor.js';

class FakeInnerBot {
  username = 'TestBot';
  pathfinder = { goto: async (_goal: any) => {} };
  async lookAt(_vec3: any, _force: boolean) { /* no-op */ }
}

class FakeMinecraftBot {
  private inner = new FakeInnerBot();
  getBot() { return this.inner; }
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  const dbDir = path.resolve('logs', 'mas-test');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, `itest-${Date.now()}.db`);

  const db = new MasDatabase(dbPath);
  const queue = new JobQueue(db);

  const tactician = new TacticianWorker(queue);
  const executor = new ExecutorWorker(queue as any, new FakeMinecraftBot() as any);
  tactician.start();
  executor.start();

  const jobId = queue.enqueueIntent(
    {
      bot_id: 'TestBot',
      priority: 'normal',
      intent: {
        type: 'NAVIGATE',
        args: { tolerance: 1 },
        target: { type: 'WORLD', x: 10, y: 70, z: -5 },
      },
    },
    'TestBot'
  );

  const start = Date.now();
  let status;
  while (Date.now() - start < 10000) {
    status = queue.getJobStatus(jobId);
    if (status && status.state === 'success' && status.phase === 'done') break;
    await sleep(100);
  }

  tactician.stop();
  executor.stop();

  if (!status) {
    console.error('FAIL: No status for job');
    process.exit(1);
  }
  if (!(status.state === 'success' && status.phase === 'done')) {
    console.error('FAIL: Job did not complete successfully', status);
    process.exit(1);
  }

  // Verify at least one step recorded
  const steps = db
    .handle()
    .prepare('SELECT * FROM job_steps WHERE job_id = ? ORDER BY i ASC')
    .all(jobId);
  if (!steps || steps.length === 0) {
    const payload = db
      .handle()
      .prepare('SELECT plan_mcrn FROM jobs_payloads WHERE job_id = ?')
      .get(jobId) as any;
    console.error('FAIL: No job steps recorded. Plan was:', payload?.plan_mcrn);
    process.exit(1);
  }

  console.log('PASS: MAS integration (NAVIGATE WORLD)');
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
