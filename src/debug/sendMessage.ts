import dotenv from 'dotenv';
import mineflayer from 'mineflayer';
import logger from '../logger.js';

dotenv.config();

const [, , ...args] = process.argv;
const message = args.join(' ').trim();

if (!message) {
  console.error('Usage: pnpm send "<message>"');
  process.exit(1);
}

const host = process.env.MC_HOST || 'localhost';
const port = parseInt(process.env.MC_PORT || '25565', 10);
const auth = process.env.MC_AUTH as 'offline' | 'mojang' | 'microsoft' | undefined;
const password = process.env.MC_PASSWORD;

if (Number.isNaN(port)) {
  console.error(`Invalid MC_PORT value: ${process.env.MC_PORT}`);
  process.exit(1);
}

const username =
  process.env.DEBUG_SENDER_USERNAME || `DebugConsole${Math.floor(Math.random() * 10000)}`;

logger.info('Debug chat sender connecting', { host, port, username, message });

const botOptions: any = {
  host,
  port,
  username,
  version: false as any,
};

if (auth) {
  botOptions.auth = auth;
}

if (password) {
  botOptions.password = password;
}

const debugBot = mineflayer.createBot(botOptions);

let sendTimeout: NodeJS.Timeout | null = null;
let disconnectTimeout: NodeJS.Timeout | null = null;
let spawnTimeout: NodeJS.Timeout | null = null;
let hasSpawned = false;
let messageSent = false;

const cleanup = (exitCode: number) => {
  if (sendTimeout) clearTimeout(sendTimeout);
  if (disconnectTimeout) clearTimeout(disconnectTimeout);
  if (spawnTimeout) clearTimeout(spawnTimeout);
  setTimeout(() => process.exit(exitCode), 0);
};

debugBot.once('spawn', () => {
  hasSpawned = true;
  logger.info('Debug chat sender spawned', {
    position: debugBot.entity?.position,
  });

  sendTimeout = setTimeout(() => {
    logger.info('Sending debug chat message');
    debugBot.chat(message);
    messageSent = true;

    // Give the server a moment to deliver the message before quitting
    disconnectTimeout = setTimeout(() => {
      logger.info('Debug chat sender disconnecting');
      debugBot.quit('Message sent');
    }, 1500);
  }, 500);
});

debugBot.once('end', () => {
  logger.info('Debug chat sender disconnected');
  if (!hasSpawned || !messageSent) {
    logger.error('Debug chat sender disconnected before message could be sent');
    cleanup(1);
    return;
  }
  cleanup(0);
});

debugBot.once('error', (error) => {
  logger.error('Debug chat sender encountered an error', { error: error.message });
  cleanup(1);
});

debugBot.on('kicked', (reason) => {
  logger.error('Debug chat sender was kicked', { reason });
  cleanup(1);
});

spawnTimeout = setTimeout(() => {
  if (!hasSpawned) {
    logger.error('Debug chat sender timed out waiting for spawn');
    debugBot.quit('Spawn timeout');
    cleanup(1);
  }
}, 20000);

// Failsafe in case spawn never happens
process.on('SIGINT', () => {
  logger.warn('Debug chat sender interrupted');
  debugBot.quit('Interrupted');
  cleanup(1);
});
