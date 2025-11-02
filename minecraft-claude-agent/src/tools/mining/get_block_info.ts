import { MinecraftBot } from '../../bot/MinecraftBot.js';
import { Vec3 } from 'vec3';

export interface GetBlockInfoParams {
  x: number;
  y: number;
  z: number;
}

/**
 * Get detailed information about a block at specific coordinates.
 * Use this to identify what you're looking at before mining.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @returns Block information including type, hardness, and tool requirements
 */
export async function get_block_info(
  botWrapper: MinecraftBot,
  params: GetBlockInfoParams
): Promise<string> {
  const { x, y, z } = params;

  const bot = botWrapper.getBot();
  if (!bot) {
    return `Error: Bot not connected to server`;
  }

  try {
    const targetPos = new Vec3(x, y, z);
    const block = bot.blockAt(targetPos);

    if (!block) {
      return `No block found at (${x}, ${y}, ${z}) - position may be unloaded`;
    }

    const botPos = bot.entity.position;
    const distance = Math.floor(botPos.distanceTo(targetPos));

    // Get block properties
    const info = [
      `Block at (${x}, ${y}, ${z}):`,
      `  Type: ${block.name}`,
      `  Distance: ${distance} blocks away`,
    ];

    if (block.hardness !== undefined) {
      info.push(`  Hardness: ${block.hardness}`);
    }

    // Check if block can be harvested with current tool
    const currentTool = bot.heldItem;
    if (currentTool) {
      info.push(`  Current tool: ${currentTool.name}`);
    } else {
      info.push(`  Current tool: empty hand`);
    }

    // Check best tool for this block
    const bestTool = bot.pathfinder.bestHarvestTool(block);
    if (bestTool) {
      info.push(`  Best tool: ${bestTool.name} (in inventory)`);
    } else if (block.harvestTools) {
      const toolTypes = Object.keys(block.harvestTools);
      if (toolTypes.length > 0) {
        info.push(`  Requires tool: ${toolTypes.join(', ')} (not in inventory)`);
      }
    }

    // Check if reachable
    if (distance <= 4.5) {
      info.push(`  Status: Within reach - can mine immediately`);
    } else {
      info.push(`  Status: Out of reach - move closer to mine`);
    }

    return info.join('\n');

  } catch (error: any) {
    return `Error getting block info at (${x}, ${y}, ${z}): ${error.message}`;
  }
}
