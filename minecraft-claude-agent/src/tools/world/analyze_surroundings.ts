import { MinecraftBot } from '../../bot/MinecraftBot.js';

export interface AnalyzeSurroundingsParams {
  /**
   * Horizontal radius to scan (default: 8 blocks)
   */
  radius?: number;
  /**
   * Vertical range above/below to scan (default: 2 blocks)
   */
  verticalRange?: number;
}

/**
 * Analyze the density and composition of blocks surrounding the bot.
 *
 * This helps understand the environment:
 * - High density = enclosed cave/tunnel
 * - Low density = open area/surface
 * - Block types = terrain context (stone cave, sand desert, etc.)
 *
 * Returns spatial awareness data for intelligent decision making.
 */
export async function analyze_surroundings(
  bot: MinecraftBot,
  params: AnalyzeSurroundingsParams = {}
): Promise<string> {
  const { radius = 8, verticalRange = 2 } = params;
  const mineflayerBot = bot.getBot();

  if (!mineflayerBot) {
    return `Error: Bot not connected to server`;
  }

  try {
    const currentPos = mineflayerBot.entity.position.floored();

    // Track block counts
    const blockCounts: Record<string, number> = {};
    let totalBlocks = 0;
    let solidBlocks = 0;
    let airBlocks = 0;

    // Directional density (to detect tunnels vs caves)
    const directionalDensity = {
      north: 0, south: 0, east: 0, west: 0,
      above: 0, below: 0
    };

    // Scan in a cube around the bot
    for (let x = -radius; x <= radius; x++) {
      for (let y = -verticalRange; y <= verticalRange; y++) {
        for (let z = -radius; z <= radius; z++) {
          const checkPos = currentPos.offset(x, y, z);
          const block = mineflayerBot.blockAt(checkPos);

          if (!block) continue;

          totalBlocks++;
          const blockName = block.name;

          // Count block types
          blockCounts[blockName] = (blockCounts[blockName] || 0) + 1;

          if (blockName === 'air') {
            airBlocks++;
          } else {
            solidBlocks++;

            // Track directional density
            if (z < -radius/2) directionalDensity.north++;
            if (z > radius/2) directionalDensity.south++;
            if (x > radius/2) directionalDensity.east++;
            if (x < -radius/2) directionalDensity.west++;
            if (y > 0) directionalDensity.above++;
            if (y < 0) directionalDensity.below++;
          }
        }
      }
    }

    // Calculate density percentage
    const density = totalBlocks > 0 ? (solidBlocks / totalBlocks) * 100 : 0;

    // Sort blocks by frequency
    const sortedBlocks = Object.entries(blockCounts)
      .filter(([name]) => name !== 'air')
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Analyze environment type
    let environmentType = 'unknown';
    let confidence = '';

    if (density > 80) {
      environmentType = 'deep_underground';
      confidence = 'very enclosed - mostly solid blocks';
    } else if (density > 60) {
      environmentType = 'cave_or_tunnel';
      confidence = 'enclosed - significant solid blocks';
    } else if (density > 40) {
      environmentType = 'partially_enclosed';
      confidence = 'mixed - some open areas';
    } else if (density > 20) {
      environmentType = 'mostly_open';
      confidence = 'open area with some structures';
    } else {
      environmentType = 'open_area';
      confidence = 'very open - minimal solid blocks';
    }

    // Detect if it's a tunnel (high density in specific directions)
    const avgHorizontalDensity = (
      directionalDensity.north +
      directionalDensity.south +
      directionalDensity.east +
      directionalDensity.west
    ) / 4;

    const isTunnelLike = (
      Math.max(directionalDensity.north, directionalDensity.south) > avgHorizontalDensity * 1.5 ||
      Math.max(directionalDensity.east, directionalDensity.west) > avgHorizontalDensity * 1.5
    );

    if (isTunnelLike && density > 50) {
      environmentType = 'tunnel';
      confidence = 'linear enclosed space';
    }

    // Build result message
    const messages: string[] = [];
    messages.push(`=== SURROUNDINGS ANALYSIS ===`);
    messages.push(`Position: ${currentPos.toString()}`);
    messages.push(`Scan area: ${radius}x${radius} horizontal, ±${verticalRange} vertical`);
    messages.push(``);
    messages.push(`DENSITY: ${density.toFixed(1)}% solid`);
    messages.push(`- Solid blocks: ${solidBlocks}`);
    messages.push(`- Air blocks: ${airBlocks}`);
    messages.push(``);
    messages.push(`ENVIRONMENT: ${environmentType}`);
    messages.push(`- Assessment: ${confidence}`);
    messages.push(``);
    messages.push(`TOP BLOCK TYPES:`);

    for (const [blockName, count] of sortedBlocks) {
      const percentage = ((count / totalBlocks) * 100).toFixed(1);
      messages.push(`- ${blockName}: ${count} (${percentage}%)`);
    }

    messages.push(``);
    messages.push(`DIRECTIONAL DENSITY:`);
    messages.push(`- Above: ${directionalDensity.above} | Below: ${directionalDensity.below}`);
    messages.push(`- North: ${directionalDensity.north} | South: ${directionalDensity.south}`);
    messages.push(`- East: ${directionalDensity.east} | West: ${directionalDensity.west}`);

    // Add strategic recommendations
    messages.push(``);
    messages.push(`RECOMMENDATIONS:`);

    if (environmentType === 'deep_underground' || environmentType === 'cave_or_tunnel') {
      messages.push(`- You're enclosed. To reach open area, dig toward lowest density direction.`);

      // Find least dense direction
      const directions = [
        ['up', directionalDensity.above],
        ['down', directionalDensity.below],
        ['north', directionalDensity.north],
        ['south', directionalDensity.south],
        ['east', directionalDensity.east],
        ['west', directionalDensity.west],
      ].sort(([, a], [, b]) => (a as number) - (b as number));

      messages.push(`- Least dense direction: ${directions[0][0]} (${directions[0][1]} solid blocks)`);
    } else {
      messages.push(`- You're in an open area. Good for navigation and building.`);
    }

    return messages.join('\n');

  } catch (error: any) {
    return `Error analyzing surroundings: ${error.message}`;
  }
}
