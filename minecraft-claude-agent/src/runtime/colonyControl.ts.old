#!/usr/bin/env ts-node
import { loadConfig, startBots, stopBots, restartBots, BotConfig, getBotStatus } from './botControl.js';

type Mode = 'start-all' | 'stop-all' | 'restart-all' | 'start' | 'stop' | 'restart' | 'status';

function selectBots(allBots: BotConfig[], names?: string[]): BotConfig[] {
  if (!names || names.length === 0) return allBots;
  const map = new Map(allBots.map((bot) => [bot.name, bot]));
  return names.map((name) => {
    const bot = map.get(name);
    if (!bot) {
      throw new Error(`Bot '${name}' not defined in bots.yaml`);
    }
    return bot;
  });
}

function main() {
  const [modeArg, ...botNames] = process.argv.slice(2);
  if (!modeArg) {
    console.error('Usage: pnpm colony-ctl <mode> [botName ...]');
    console.error('Modes: start-all | stop-all | restart-all | start | stop | restart | status');
    process.exit(1);
  }

  const mode = modeArg as Mode;
  const bots = loadConfig();
  const selected = selectBots(bots, ['start-all', 'stop-all', 'restart-all'].includes(mode) ? undefined : botNames);

  switch (mode) {
    case 'start-all':
      startBots(bots);
      break;
    case 'stop-all':
      stopBots(bots);
      break;
    case 'restart-all':
      restartBots(bots);
      break;
    case 'start':
      startBots(selected);
      break;
    case 'stop':
      stopBots(selected);
      break;
    case 'restart':
      restartBots(selected);
      break;
    case 'status':
      const targets = botNames.length ? selected : bots;
      targets.forEach((bot) => {
        const status = getBotStatus(bot);
        const marker = status.running ? '●' : '○';
        const details = status.running
          ? `state=${status.connectionStatus}${status.timeSinceUpdate != null ? ` (${status.timeSinceUpdate}s)` : ''}`
          : 'stopped';
        console.log(`${marker} ${bot.name} (${bot.username}) – ${details}`);
      });
      break;
    default:
      console.error(`Unknown mode '${mode}'`);
      process.exit(1);
  }
}

main();
