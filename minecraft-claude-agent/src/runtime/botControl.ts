import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

export interface BotConfig {
  name: string;
  username: string;
  logs_dir: string;
  viewer_port?: number | null;
  env?: Record<string, string>;
  backstory?: string;
}

interface ConfigFile {
  bots: BotConfig[];
}

export interface BotStatus {
  name: string;
  username: string;
  running: boolean;
  connected?: boolean;
  connectionStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
  timeSinceUpdate?: number;
  position?: { x: number; y: number; z: number };
  health?: number;
  food?: number;
  gameMode?: string;
  inventory?: Array<{ name: string; count: number }>;
  viewerUrl?: string;
  lastUpdate?: string;
  errorMessage?: string;
  // Latest TodoWrite summary extracted from activity log
  todo?: Array<{ content: string; status?: string; done?: boolean }>;
  todoProgress?: { done: number; total: number };
}

const CONFIG_PATH = process.env.BOTS_CONFIG || 'bots.yaml';
const PNPM_CMD = process.env.PNPM_CMD || 'pnpm';
const BOT_CMD = process.env.BOT_CMD || 'start';

export function loadConfig(): BotConfig[] {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = yaml.parse(raw) as ConfigFile;
  if (!parsed?.bots || !Array.isArray(parsed.bots)) {
    throw new Error(`Invalid config: expected 'bots' array in ${CONFIG_PATH}`);
  }
  return parsed.bots;
}

