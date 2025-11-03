import { MasDatabase } from './db.js';
import { JobQueue } from './queue.js';
import { EnqueueIntentRequest } from './types.js';

export function enqueuePlannerJob(req: EnqueueIntentRequest, defaultBotId: string): string {
  const db = new MasDatabase();
  const queue = new JobQueue(db);
  return queue.enqueueIntent(req, defaultBotId);
}

