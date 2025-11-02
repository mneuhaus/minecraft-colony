import fs from 'fs';
import path from 'path';

interface BotState {
  position: { x: number; y: number; z: number };
  health: number;
  food: number;
  gameMode: string;
  inventory: Array<{ name: string; count: number }>;
}

/**
 * Write bot state to a JSON file for dashboard consumption
 */
export function writeStateFile(botName: string, logsDir: string, state: BotState | null): void {
  if (!state) return;

  const stateFilePath = path.resolve(logsDir, `${botName}.state.json`);

  try {
    const stateData = {
      ...state,
      lastUpdate: new Date().toISOString(),
    };

    fs.writeFileSync(stateFilePath, JSON.stringify(stateData, null, 2));
  } catch (error) {
    // Silently fail - don't crash bot if state write fails
    console.error(`Failed to write state file for ${botName}:`, error);
  }
}
