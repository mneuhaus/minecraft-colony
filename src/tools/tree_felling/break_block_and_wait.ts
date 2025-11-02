import { Bot } from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';

/**
 * Break a block and wait for item drops to spawn
 * This is crucial for tree felling - items take time to spawn after breaking
 */
export async function breakBlockAndWait(bot: Bot, x: number, y: number, z: number): Promise<string> {
  const blockPos = new Vec3(x, y, z);
  const block = bot.blockAt(blockPos);

  if (!block || block.name === 'air') {
    return `No block found at position (${x}, ${y}, ${z})`;
  }

  const blockName = block.name;

  // Check if we can reach the block
  if (!bot.canDigBlock(block) || !bot.canSeeBlock(block)) {
    // Try to move closer
    try {
      const goal = new goals.GoalNear(x, y, z, 2);
      await bot.pathfinder.goto(goal);
    } catch (error: any) {
      return `Cannot reach block at (${x}, ${y}, ${z}): ${error.message}`;
    }
  }

  // Check again after moving
  const updatedBlock = bot.blockAt(blockPos);
  if (!updatedBlock || !bot.canDigBlock(updatedBlock)) {
    return `Cannot dig block at (${x}, ${y}, ${z}) after moving closer`;
  }

  // Break the block
  await bot.dig(updatedBlock);

  // Wait for item entity to spawn (typically 100-500ms in Minecraft)
  await new Promise(resolve => setTimeout(resolve, 500));

  return `Broke ${blockName} at (${x}, ${y}, ${z}). Item drop should now be spawned.`;
}
