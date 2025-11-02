import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

/**
 * Analyze tree structure in detail
 * Returns complete information for LLM to plan felling strategy
 */
export async function getTreeStructure(bot: Bot, baseX: number, baseY: number, baseZ: number): Promise<string> {
  const basePos = new Vec3(baseX, baseY, baseZ);
  const baseBlock = bot.blockAt(basePos);

  if (!baseBlock || !baseBlock.name.endsWith('_log')) {
    return `No tree found at (${baseX}, ${baseY}, ${baseZ}). Block type: ${baseBlock?.name || 'air'}`;
  }

  const woodType = baseBlock.name;
  const treeType = woodType.replace('_log', '');

  // Check if mega tree
  const baseBlocks: Vec3[] = [basePos];
  const potentialMegaPositions = [
    basePos.offset(1, 0, 0),
    basePos.offset(0, 0, 1),
    basePos.offset(1, 0, 1),
  ];

  for (const pos of potentialMegaPositions) {
    const block = bot.blockAt(pos);
    if (block && block.name === woodType) {
      baseBlocks.push(pos);
    }
  }

  const isMega = baseBlocks.length >= 3;

  // Find all log blocks
  const allLogBlocks: Vec3[] = [];
  const visited = new Set<string>();
  let highestY = baseY;
  let lowestY = baseY;

  for (const base of baseBlocks) {
    for (let y = 0; y < 30; y++) {
      const checkPos = base.offset(0, y, 0);
      const key = `${checkPos.x},${checkPos.y},${checkPos.z}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const block = bot.blockAt(checkPos);
      if (block && block.name === woodType) {
        allLogBlocks.push(checkPos);
        highestY = Math.max(highestY, checkPos.y);
        lowestY = Math.min(lowestY, checkPos.y);
      } else if (allLogBlocks.length > 0) {
        // Hit air after finding logs, stop searching this column
        break;
      }
    }
  }

  // Count nearby leaves (approximate)
  let leafCount = 0;
  const leafType = woodType.replace('log', 'leaves');

  for (const logPos of allLogBlocks.slice(-3)) { // Check top 3 logs
    const nearbyBlocks = bot.findBlocks({
      point: logPos,
      matching: (block) => block.name === leafType,
      maxDistance: 5,
      count: 50,
    });
    leafCount += nearbyBlocks.length;
  }

  // Format base blocks
  const baseBlocksStr = baseBlocks.map(b => `(${Math.floor(b.x)},${Math.floor(b.y)},${Math.floor(b.z)})`).join(', ');

  // Format log positions by Y-level
  const logsByLevel = new Map<number, number>();
  for (const log of allLogBlocks) {
    logsByLevel.set(log.y, (logsByLevel.get(log.y) || 0) + 1);
  }

  const highestLog = allLogBlocks.reduce((highest, current) =>
    current.y > highest.y ? current : highest, allLogBlocks[0]);

  const result = [
    `${treeType.toUpperCase()} tree at (${baseX}, ${baseY}, ${baseZ}):`,
    `- Base: ${isMega ? '2x2 MEGA' : '1x1 single trunk'} [${baseBlocksStr}]`,
    `- Total logs: ${allLogBlocks.length}`,
    `- Height: Y=${lowestY} to Y=${highestY} (${highestY - lowestY + 1} blocks tall)`,
    `- Highest log: (${Math.floor(highestLog.x)}, ${highestLog.y}, ${Math.floor(highestLog.z)})`,
    `- Nearby leaves: ~${leafCount} blocks`,
    `- Type: ${treeType}`,
  ].join('\n');

  return result;
}
