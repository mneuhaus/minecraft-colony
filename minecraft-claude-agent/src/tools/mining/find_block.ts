import { MinecraftBot } from '../../bot/MinecraftBot.js';
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';

export interface FindBlockParams {
  blockType: string;
  maxDistance?: number;
  count?: number;
}

/**
 * Find blocks of a specific type within a given radius.
 * Returns coordinates and distances sorted by proximity.
 *
 * This is an atomic tool that ONLY finds blocks and returns data.
 * The LLM decides which block to mine based on distance and reachability.
 *
 * @param blockType - Block type to find (e.g. "stone", "coal_ore", "iron_ore")
 * @param maxDistance - Maximum search radius in blocks (default: 32)
 * @param count - Maximum number of blocks to return (default: 10)
 * @returns List of blocks with coordinates and distances
 */
export async function find_block(
  botWrapper: MinecraftBot,
  params: FindBlockParams
): Promise<string> {
  const { blockType, maxDistance = 32, count = 10 } = params;

  const bot = botWrapper.getBot();
  if (!bot) {
    return `Error: Bot not connected to server`;
  }

  try {
    const mcData = minecraftData(bot.version);
    const blockId = mcData.blocksByName[blockType]?.id;

    if (!blockId) {
      const availableBlocks = Object.keys(mcData.blocksByName)
        .filter(name => name.includes(blockType))
        .slice(0, 5);
      return `Error: Unknown block type "${blockType}". Did you mean: ${availableBlocks.join(', ')}?`;
    }

    const botPos = bot.entity.position;

    // Find blocks matching the type
    const blocks = bot.findBlocks({
      matching: blockId,
      maxDistance: maxDistance,
      count: count,
    });

    if (blocks.length === 0) {
      return `No ${blockType} blocks found within ${maxDistance} blocks. Try increasing search radius or moving to a different location.`;
    }

    // Calculate distances and sort by proximity
    const blocksWithDistance = blocks.map((pos: Vec3) => ({
      position: pos,
      distance: Math.floor(botPos.distanceTo(pos)),
    })).sort((a, b) => a.distance - b.distance);

    // Format output
    const blockList = blocksWithDistance
      .map((block, index) => {
        const { x, y, z } = block.position;
        return `${index + 1}. ${blockType} at (${x}, ${y}, ${z}) - ${block.distance} blocks away`;
      })
      .join('\n');

    return `Found ${blocks.length} ${blockType} block(s) within ${maxDistance} blocks. Nearest blocks:\n${blockList}`;

  } catch (error: any) {
    return `Error finding blocks: ${error.message}`;
  }
}
