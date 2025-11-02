import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';

/**
 * Detect the biome at a specific position or bot's current position
 * Returns biome name, temperature, rainfall, and characteristics
 */
export async function detect_biome(
  bot: Bot,
  x?: number,
  y?: number,
  z?: number
): Promise<string> {
  const mcData = minecraftData(bot.version);

  // Use provided coordinates or bot's current position
  const pos = new Vec3(
    x ?? Math.floor(bot.entity.position.x),
    y ?? Math.floor(bot.entity.position.y),
    z ?? Math.floor(bot.entity.position.z)
  );

  // Get biome ID from the world
  const biomeId = bot.world.getBiome(pos);
  const biome = mcData.biomes[biomeId];

  if (!biome) {
    return `Unable to detect biome at (${pos.x}, ${pos.y}, ${pos.z}). Biome ID: ${biomeId}`;
  }

  // Analyze nearby blocks to provide context about the biome
  const analysis = await analyzeBiomeCharacteristics(bot, pos);

  return `Biome: ${biome.displayName} (${biome.name})
Location: (${pos.x}, ${pos.y}, ${pos.z})
Temperature: ${biome.temperature}
Rainfall: ${biome.rainfall}
${analysis}`;
}

/**
 * Analyze nearby blocks to provide additional context about the biome
 */
async function analyzeBiomeCharacteristics(bot: Bot, center: Vec3): Promise<string> {
  const radius = 10;
  const characteristics: string[] = [];

  // Count different block types in the area
  const blockCounts = new Map<string, number>();

  for (let dx = -radius; dx <= radius; dx += 2) {
    for (let dz = -radius; dz <= radius; dz += 2) {
      const pos = center.offset(dx, 0, dz);
      const block = bot.blockAt(pos);

      if (block) {
        const count = blockCounts.get(block.name) || 0;
        blockCounts.set(block.name, count + 1);
      }
    }
  }

  // Identify dominant surface blocks
  const sortedBlocks = Array.from(blockCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (sortedBlocks.length > 0) {
    characteristics.push(
      `Surface blocks: ${sortedBlocks.map(([name, count]) => `${name} (${count})`).join(', ')}`
    );
  }

  // Check for vegetation patterns
  const treeTypes: string[] = [];
  for (const [blockName] of blockCounts.entries()) {
    if (blockName.includes('_log')) {
      const treeType = blockName.replace('_log', '');
      treeTypes.push(treeType);
    }
  }

  if (treeTypes.length > 0) {
    characteristics.push(`Trees: ${treeTypes.join(', ')}`);
  }

  // Check for water
  if (blockCounts.has('water')) {
    characteristics.push(`Water present (${blockCounts.get('water')} blocks)`);
  }

  // Check for sand (beach/desert indicator)
  if (blockCounts.has('sand')) {
    characteristics.push(`Sandy terrain (${blockCounts.get('sand')} blocks)`);
  }

  return characteristics.length > 0
    ? `Characteristics: ${characteristics.join('; ')}`
    : 'Characteristics: Flat or barren terrain';
}

/**
 * Scan a larger area and identify all unique biomes within radius
 * Useful for biome boundaries and finding specific biomes nearby
 */
export async function scan_biomes_in_area(
  bot: Bot,
  centerX?: number,
  centerZ?: number,
  radius: number = 50
): Promise<string> {
  const mcData = minecraftData(bot.version);

  const center = new Vec3(
    centerX ?? Math.floor(bot.entity.position.x),
    64, // Use a fixed Y level for biome sampling
    centerZ ?? Math.floor(bot.entity.position.z)
  );

  const biomeMap = new Map<number, { name: string; positions: Vec3[] }>();

  // Sample biomes in a grid pattern
  const step = 8; // Sample every 8 blocks
  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dz = -radius; dz <= radius; dz += step) {
      const pos = new Vec3(center.x + dx, 64, center.z + dz);
      const biomeId = bot.world.getBiome(pos);
      const biome = mcData.biomes[biomeId];

      if (biome) {
        if (!biomeMap.has(biomeId)) {
          biomeMap.set(biomeId, {
            name: biome.displayName || biome.name,
            positions: [],
          });
        }
        biomeMap.get(biomeId)!.positions.push(pos);
      }
    }
  }

  // Calculate approximate center of each biome
  const results: string[] = [];
  for (const [biomeId, data] of biomeMap.entries()) {
    // Find the position closest to the scan center for this biome
    let closestPos = data.positions[0];
    let minDist = center.distanceTo(closestPos);

    for (const pos of data.positions) {
      const dist = center.distanceTo(pos);
      if (dist < minDist) {
        minDist = dist;
        closestPos = pos;
      }
    }

    const biome = mcData.biomes[biomeId];
    results.push(
      `${data.name}: ~${data.positions.length} samples, nearest at (${Math.floor(closestPos.x)}, ${Math.floor(closestPos.z)}) - ${Math.floor(minDist)} blocks away (Temp: ${biome.temperature}, Rain: ${biome.rainfall})`
    );
  }

  return `Biome scan within ${radius} block radius of (${center.x}, ${center.z}):
Found ${biomeMap.size} unique biome(s):
${results.join('\n')}`;
}
