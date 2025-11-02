import { MinecraftBot } from '../../bot/MinecraftBot.js';
import { Vec3 } from 'vec3';

export interface DigUpwardParams {
  /**
   * Number of staircase steps to dig (default: 5)
   */
  steps?: number;
  /**
   * Mode: 'staircase' (safe) or 'straight' (faster but riskier) - default: 'staircase'
   */
  mode?: 'staircase' | 'straight';
}

/**
 * Dig upward to reach the surface safely.
 *
 * STAIRCASE MODE (default, safer):
 * - Digs a diagonal staircase pattern going upward
 * - Prevents gravel/sand from falling on bot
 * - Each step: forward 1 block, up 1 block
 * - Stops when reaching light level > 10 (surface/daylight)
 *
 * STRAIGHT MODE (faster, riskier):
 * - Digs straight up (dangerous if gravel/sand above)
 * - Only use if certain no falling blocks overhead
 *
 * @param steps - How many staircase steps to dig (default 5)
 * @param mode - 'staircase' (safe) or 'straight' (risky)
 * @returns Status message with progress and light level
 */
export async function dig_upward(
  bot: MinecraftBot,
  params: DigUpwardParams = {}
): Promise<string> {
  const { steps = 5, mode = 'staircase' } = params;
  const mineflayerBot = bot.getBot();

  if (!mineflayerBot) {
    return `Error: Bot not connected to server`;
  }

  try {
    const startPos = mineflayerBot.entity.position.floored();
    const startY = startPos.y;
    const startLight = mineflayerBot.blockAt(startPos)?.light || 0;
    let blocksDug = 0;

    if (mode === 'staircase') {
      // Staircase mode: dig diagonal steps upward
      const facingVec = new Vec3(-Math.sin(mineflayerBot.entity.yaw), 0, -Math.cos(mineflayerBot.entity.yaw));
      const horizontalDir = facingVec.offset(0, 0, 0).normalize();

      for (let step = 0; step < steps; step++) {
        const currentPos = mineflayerBot.entity.position.floored();
        const currentLight = mineflayerBot.blockAt(currentPos)?.light || 0;

        // Check if we've reached the surface (bright light)
        if (currentLight >= 10) {
          return `✓ Reached surface after ${step} steps (${blocksDug} blocks)! Light level: ${currentLight}. Now at Y=${currentPos.y}`;
        }

        // Step 1: Dig block ahead at same level
        const forwardPos = currentPos.offset(Math.round(horizontalDir.x), 0, Math.round(horizontalDir.z));
        const forwardBlock = mineflayerBot.blockAt(forwardPos);

        if (forwardBlock && forwardBlock.name !== 'air') {
          if (forwardBlock.name.includes('lava') || forwardBlock.name.includes('water')) {
            return `WARNING: ${forwardBlock.name} detected ahead. Stopped at step ${step}. Dug ${blocksDug} blocks.`;
          }
          await mineflayerBot.dig(forwardBlock);
          blocksDug++;
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Step 2: Dig block above-forward (diagonal up)
        const diagUpPos = forwardPos.offset(0, 1, 0);
        const diagUpBlock = mineflayerBot.blockAt(diagUpPos);

        if (diagUpBlock && diagUpBlock.name !== 'air') {
          if (diagUpBlock.name.includes('lava') || diagUpBlock.name.includes('water')) {
            return `WARNING: ${diagUpBlock.name} detected above. Stopped at step ${step}. Dug ${blocksDug} blocks.`;
          }
          await mineflayerBot.dig(diagUpBlock);
          blocksDug++;
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Move forward and up the staircase
        try {
          await mineflayerBot.pathfinder.goto(new (await import('mineflayer-pathfinder')).goals.GoalBlock(forwardPos.x, forwardPos.y, forwardPos.z));
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (pathErr) {
          // Pathfinding might fail, that's okay, continue digging
        }
      }

      const finalPos = mineflayerBot.entity.position.floored();
      const finalLight = mineflayerBot.blockAt(finalPos)?.light || 0;
      const heightGained = finalPos.y - startY;

      return `Dug ${steps} staircase steps (${blocksDug} blocks). Height: Y=${startY}→${finalPos.y} (+${heightGained}). Light: ${startLight}→${finalLight}. ${finalLight < 10 ? 'Not at surface yet. Dig more steps.' : 'Approaching surface!'}`;

    } else {
      // Straight mode: dig directly upward (RISKY!)
      for (let i = 0; i < steps; i++) {
        const currentPos = mineflayerBot.entity.position.floored();
        const currentLight = mineflayerBot.blockAt(currentPos)?.light || 0;

        if (currentLight >= 10) {
          return `✓ Reached surface after ${i} blocks! Light level: ${currentLight}. Now at Y=${currentPos.y}`;
        }

        const blockAbove = mineflayerBot.blockAt(currentPos.offset(0, 2, 0));

        if (!blockAbove || blockAbove.name === 'air') {
          return `Reached open air after ${blocksDug} blocks. Now at Y=${currentPos.y}.`;
        }

        if (blockAbove.name.includes('lava') || blockAbove.name.includes('water')) {
          return `WARNING: ${blockAbove.name} above! Stopped at ${blocksDug} blocks.`;
        }

        await mineflayerBot.dig(blockAbove);
        blocksDug++;
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const finalPos = mineflayerBot.entity.position.floored();
      const finalLight = mineflayerBot.blockAt(finalPos)?.light || 0;

      return `Dug ${blocksDug} blocks straight up. Now at Y=${finalPos.y}. Light: ${finalLight}. ${finalLight < 10 ? 'Still underground.' : 'Near surface!'}`;
    }

  } catch (error: any) {
    return `Error digging upward: ${error.message}`;
  }
}
