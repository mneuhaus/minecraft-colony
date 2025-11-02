#!/usr/bin/env ts-node
/**
 * Unified Run Command - Minecraft Claude Agent
 *
 * This command integrates:
 * - Bot management (start/stop/restart)
 * - Dashboard server
 * - Health monitoring and auto-restart
 * - Connection status tracking
 * - Auto-cleanup of idle/broken bots
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

interface BotConfig {
  name: string;
  username: string;
  logs_dir: string;
  viewer_port?: number | null;
  env?: Record<string, string>;
}

interface ConfigFile {
  bots: BotConfig[];
}

interface BotHealth {
  pid: number;
  startTime: number;
  lastStateUpdate?: number;
  consecutiveFailures: number;
  isConnected: boolean;
  lastError?: string;
}

const CONFIG_PATH = process.env.BOTS_CONFIG || 'bots.yaml';
const PNPM_CMD = process.env.PNPM_CMD || 'pnpm';
const BOT_CMD = process.env.BOT_CMD || 'start';
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 4242;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_CONSECUTIVE_FAILURES = 3;
const IDLE_TIMEOUT = 300000; // 5 minutes without state updates = idle
const AUTO_RESTART = process.env.AUTO_RESTART !== 'false';

const botHealthMap = new Map<string, BotHealth>();
let dashboardProcess: ChildProcess | null = null;

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function loadConfig(): ConfigFile {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = yaml.parse(raw);
  if (!parsed?.bots || !Array.isArray(parsed.bots)) {
    throw new Error(`Invalid config: expected 'bots' array in ${CONFIG_PATH}`);
  }
  return parsed as ConfigFile;
}

function ensureDirs(bot: BotConfig) {
  const base = path.resolve(bot.logs_dir);
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(path.resolve(base, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.resolve(base, 'pids'), { recursive: true });
  fs.mkdirSync(path.resolve('logs'), { recursive: true }); // For state files
}

function pidFile(bot: BotConfig): string {
  return path.resolve(bot.logs_dir, 'pids', `${bot.name}.pid`);
}

function stateFile(botName: string): string {
  return path.resolve('logs', `${botName}.state.json`);
}

function logFile(bot: BotConfig): string {
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
  return env;
}

function isRunning(pidPath: string): boolean {
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

function stopBot(bot: BotConfig, reason?: string) {
  const pidPath = pidFile(bot);
  if (!isRunning(pidPath)) {
    if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
    botHealthMap.delete(bot.name);
    return;
  }

  const pid = Number(fs.readFileSync(pidPath, 'utf-8'));
  const logReason = reason ? ` (${reason})` : '';

  try {
    process.kill(pid, 'SIGTERM');
    log(`${bot.name} stopped${logReason}`, 'yellow');
  } catch (err) {
    log(`${bot.name} failed to stop PID ${pid}: ${err}`, 'red');
  } finally {
    if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
    botHealthMap.delete(bot.name);
  }
}

function startBot(bot: BotConfig, isRestart: boolean = false) {
  ensureDirs(bot);
  const pidPath = pidFile(bot);

  if (isRunning(pidPath)) {
    log(`${bot.name} already running`, 'yellow');
    return;
  }

  const env = buildEnv(bot);
  const outPath = logFile(bot);
  const outStream = fs.createWriteStream(outPath, { flags: 'a' });
  const action = isRestart ? 'Restarting' : 'Starting';
  outStream.write(`\n---\n${action} ${bot.name} @ ${new Date().toISOString()}\n`);

  const child = spawn(PNPM_CMD, [BOT_CMD], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  child.stdout?.pipe(outStream, { end: false });
  child.stderr?.pipe(outStream, { end: false });

  fs.writeFileSync(pidPath, String(child.pid));

  // Initialize health tracking
  botHealthMap.set(bot.name, {
    pid: child.pid!,
    startTime: Date.now(),
    consecutiveFailures: 0,
    isConnected: false,
  });

  log(`${bot.name} started (PID ${child.pid})`, 'green');

  child.on('exit', (code, signal) => {
    const health = botHealthMap.get(bot.name);
    const runtime = health ? Math.floor((Date.now() - health.startTime) / 1000) : 0;

    log(`${bot.name} exited (code=${code}, signal=${signal}, runtime=${runtime}s)`, 'red');

    if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
    outStream.write(`\n---\n${bot.name} exited at ${new Date().toISOString()} (code=${code}, signal=${signal})\n`);
    outStream.end();

    // Auto-restart if crashed quickly (< 30 seconds)
    if (AUTO_RESTART && code !== 0 && runtime < 30) {
      const failures = (health?.consecutiveFailures || 0) + 1;
      if (failures < MAX_CONSECUTIVE_FAILURES) {
        log(`${bot.name} will auto-restart (attempt ${failures}/${MAX_CONSECUTIVE_FAILURES})`, 'yellow');
        setTimeout(() => {
          startBot(bot, true);
          if (health) {
            health.consecutiveFailures = failures;
          }
        }, 5000); // Wait 5 seconds before restart
      } else {
        log(`${bot.name} failed ${MAX_CONSECUTIVE_FAILURES} times, NOT restarting`, 'red');
        botHealthMap.delete(bot.name);
      }
    } else {
      botHealthMap.delete(bot.name);
    }
  });

  child.unref();
}

function checkBotHealth(bot: BotConfig) {
  const health = botHealthMap.get(bot.name);
  if (!health) return; // Not tracked or not running

  const statePath = stateFile(bot.name);

  // Check if bot is still running
  if (!isRunning(pidFile(bot))) {
    log(`${bot.name} process not running`, 'red');
    botHealthMap.delete(bot.name);
    return;
  }

  // Check state file for connection status
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      const lastUpdate = new Date(state.lastUpdate).getTime();
      const now = Date.now();
      const timeSinceUpdate = now - lastUpdate;

      health.lastStateUpdate = lastUpdate;
      health.isConnected = timeSinceUpdate < 60000; // Connected if updated within last minute

      // Check for idle bots (no updates for 5 minutes while running)
      if (timeSinceUpdate > IDLE_TIMEOUT) {
        health.consecutiveFailures++;
        log(`${bot.name} appears idle (${Math.floor(timeSinceUpdate/1000)}s since last update)`, 'yellow');

        if (health.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          log(`${bot.name} idle too long, stopping...`, 'red');
          stopBot(bot, 'idle timeout');
          if (AUTO_RESTART) {
            setTimeout(() => startBot(bot, true), 5000);
          }
        }
      } else {
        health.consecutiveFailures = 0; // Reset on successful update
      }
    } catch (error) {
      health.consecutiveFailures++;
      log(`${bot.name} state file read error: ${error}`, 'red');
    }
  } else {
    // No state file yet - give it some time (30 seconds)
    const runtime = Date.now() - health.startTime;
    if (runtime > 30000) {
      health.consecutiveFailures++;
      log(`${bot.name} no state file after ${Math.floor(runtime/1000)}s`, 'yellow');

      if (health.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        log(`${bot.name} never connected, stopping...`, 'red');
        stopBot(bot, 'connection failure');
      }
    }
  }
}

function startDashboard() {
  log('Starting dashboard...', 'cyan');

  dashboardProcess = spawn(PNPM_CMD, ['run', 'dashboard'], {
    cwd: process.cwd(),
    env: { ...process.env, DASHBOARD_PORT: String(DASHBOARD_PORT) },
    stdio: 'inherit',
  });

  dashboardProcess.on('exit', (code) => {
    log(`Dashboard exited with code ${code}`, 'red');
    dashboardProcess = null;
  });

  log(`Dashboard available at http://localhost:${DASHBOARD_PORT}`, 'green');
}

function stopDashboard() {
  if (dashboardProcess) {
    log('Stopping dashboard...', 'yellow');
    dashboardProcess.kill('SIGTERM');
    dashboardProcess = null;
  }
}

function printStatus(config: ConfigFile) {
  console.log('\n' + '='.repeat(80));
  log('Minecraft Claude Agent Status', 'bright');
  console.log('='.repeat(80));

  for (const bot of config.bots) {
    const health = botHealthMap.get(bot.name);
    const running = isRunning(pidFile(bot));

    if (running && health) {
      const runtime = Math.floor((Date.now() - health.startTime) / 1000);
      const status = health.isConnected ? 'CONNECTED' : 'STARTING...';
      const color = health.isConnected ? 'green' : 'yellow';
      const failures = health.consecutiveFailures > 0 ? ` [failures: ${health.consecutiveFailures}]` : '';
      log(`${bot.name}: ${status} (${runtime}s)${failures}`, color);
    } else if (running) {
      log(`${bot.name}: RUNNING (no health data)`, 'yellow');
    } else {
      log(`${bot.name}: STOPPED`, 'red');
    }
  }

  console.log('='.repeat(80) + '\n');
}

function main() {
  log('='.repeat(40), 'bright');
  log('  Minecraft Claude Agent', 'bright');
  log('  Unified Management System', 'bright');
  log('='.repeat(40), 'bright');

  const config = loadConfig();

  // Start all bots
  log('Starting bots...', 'cyan');
  config.bots.forEach((bot) => startBot(bot));

  // Start dashboard
  startDashboard();

  // Start health monitoring
  log('Health monitoring enabled', 'cyan');
  const healthCheckInterval = setInterval(() => {
    config.bots.forEach(checkBotHealth);
  }, HEALTH_CHECK_INTERVAL);

  // Print status every minute
  const statusInterval = setInterval(() => {
    printStatus(config);
  }, 60000);

  // Initial status
  setTimeout(() => printStatus(config), 5000);

  // Graceful shutdown
  const shutdown = () => {
    log('Shutting down...', 'yellow');
    clearInterval(healthCheckInterval);
    clearInterval(statusInterval);

    config.bots.forEach((bot) => stopBot(bot, 'shutdown'));
    stopDashboard();

    log('Shutdown complete', 'green');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log('System started successfully', 'green');
  log(`Dashboard: http://localhost:${DASHBOARD_PORT}`, 'cyan');
  log('Press Ctrl+C to stop', 'cyan');
}

main();
