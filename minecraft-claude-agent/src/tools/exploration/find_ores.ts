import { MinecraftBot } from '../../bot/MinecraftBot.js';

export interface FindOresParams {
  oreType?: string; // "coal_ore", "iron_ore", "diamond_ore", etc. If omitted, finds all ores
  maxDistance?: number; // Default: 32 blocks
  count?: number; // Max results to return, default: 10
}

/**
 * Find ore blocks within radius. Returns coordinates and distances.
 * ATOMIC TOOL: Only finds and reports locations - does not mine or move.
 *
 * Design for blind bot:
 * - Returns exact coordinates for each ore
 * - Includes distance in blocks for navigation planning
 * - Sorted by proximity (nearest first)
 * - Specific ore types, not generic "ore"
 */
export async function find_ores(
  botWrapper: MinecraftBot,
  params: FindOresParams = {}
): Promise<string> {
  const { oreType, maxDistance = 32, count = 10 } = params;
  const bot = botWrapper.getBot();

  try {
    const mcData = bot.registry;
    const oreTypes = [
      'coal_ore',
      'deepslate_coal_ore',
      'iron_ore',
      'deepslate_iron_ore',
      'copper_ore',
      'deepslate_copper_ore',
      'gold_ore',
      'deepslate_gold_ore',
      'redstone_ore',
      'deepslate_redstone_ore',
      'lapis_ore',
      'deepslate_lapis_ore',
      'diamond_ore',
      'deepslate_diamond_ore',
      'emerald_ore',
      'deepslate_emerald_ore',
    ];

    let searchTypes: number[] = [];

    if (oreType) {
      // Search for specific ore type
      const blockType = mcData.blocksByName[oreType];
      if (!blockType) {
        return `Unknown ore type: ${oreType}. Valid types: ${oreTypes.join(', ')}`;
      }
      searchTypes = [blockType.id];
    } else {
      // Search for all ore types
      searchTypes = oreTypes
        .map((name) => mcData.blocksByName[name]?.id)
        .filter((id) => id !== undefined) as number[];
    }

    // Find blocks
    const foundBlocks = bot.findBlocks({
      matching: searchTypes,
      maxDistance,
      count: count * 10, // Find more to ensure we get enough after filtering
    });

    if (foundBlocks.length === 0) {
      const searchTerm = oreType || 'any ore';
      return `No ${searchTerm} found within ${maxDistance} blocks.`;
    }

    // Calculate distances and get block names
    const botPos = bot.entity.position;
    const oreLocations = foundBlocks
      .map((pos) => {
        const block = bot.blockAt(pos);
        if (!block) return null;

        const distance = Math.floor(botPos.distanceTo(pos));
        return {
          name: block.name,
          x: pos.x,
          y: pos.y,
          z: pos.z,
          distance,
        };
      })
      .filter((loc) => loc !== null)
      .sort((a, b) => a!.distance - b!.distance)
      .slice(0, count);

    // Format output for blind bot
    const lines: string[] = [];
    const searchTerm = oreType || 'ore blocks';
    lines.push(`Found ${oreLocations.length} ${searchTerm} within ${maxDistance} blocks:`);
    lines.push('');

    oreLocations.forEach((loc, index) => {
      lines.push(
        `${index + 1}. ${loc!.name} at (${loc!.x}, ${loc!.y}, ${loc!.z}) - ${loc!.distance} blocks away`
      );
    });

    return lines.join('\n');
  } catch (error: any) {
    return `Error finding ores: ${error.message}`;
  }
}
