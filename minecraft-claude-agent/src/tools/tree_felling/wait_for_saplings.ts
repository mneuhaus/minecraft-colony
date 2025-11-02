import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

/**
 * Wait near tree position for leaves to decay and saplings to drop
 * Returns sapling count and decay status
 */
export async function waitForSaplings(bot: Bot, x: number, y: number, z: number, timeoutSeconds: number = 30): Promise<string> {
  const treePos = new Vec3(x, y, z);
  const startTime = Date.now();
  const timeout = timeoutSeconds * 1000;

  // Count initial saplings in inventory
  const initialSaplings = countSaplingsInInventory(bot);

  // Count leaves near tree
  let leavesRemaining = countNearbyLeaves(bot, treePos);
  const initialLeaves = leavesRemaining;

  while (Date.now() - startTime < timeout) {
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Recount leaves
    const newLeafCount = countNearbyLeaves(bot, treePos);

    if (newLeafCount === 0 && leavesRemaining > 0) {
      // All leaves decayed!
      break;
    }

    leavesRemaining = newLeafCount;
  }

  const currentSaplings = countSaplingsInInventory(bot);
  const saplingsFound = currentSaplings - initialSaplings;
  const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
  const timedOut = Date.now() - startTime >= timeout;

  const result: string[] = [
    `Waited ${timeTaken} seconds.`,
  ];

  if (leavesRemaining === 0) {
    result.push(`All leaves decayed (${initialLeaves} total).`);
  } else {
    result.push(`${leavesRemaining} leaves remaining (started with ${initialLeaves}).`);
  }

  result.push(`Found ${saplingsFound} new sapling${saplingsFound !== 1 ? 's' : ''} in inventory.`);

  if (timedOut) {
    result.push(`TIMED OUT - may need to wait longer or collect manually.`);
  }

  return result.join(' ');
}

/**
 * Count saplings in bot's inventory
 */
function countSaplingsInInventory(bot: Bot): number {
  return bot.inventory.items()
    .filter(item => item.name.endsWith('_sapling'))
    .reduce((sum, item) => sum + item.count, 0);
}

/**
 * Count leaves near a position
 */
function countNearbyLeaves(bot: Bot, pos: Vec3): number {
  const leafBlocks = bot.findBlocks({
    point: pos,
    matching: (block) => block.name.endsWith('_leaves'),
    maxDistance: 8,
    count: 200,
  });

  return leafBlocks.length;
}