function ensureDirs(bot: BotConfig) {
  const base = path.resolve(bot.logs_dir);
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(path.resolve(base, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.resolve(base, 'pids'), { recursive: true });
  fs.mkdirSync(path.resolve('logs'), { recursive: true }); // for shared state files
}

function pidFile(bot: BotConfig) {
  return path.resolve(bot.logs_dir, 'pids', `${bot.name}.pid`);
}

function logFile(bot: BotConfig) {
  return path.resolve(bot.logs_dir, `${bot.name}.log`);
}

function buildEnv(bot: BotConfig) {
  const env = { ...process.env, ...bot.env } as Record<string, string>;
  env.MC_USERNAME = bot.username;
  env.LOG_LEVEL = env.LOG_LEVEL || 'debug';
  env.DISABLE_VIEWER = bot.viewer_port ? 'false' : 'true';
  if (bot.viewer_port) {
    env.VIEWER_PORT = String(bot.viewer_port);
  } else {
    delete env.VIEWER_PORT;
  }
  env.LOG_PATH = logFile(bot);
  env.DIARY_PATH = path.resolve(bot.logs_dir, 'diary.md');
  if (bot.backstory) {
    env.BOT_BACKSTORY = bot.backstory;
  }
  return env;
}

export function isBotRunning(bot: BotConfig): boolean {
  const pidPath = pidFile(bot);
  if (!fs.existsSync(pidPath)) return false;
  try {
    const pid = Number(fs.readFileSync(pidPath, 'utf-8'));
    if (!pid) return false;
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    if (err.code === 'ESRCH') return false;
    return false;
  }
}

export function startBot(bot: BotConfig): ChildProcess | null {
  ensureDirs(bot);
  const pidPath = pidFile(bot);
  if (isBotRunning(bot)) {
    console.log(`[${bot.name}] already running.`);
    return null;
  }

  const env = buildEnv(bot);
  const outPath = logFile(bot);
  const outStream = fs.createWriteStream(outPath, { flags: 'a' });
  outStream.write(`\n---\nStarting ${bot.name} @ ${new Date().toISOString()}\n`);

  const child = spawn(PNPM_CMD, [BOT_CMD], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  child.stdout?.pipe(outStream, { end: false });
  child.stderr?.pipe(outStream, { end: false });

  fs.writeFileSync(pidPath, String(child.pid));
  console.log(`[${bot.name}] started (PID ${child.pid}) → ${outPath}`);

  child.on('exit', (code, signal) => {
    console.log(`[${bot.name}] exited with code=${code} signal=${signal}`);
    if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
    outStream.write(`\n---\n${bot.name} exited at ${new Date().toISOString()} (code=${code}, signal=${signal})\n`);
    outStream.end();
  });

  child.unref();
  return child;
}

export function stopBot(bot: BotConfig) {
  const pidPath = pidFile(bot);
  if (!fs.existsSync(pidPath)) {
    console.log(`[${bot.name}] not running.`);
    return;
  }
  const pid = Number(fs.readFileSync(pidPath, 'utf-8'));
  if (!pid) {
    fs.unlinkSync(pidPath);
    console.warn(`[${bot.name}] invalid PID file removed.`);
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`[${bot.name}] sent SIGTERM to PID ${pid}`);
  } catch (err) {
    console.warn(`[${bot.name}] failed to stop PID ${pid}:`, err);
  } finally {
    fs.unlinkSync(pidPath);
  }
}

export async function startBots(bots: BotConfig[]): Promise<void> {
  const STARTUP_DELAY_MS = 3000; // 3 second delay between each bot
  for (let i = 0; i < bots.length; i++) {
    startBot(bots[i]);
    if (i < bots.length - 1) {
      // Don't wait after the last bot
      await new Promise(resolve => setTimeout(resolve, STARTUP_DELAY_MS));
    }
  }
}

export function stopBots(bots: BotConfig[]): void {
  bots.forEach(stopBot);
}

export function restartBots(bots: BotConfig[]): void {
  bots.forEach((bot) => {
    stopBot(bot);
    startBot(bot);
  });
}

export function getBotStatus(bot: BotConfig): BotStatus {
  const status: BotStatus = {
    name: bot.name,
    username: bot.username,
    running: isBotRunning(bot),
    viewerUrl: bot.viewer_port ? `http://localhost:${bot.viewer_port}` : undefined,
    connectionStatus: 'disconnected',
    connected: false,
  };

  if (!status.running) {
    status.connectionStatus = 'disconnected';
    return status;
  }

  try {
    const stateFilePath = path.resolve('logs', `${bot.name}.state.json`);
    if (fs.existsSync(stateFilePath)) {
      const stateData = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
      status.position = stateData.position;
      status.health = stateData.health;
      status.food = stateData.food;
      status.gameMode = stateData.gameMode;
      status.inventory = stateData.inventory || [];
      status.lastUpdate = stateData.lastUpdate;

      if (stateData.lastUpdate) {
        const lastUpdate = new Date(stateData.lastUpdate).getTime();
        const now = Date.now();
        status.timeSinceUpdate = Math.floor((now - lastUpdate) / 1000);

        if (status.timeSinceUpdate < 10) {
          status.connectionStatus = 'connected';
          status.connected = true;
        } else if (status.timeSinceUpdate < 60) {
          status.connectionStatus = 'connecting';
          status.connected = false;
        } else {
          status.connectionStatus = 'error';
          status.connected = false;
          status.errorMessage = `No updates for ${status.timeSinceUpdate}s`;
        }
      } else {
        status.connectionStatus = 'connecting';
      }
    } else {
      status.connectionStatus = 'connecting';
    }

    // Read latest TodoWrite from activity
    try {
      const activityPath = path.resolve('logs', `${bot.name}.activity.json`);
      if (fs.existsSync(activityPath)) {
        const activity = JSON.parse(fs.readFileSync(activityPath, 'utf-8')) as Array<any>;
        // ActivityWriter unshifts newest first; scan until we find a todo tool
        const item = activity.find((a) => {
          if (!a || a.type !== 'tool') return false;
          const msg = String(a.message || '');
          const name = (a.details?.toolName || '').toString();
          return /todo/i.test(msg) || /todo/i.test(name);
        });
        if (item) {
          let payload: any = item.details?.output ?? item.details?.input;
          if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { /* ignore */ }
          }
          const todos = Array.isArray(payload?.todos) ? payload.todos : [];
          if (todos.length) {
            const done = todos.filter((t: any) => String(t?.status || '').toLowerCase() === 'completed' || t?.done === true).length;
            status.todoProgress = { done, total: todos.length };
            status.todo = todos.slice(0, 4).map((t: any) => ({
              content: String(t?.content || t?.title || ''),
              status: t?.status,
              done: String(t?.status || '').toLowerCase() === 'completed' || t?.done === true,
            }));
          }
        }
      }
    } catch (e) {
      // Best-effort; do not fail status
    }
  } catch (error) {
    console.error(`Error reading status for ${bot.name}:`, error);
    status.connectionStatus = 'error';
    status.errorMessage = String(error);
  }

  return status;
}

export function getAllStatuses(): BotStatus[] {
  const bots = loadConfig();
  return bots.map(getBotStatus);
}
