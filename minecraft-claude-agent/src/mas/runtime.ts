import { MasDatabase } from './db.js';
import { JobQueue } from './queue.js';
import { TacticianWorker } from './workers/tactician.js';
import { ExecutorWorker } from './workers/executor.js';
import { MinecraftBot } from '../bot/MinecraftBot.js';

export class MasRuntime {
  private db: MasDatabase;
  private queue: JobQueue;
  private tactician: TacticianWorker;
  private executor: ExecutorWorker;

  constructor(private bot: MinecraftBot) {
    this.db = new MasDatabase();
    this.queue = new JobQueue(this.db);
    this.tactician = new TacticianWorker(this.queue);
    this.executor = new ExecutorWorker(this.queue, this.bot);
  }

  start() {
    this.tactician.start();
    this.executor.start();
  }

  stop() {
    this.tactician.stop();
    this.executor.stop();
  }
}

