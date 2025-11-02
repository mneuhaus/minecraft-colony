import { MinecraftBot } from '../../bot/MinecraftBot.js';
import { Vec3 } from 'vec3';

export interface DigBlockParams {
  x: number;
  y: number;
  z: number;
}

/**
 * Mine/dig a specific block at the given coordinates.
 * This is an atomic tool that ONLY breaks one block.
 *
 * The LLM should:
 * 1. Use find_block to locate blocks
 * 2. Use check_reachable to verify bot can reach the block
 * 3. Call this tool to break the block
 * 4. Use collect_nearby_items to collect drops
 *
 * @param x - X coordinate of block
 * @param y - Y coordinate of block
 * @param z - Z coordinate of block
 * @returns Success message or error
 */
export async function dig_block(
  bot: MinecraftBot,
  params: DigBlockParams
): Promise<string> {
  const { x, y, z } = params;
  const mineflayerBot = bot.getBot();

  if (!mineflayerBot) {
    return `Error: Bot not connected to server`;
  }

  try {
    const targetPos = new Vec3(x, y, z);
    const botPos = mineflayerBot.entity.position;
    const distance = botPos.distanceTo(targetPos);

    // Check if block is within reach
    if (distance > 5) {
      return `Error: Block at (${x}, ${y}, ${z}) is ${Math.floor(distance)} blocks away. Move closer (within 4.5 blocks) before digging.`;
    }

    // Get the block at target position
    const block = mineflayerBot.blockAt(targetPos);
    if (!block) {
      return `Error: No block found at (${x}, ${y}, ${z})`;
    }

    // Check if block is air (nothing to dig)
    if (block.name === 'air') {
      return `Error: Block at (${x}, ${y}, ${z}) is air - nothing to dig`;
    }

    const blockName = block.name;

    // Equip appropriate tool if available
    const tool = mineflayerBot.pathfinder.bestHarvestTool(block);
    if (tool) {
      await mineflayerBot.equip(tool, 'hand');
    }

    // Dig the block
    await mineflayerBot.dig(block);

    // Wait a moment for drops to spawn
    await new Promise(resolve => setTimeout(resolve, 100));

    return `Successfully mined ${blockName} at (${x}, ${y}, ${z}). Block broken, items should drop nearby. Use collect_nearby_items to pick them up.`;

  } catch (error: any) {
    return `Error mining block at (${x}, ${y}, ${z}): ${error.message}`;
  }
}
