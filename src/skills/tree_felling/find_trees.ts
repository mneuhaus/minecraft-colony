import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

export interface TreeInfo {
  position: Vec3;
  type: string;
  estimated_height: number;
  is_mega_tree: boolean;
  distance: number;
  wood_yield_estimate: number;
}

/**
 * Find all trees within radius, sorted by distance
 * Returns detailed info for LLM to make decisions
 */
export async function findTrees(bot: Bot, radius: number = 50, types: string[] = []): Promise<string> {
  const woodTypes = types.length > 0 ? types.map(t => `${t}_log`) : [
    'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'
  ];

  const trees: TreeInfo[] = [];
  const botPos = bot.entity.position;
  const treeBases = new Map<string, TreeInfo>();

  // Find all wood blocks
  for (const woodType of woodTypes) {
    const blocks = bot.findBlocks({
      matching: (block) => block.name === woodType,
      maxDistance: radius,
      count: 100,
    });

    for (const blockPos of blocks) {
      const block = bot.blockAt(blockPos);
      if (!block) continue;

      // Check if this is a tree base (has dirt/grass/podzol below)
      const below = bot.blockAt(blockPos.offset(0, -1, 0));
      if (!below) continue;

      const isGroundBlock = below.name.includes('dirt') || below.name.includes('grass') ||
                           below.name.includes('podzol') || below.name.includes('mycelium');

      if (isGroundBlock) {
        const key = `${Math.floor(blockPos.x)},${Math.floor(blockPos.z)}`;

        if (!treeBases.has(key)) {
          // Check if mega tree (2x2 base)
          const isMega = checkMegaBase(bot, blockPos, woodType);

          // Estimate height by counting vertical logs
          const height = estimateHeight(bot, blockPos, woodType, isMega);

          // Estimate wood yield (height * base size)
          const yieldEstimate = height * (isMega ? 4 : 1);

          const distance = Math.floor(botPos.distanceTo(blockPos));
          const treeType = woodType.replace('_log', '');

          treeBases.set(key, {
            position: blockPos,
            type: treeType,
            estimated_height: height,
            is_mega_tree: isMega,
            distance,
            wood_yield_estimate: yieldEstimate,
          });
        }
      }
    }
  }

  trees.push(...treeBases.values());

  // Sort by distance
  trees.sort((a, b) => a.distance - b.distance);

  if (trees.length === 0) {
    return `No trees found within ${radius} blocks`;
  }

  // Format output
  const treeList = trees.slice(0, 5).map((t, i) => {
    const megaStr = t.is_mega_tree ? ' (MEGA 2x2)' : '';
    return `${i + 1}. ${t.type} at (${Math.floor(t.position.x)}, ${Math.floor(t.position.y)}, ${Math.floor(t.position.z)}), height ~${t.estimated_height} blocks${megaStr}, ~${t.wood_yield_estimate} logs, ${t.distance} blocks away`;
  }).join('\n');

  return `Found ${trees.length} trees. Nearest trees:\n${treeList}${trees.length > 5 ? `\n...and ${trees.length - 5} more` : ''}`;
}

/**
 * Check if tree has 2x2 base (mega tree)
 */
function checkMegaBase(bot: Bot, pos: Vec3, woodType: string): boolean {
  const positions = [
    pos,
    pos.offset(1, 0, 0),
    pos.offset(0, 0, 1),
    pos.offset(1, 0, 1),
  ];

  const logsFound = positions.filter(p => {
    const block = bot.blockAt(p);
    return block && block.name === woodType;
  }).length;

  return logsFound >= 3; // At least 3 of 4 positions have logs = mega tree
}

/**
 * Estimate tree height by counting vertical logs
 */
function estimateHeight(bot: Bot, basePos: Vec3, woodType: string, isMega: boolean): number {
  let height = 0;
  const maxHeight = 30;

  const basesToCheck = isMega ? [
    basePos,
    basePos.offset(1, 0, 0),
    basePos.offset(0, 0, 1),
    basePos.offset(1, 0, 1),
  ] : [basePos];

  for (let y = 0; y < maxHeight; y++) {
    let foundLog = false;

    for (const base of basesToCheck) {
      const checkPos = base.offset(0, y, 0);
      const block = bot.blockAt(checkPos);

      if (block && block.name === woodType) {
        foundLog = true;
        break;
      }
    }

    if (foundLog) {
      height++;
    } else if (height > 0) {
      // If we've found logs and now hit air, tree ended
      break;
    }
  }

  return height;
}
