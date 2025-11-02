import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

export interface StoneDepositInfo {
  position: Vec3;
  block_type: string;
  cluster_size: number;
  distance: number;
  accessibility: 'surface' | 'cliff' | 'cave' | 'buried';
  estimated_yield: number;
}

/**
 * Find exposed stone deposits within radius, sorted by distance
 * Returns detailed info for LLM to make mining decisions
 *
 * Following "blind bot" principle:
 * - Returns coordinates for every stone deposit
 * - Includes distance in blocks
 * - Provides accessibility assessment
 * - Estimates cluster size for planning
 */
export async function findStone(
  bot: Bot,
  radius: number = 32,
  stoneTypes: string[] = []
): Promise<string> {
  // Default stone types: prioritize common stone, cobblestone, andesite, etc.
  const targetTypes = stoneTypes.length > 0 ? stoneTypes : [
    'stone',
    'cobblestone',
    'andesite',
    'diorite',
    'granite',
    'deepslate',
    'stone_bricks'
  ];

  const deposits: StoneDepositInfo[] = [];
  const botPos = bot.entity.position;
  const processedPositions = new Set<string>();

  // Find all stone blocks within radius
  for (const stoneType of targetTypes) {
    const blocks = bot.findBlocks({
      matching: (block) => block.name === stoneType,
      maxDistance: radius,
      count: 100,
    });

    for (const blockPos of blocks) {
      const key = `${Math.floor(blockPos.x)},${Math.floor(blockPos.y)},${Math.floor(blockPos.z)}`;

      // Skip if already processed
      if (processedPositions.has(key)) continue;
      processedPositions.add(key);

      const block = bot.blockAt(blockPos);
      if (!block) continue;

      // Assess accessibility
      const accessibility = assessAccessibility(bot, blockPos);

      // Only include accessible stone (surface, cliff, cave - not deeply buried)
      if (accessibility === 'buried') continue;

      // Estimate cluster size (count nearby stone blocks)
      const clusterSize = estimateClusterSize(bot, blockPos, stoneType);

      // Estimated yield: cluster size (some blocks may be inaccessible)
      const estimatedYield = Math.floor(clusterSize * 0.7);

      const distance = Math.floor(botPos.distanceTo(blockPos));

      deposits.push({
        position: blockPos,
        block_type: stoneType,
        cluster_size: clusterSize,
        distance,
        accessibility,
        estimated_yield: estimatedYield,
      });
    }
  }

  // Sort by distance
  deposits.sort((a, b) => a.distance - b.distance);

  if (deposits.length === 0) {
    return `No accessible stone deposits found within ${radius} blocks. Try exploring further or looking for cliffs/caves.`;
  }

  // Format output (show top 5)
  const depositList = deposits.slice(0, 5).map((d, i) => {
    const accessStr = d.accessibility === 'surface' ? '(surface)' :
                      d.accessibility === 'cliff' ? '(cliff face)' :
                      d.accessibility === 'cave' ? '(cave)' : '';
    return `${i + 1}. ${d.block_type} ${accessStr} at (${Math.floor(d.position.x)}, ${Math.floor(d.position.y)}, ${Math.floor(d.position.z)}), cluster ~${d.cluster_size} blocks, yield ~${d.estimated_yield} blocks, ${d.distance} blocks away`;
  }).join('\n');

  return `Found ${deposits.length} accessible stone deposits. Nearest deposits:\n${depositList}${deposits.length > 5 ? `\n...and ${deposits.length - 5} more` : ''}`;
}

/**
 * Assess how accessible this stone block is
 */
function assessAccessibility(bot: Bot, pos: Vec3): 'surface' | 'cliff' | 'cave' | 'buried' {
  // Check if exposed to air (at least one adjacent air block)
  const adjacentPositions = [
    pos.offset(0, 1, 0),  // above
    pos.offset(0, -1, 0), // below
    pos.offset(1, 0, 0),  // east
    pos.offset(-1, 0, 0), // west
    pos.offset(0, 0, 1),  // south
    pos.offset(0, 0, -1), // north
  ];

  let airBlockCount = 0;
  let hasAirAbove = false;
  let hasAirBelow = false;

  for (const adjPos of adjacentPositions) {
    const adjBlock = bot.blockAt(adjPos);
    if (!adjBlock || adjBlock.name === 'air' || adjBlock.name === 'cave_air') {
      airBlockCount++;
      if (adjPos.equals(pos.offset(0, 1, 0))) hasAirAbove = true;
      if (adjPos.equals(pos.offset(0, -1, 0))) hasAirBelow = true;
    }
  }

  // Buried: no air blocks adjacent
  if (airBlockCount === 0) return 'buried';

  // Surface: air above, solid below
  if (hasAirAbove && !hasAirBelow && airBlockCount <= 2) return 'surface';

  // Cave: air on multiple sides including above/below
  if (airBlockCount >= 3) return 'cave';

  // Cliff: air on sides but not buried
  return 'cliff';
}

/**
 * Estimate cluster size by counting nearby stone blocks
 */
function estimateClusterSize(bot: Bot, centerPos: Vec3, stoneType: string): number {
  let count = 0;
  const searchRadius = 3; // 3x3x3 area around center

  for (let x = -searchRadius; x <= searchRadius; x++) {
    for (let y = -searchRadius; y <= searchRadius; y++) {
      for (let z = -searchRadius; z <= searchRadius; z++) {
        const checkPos = centerPos.offset(x, y, z);
        const block = bot.blockAt(checkPos);

        if (block && block.name === stoneType) {
          count++;
        }
      }
    }
  }

  return count;
}
