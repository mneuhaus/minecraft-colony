import { MinecraftBot } from '../../bot/MinecraftBot.js';
import { Vec3 } from 'vec3';

export interface FindFlatAreaParams {
  minSize?: number; // Minimum flat area size (blocks), default: 5x5
  maxDistance?: number; // Search radius, default: 32
  count?: number; // Max results, default: 3
}

/**
 * Find flat areas suitable for building. Returns coordinates and dimensions.
 * ATOMIC TOOL: Only finds and reports locations - does not build.
 *
 * Design for blind bot:
 * - Returns exact coordinates of flat area centers
 * - Reports dimensions (how large the flat area is)
 * - Includes distance for navigation
 * - Useful for placing structures
 */
export async function find_flat_area(
  botWrapper: MinecraftBot,
  params: FindFlatAreaParams = {}
): Promise<string> {
  const { minSize = 5, maxDistance = 32, count = 3 } = params;
  const bot = botWrapper.getBot();

  try {
    const botPos = bot.entity.position;
    const flatAreas: Array<{
      x: number;
      y: number;
      z: number;
      distance: number;
      width: number;
      length: number;
    }> = [];

    // Sample locations in a grid pattern
    const sampleInterval = 4; // Check every 4 blocks
    for (
      let x = Math.floor(botPos.x) - maxDistance;
      x <= Math.floor(botPos.x) + maxDistance;
      x += sampleInterval
    ) {
      for (
        let z = Math.floor(botPos.z) - maxDistance;
        z <= Math.floor(botPos.z) + maxDistance;
        z += sampleInterval
      ) {
        // Find ground level at this X,Z
        let y = Math.floor(botPos.y);
        let foundGround = false;

        // Look down for solid ground
        for (let dy = 0; dy < 20; dy++) {
          const checkPos = new Vec3(x, y - dy, z);
          const block = bot.blockAt(checkPos);
          const aboveBlock = bot.blockAt(checkPos.offset(0, 1, 0));

          if (block && block.boundingBox === 'block' && aboveBlock && aboveBlock.name === 'air') {
            y = checkPos.y;
            foundGround = true;
            break;
          }
        }

        if (!foundGround) continue;

        // Check if this location has a flat area
        const { isFlat, width, length } = checkFlatness(bot, x, y, z, minSize);

        if (isFlat) {
          const distance = Math.floor(
            botPos.distanceTo(new Vec3(x, y, z))
          );
          flatAreas.push({ x, y: y + 1, z, distance, width, length });
        }
      }
    }

    // Sort by distance and limit
    flatAreas.sort((a, b) => a.distance - b.distance);
    const topAreas = flatAreas.slice(0, count);

    if (topAreas.length === 0) {
      return `No flat areas (${minSize}x${minSize}+) found within ${maxDistance} blocks.`;
    }

    // Format output
    const lines: string[] = [];
    lines.push(
      `Found ${topAreas.length} flat areas (${minSize}x${minSize}+) within ${maxDistance} blocks:`
    );
    lines.push('');

    topAreas.forEach((area, index) => {
      lines.push(
        `${index + 1}. Flat area at (${area.x}, ${area.y}, ${area.z}) - ${area.distance} blocks away, size: ${area.width}x${area.length}`
      );
    });

    return lines.join('\n');
  } catch (error: any) {
    return `Error finding flat areas: ${error.message}`;
  }
}

/**
 * Check if an area is flat by sampling blocks
 */
function checkFlatness(
  bot: any,
  centerX: number,
  baseY: number,
  centerZ: number,
  minSize: number
): { isFlat: boolean; width: number; length: number } {
  let width = 0;
  let length = 0;

  // Check area around center point
  for (let dx = 0; dx < minSize; dx++) {
    for (let dz = 0; dz < minSize; dz++) {
      const checkPos = new Vec3(centerX + dx, baseY, centerZ + dz);
      const block = bot.blockAt(checkPos);
      const aboveBlock = bot.blockAt(checkPos.offset(0, 1, 0));
      const above2Block = bot.blockAt(checkPos.offset(0, 2, 0));

      // Must have solid block at base, air above
      if (
        !block ||
        block.boundingBox !== 'block' ||
        !aboveBlock ||
        aboveBlock.name !== 'air' ||
        !above2Block ||
        above2Block.name !== 'air'
      ) {
        return { isFlat: false, width: 0, length: 0 };
      }
    }
  }

  // Area is flat! Measure actual size
  width = minSize;
  length = minSize;

  return { isFlat: true, width, length };
}
