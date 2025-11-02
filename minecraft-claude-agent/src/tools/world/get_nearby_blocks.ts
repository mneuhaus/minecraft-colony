import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

/**
 * Get information about all blocks in a radius around the bot
 * Helps the bot understand its immediate surroundings
 */
export async function getNearbyBlocks(
  bot: Bot,
  radius: number = 5,
  includeAir: boolean = false
): Promise<string> {
  if (!bot.entity) {
    return 'Bot has not spawned yet';
  }

  const botPos = bot.entity.position.floored();
  const blockCounts: Map<string, number> = new Map();
  const interestingBlocks: Array<{
    name: string;
    pos: Vec3;
    distance: number;
  }> = [];

  // Scan blocks in radius
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const pos = botPos.offset(x, y, z);
        const block = bot.blockAt(pos);

        if (!block) continue;

        const blockName = block.name;

        // Skip air unless requested
        if (!includeAir && blockName === 'air') continue;

        // Count blocks by type
        const count = blockCounts.get(blockName) || 0;
        blockCounts.set(blockName, count + 1);

        // Track interesting blocks (not common terrain)
        if (!['air', 'grass_block', 'dirt', 'stone'].includes(blockName)) {
          const distance = Math.floor(botPos.distanceTo(pos));
          interestingBlocks.push({ name: blockName, pos, distance });
        }
      }
    }
  }

  // Sort blocks by count (most common first)
  const sortedCounts = Array.from(blockCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Sort interesting blocks by distance (nearest first)
  interestingBlocks.sort((a, b) => a.distance - b.distance);

  let result = `=== Nearby Blocks (${radius} block radius) ===\n\n`;

  result += '**Block Distribution:**\n';
  for (const [name, count] of sortedCounts) {
    result += `- ${name}: ${count} blocks\n`;
  }

  if (interestingBlocks.length > 0) {
    result += '\n**Interesting Blocks (nearest first):**\n';
    const shown = interestingBlocks.slice(0, 15);
    for (const block of shown) {
      result += `- ${block.name} at (${block.pos.x}, ${block.pos.y}, ${block.pos.z}) - ${block.distance} blocks away\n`;
    }

    if (interestingBlocks.length > 15) {
      result += `\n(${interestingBlocks.length - 15} more interesting blocks found)\n`;
    }
  } else {
    result += '\n**No interesting blocks found nearby**\n';
  }

  return result;
}
