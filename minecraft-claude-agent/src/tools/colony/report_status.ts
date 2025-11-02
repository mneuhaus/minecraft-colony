import { Bot } from 'mineflayer';
import fs from 'fs';
import path from 'path';

export interface ReportStatusParams {
  include_inventory?: boolean;
  include_waypoints?: boolean;
  broadcast?: boolean;
}

interface BotStatus {
  bot_name: string;
  timestamp: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  health: number;
  food: number;
  inventory_summary: {
    total_items: number;
    occupied_slots: number;
    free_slots: number;
    key_items: string[];
  };
  current_task: string;
  status: 'idle' | 'working' | 'emergency' | 'offline';
}

/**
 * Report comprehensive bot status for colony coordination.
 * Creates a status report that can be shared with other bots or saved for tracking.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Configuration for status report
 * @returns Formatted status report string
 */
export async function report_status(
  bot: Bot,
  params: ReportStatusParams = {}
): Promise<string> {
  const {
    include_inventory = true,
    broadcast = false,
  } = params;

  try {
    const botName = process.env.BOT_NAME || bot.username || 'UnknownBot';

    // Gather position data
    const pos = bot.entity.position;
    const position = {
      x: Math.floor(pos.x),
      y: Math.floor(pos.y),
      z: Math.floor(pos.z),
    };

    // Gather health/food data
    const health = bot.health;
    const food = bot.food;

    // Gather inventory data
    const inventory = bot.inventory.items();
    const totalItems = inventory.reduce((sum, item) => sum + item.count, 0);
    const occupiedSlots = inventory.length;
    const freeSlots = 36 - occupiedSlots;

    // Identify key items (tools, food, building materials)
    const keyItemTypes = [
      'pickaxe',
      'axe',
      'shovel',
      'sword',
      '_log',
      'planks',
      'cobblestone',
      'stone',
      'coal',
      'iron',
      'beef',
      'pork',
      'chicken',
      'bread',
    ];

    const keyItems = inventory
      .filter((item) =>
        keyItemTypes.some((type) => item.name.includes(type))
      )
      .map((item) => `${item.name} x${item.count}`)
      .slice(0, 5); // Top 5 key items

    // Determine current status
    let status: 'idle' | 'working' | 'emergency' | 'offline' = 'idle';
    if (health < 6) {
      status = 'emergency';
    } else if (food < 6) {
      status = 'emergency';
    } else if (bot.pathfinder?.isMoving()) {
      status = 'working';
    }

    // Check for active task from messages or state
    let currentTask = 'None';
    try {
      const messagesDir = path.resolve(process.cwd(), 'messages');
      const inboxPath = path.join(messagesDir, `${botName}.json`);
      if (fs.existsSync(inboxPath)) {
        const messages = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
        const recentTask = messages
          .filter((m: any) => !m.read && m.message.includes('TASK:'))
          .sort((a: any, b: any) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0];
        if (recentTask) {
          currentTask = recentTask.message.replace('TASK:', '').trim().substring(0, 50);
        }
      }
    } catch (e) {
      // Ignore errors reading tasks
    }

    // Build status report
    const report: BotStatus = {
      bot_name: botName,
      timestamp: new Date().toISOString(),
      position,
      health,
      food,
      inventory_summary: {
        total_items: totalItems,
        occupied_slots: occupiedSlots,
        free_slots: freeSlots,
        key_items: keyItems,
      },
      current_task: currentTask,
      status,
    };

    // Save status to file for dashboard
    const logsDir = path.resolve(process.cwd(), 'logs');
    const statusPath = path.join(logsDir, `${botName}.state.json`);

    // Read existing state if available
    let existingState: any = {};
    if (fs.existsSync(statusPath)) {
      try {
        existingState = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Merge with existing state
    const updatedState = {
      ...existingState,
      ...report,
      last_status_update: new Date().toISOString(),
    };

    fs.writeFileSync(statusPath, JSON.stringify(updatedState, null, 2));

    // Format output
    const lines = [
      `=== ${botName} Status Report ===`,
      `Time: ${new Date().toLocaleString()}`,
      `Status: ${status.toUpperCase()}`,
      ``,
      `Health: ${health}/20 | Food: ${food}/20`,
      `Position: (${position.x}, ${position.y}, ${position.z})`,
      ``,
    ];

    if (include_inventory) {
      lines.push(`Inventory: ${totalItems} items (${occupiedSlots}/36 slots)`);
      lines.push(`Free slots: ${freeSlots}`);
      if (keyItems.length > 0) {
        lines.push(`Key items: ${keyItems.join(', ')}`);
      }
      lines.push(``);
    }

    lines.push(`Current task: ${currentTask}`);

    // Add status indicators
    if (health < 6) {
      lines.push(`�  CRITICAL: Health extremely low!`);
    } else if (health < 10) {
      lines.push(`�  WARNING: Health low`);
    }

    if (food < 6) {
      lines.push(`�  CRITICAL: Hunger extremely low!`);
    } else if (food < 10) {
      lines.push(`�  WARNING: Food low`);
    }

    if (freeSlots < 3) {
      lines.push(`�  WARNING: Inventory nearly full`);
    }

    // Broadcast if requested
    if (broadcast) {
      const summary = `${botName}: ${status} | Health ${health}/20 | Food ${food}/20 | Pos (${position.x},${position.y},${position.z})`;
      bot.chat(summary);
    }

    return lines.join('\n');

  } catch (error: any) {
    return `Failed to generate status report: ${error.message}`;
  }
}
