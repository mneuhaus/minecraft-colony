import { MinecraftBot } from '../../bot/MinecraftBot.js';

export interface FindWaterParams {
  maxDistance?: number; // Default: 64 blocks
  count?: number; // Max results, default: 5
  minDepth?: number; // Minimum water depth, default: 2 (for fishing/boats)
}

/**
 * Find water sources within radius. Returns coordinates and details.
 * ATOMIC TOOL: Only finds and reports locations - does not move.
 *
 * Design for blind bot:
 * - Returns exact coordinates for each water source
 * - Includes distance for navigation
 * - Reports depth (for fishing/boat suitability)
 * - Sorted by proximity
 */
export async function find_water(
  botWrapper: MinecraftBot,
  params: FindWaterParams = {}
): Promise<string> {
  const { maxDistance = 64, count = 5, minDepth = 2 } = params;
  const bot = botWrapper.getBot();

  try {
    const mcData = bot.registry;
    const waterBlock = mcData.blocksByName.water;

    if (!waterBlock) {
      return 'Error: Water block type not found in registry';
    }

    // Find water blocks
    const foundBlocks = bot.findBlocks({
      matching: waterBlock.id,
      maxDistance,
      count: count * 20, // Find many to check depth
    });

    if (foundBlocks.length === 0) {
      return `No water found within ${maxDistance} blocks.`;
    }

    const botPos = bot.entity.position;
    const waterSources: Array<{
      x: number;
      y: number;
      z: number;
      distance: number;
      depth: number;
    }> = [];

    // Check each water block for depth
    for (const pos of foundBlocks) {
      let depth = 0;
      let checkPos = pos.clone();

      // Check depth by looking down
      while (depth < 10) {
        checkPos = checkPos.offset(0, -1, 0);
        const block = bot.blockAt(checkPos);
        if (!block || block.name !== 'water') {
          break;
        }
        depth++;
      }

      if (depth >= minDepth) {
        const distance = Math.floor(botPos.distanceTo(pos));
        waterSources.push({
          x: pos.x,
          y: pos.y,
          z: pos.z,
          distance,
          depth,
        });
      }
    }

    // Sort by distance and limit
    waterSources.sort((a, b) => a.distance - b.distance);
    const topSources = waterSources.slice(0, count);

    if (topSources.length === 0) {
      return `No water sources with minimum depth ${minDepth} found within ${maxDistance} blocks.`;
    }

    // Format output
    const lines: string[] = [];
    lines.push(
      `Found ${topSources.length} water sources (depth ${minDepth}+) within ${maxDistance} blocks:`
    );
    lines.push('');

    topSources.forEach((source, index) => {
      const depthInfo = source.depth >= 10 ? '10+' : source.depth.toString();
      lines.push(
        `${index + 1}. Water at (${source.x}, ${source.y}, ${source.z}) - ${source.distance} blocks away, depth: ${depthInfo}`
      );
    });

    return lines.join('\n');
  } catch (error: any) {
    return `Error finding water: ${error.message}`;
  }
}
