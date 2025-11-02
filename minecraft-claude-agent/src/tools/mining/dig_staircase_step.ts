import { MinecraftBot } from '../../bot/MinecraftBot.js';

/**
 * Dig ONE step of an upward staircase following Minecraft player mechanics.
 *
 * MINECRAFT FACTS:
 * - Player is 2 blocks tall
 * - Jump reaches +2.5 blocks (effective +1 block up)
 * - Need to clear 3 blocks vertically for safe passage
 *
 * PATTERN (relative to current position, facing +X):
 * 1. Dig block ahead: (x+1, y, z)
 * 2. Dig block above-ahead: (x+1, y+1, z)
 * 3. Dig block above-head: (x, y+2, z)
 * 4. Move/jump forward to (x+1, y+1, z)
 *
 * This creates a 45° staircase you can walk/jump up naturally.
 * Call this repeatedly to build a full staircase to the surface.
 *
 * @returns Status with blocks dug and next position
 */
export async function dig_staircase_step(
  bot: MinecraftBot
): Promise<string> {
  const mineflayerBot = bot.getBot();

  if (!mineflayerBot) {
    return `Error: Bot not connected to server`;
  }

  try {
    // Get current position and facing direction
    const currentPos = mineflayerBot.entity.position.floored();
    const yaw = mineflayerBot.entity.yaw;

    // Calculate forward direction vector (where bot is facing)
    // Yaw 0 = -Z, Yaw π/2 = -X, Yaw π = +Z, Yaw 3π/2 = +X
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);

    // Round to cardinal direction
    const dirX = Math.round(forwardX);
    const dirZ = Math.round(forwardZ);

    const messages: string[] = [];
    messages.push(`Starting position: ${currentPos.toString()}`);
    messages.push(`Facing direction: X=${dirX}, Z=${dirZ}`);

    const currentLight = mineflayerBot.blockAt(currentPos)?.light || 0;
    messages.push(`Current light level: ${currentLight}`);

    // Check if already at surface
    if (currentLight >= 10) {
      return `Already at surface! Light level: ${currentLight}`;
    }

    let dugCount = 0;

    // STEP 1: Dig block ahead (forward at same Y level)
    const aheadPos = currentPos.offset(dirX, 0, dirZ);
    const aheadBlock = mineflayerBot.blockAt(aheadPos);

    if (aheadBlock && aheadBlock.name !== 'air' && aheadBlock.diggable) {
      messages.push(`Digging ahead: ${aheadBlock.name} at ${aheadPos.toString()}`);
      await mineflayerBot.dig(aheadBlock);
      dugCount++;
      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      messages.push(`Ahead already clear: ${aheadBlock?.name || 'null'}`);
    }

    // STEP 2: Dig block above-ahead (forward and +1 Y)
    const aboveAheadPos = currentPos.offset(dirX, 1, dirZ);
    const aboveAheadBlock = mineflayerBot.blockAt(aboveAheadPos);

    if (aboveAheadBlock && aboveAheadBlock.name !== 'air' && aboveAheadBlock.diggable) {
      messages.push(`Digging above-ahead: ${aboveAheadBlock.name} at ${aboveAheadPos.toString()}`);
      await mineflayerBot.dig(aboveAheadBlock);
      dugCount++;
      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      messages.push(`Above-ahead already clear: ${aboveAheadBlock?.name || 'null'}`);
    }

    // STEP 3: Dig block above head (+2 Y for headroom)
    const aboveHeadPos = currentPos.offset(0, 2, 0);
    const aboveHeadBlock = mineflayerBot.blockAt(aboveHeadPos);

    if (aboveHeadBlock && aboveHeadBlock.name !== 'air' && aboveHeadBlock.diggable) {
      messages.push(`Digging above-head: ${aboveHeadBlock.name} at ${aboveHeadPos.toString()}`);
      await mineflayerBot.dig(aboveHeadBlock);
      dugCount++;
      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      messages.push(`Above-head already clear: ${aboveHeadBlock?.name || 'null'}`);
    }

    // STEP 4: Try to move forward and up to the new step
    const targetPos = currentPos.offset(dirX, 1, dirZ);
    messages.push(`Attempting to move to: ${targetPos.toString()}`);

    try {
      // Use pathfinder to move to next step
      const { goals } = await import('mineflayer-pathfinder');
      await mineflayerBot.pathfinder.goto(new goals.GoalBlock(targetPos.x, targetPos.y, targetPos.z));

      const newPos = mineflayerBot.entity.position.floored();
      const heightGained = newPos.y - currentPos.y;
      const newLight = mineflayerBot.blockAt(newPos)?.light || 0;

      messages.push(`✓ Moved to: ${newPos.toString()}`);
      messages.push(`Height gained: +${heightGained} (Y: ${currentPos.y}→${newPos.y})`);
      messages.push(`New light level: ${newLight}`);

      if (newLight >= 10) {
        messages.push(`✓✓ REACHED SURFACE! Light level: ${newLight}`);
      } else {
        messages.push(`Still underground. Call dig_staircase_step again to continue.`);
      }

      return `${messages.join(' | ')} | Blocks dug: ${dugCount}`;

    } catch (pathError: any) {
      messages.push(`⚠ Could not move to next step: ${pathError.message}`);
      messages.push(`Manual movement may be needed. Use goto tool with coordinates: ${targetPos.toString()}`);
      return `${messages.join(' | ')} | Blocks dug: ${dugCount}`;
    }

  } catch (error: any) {
    return `Error in dig_staircase_step: ${error.message}`;
  }
}
