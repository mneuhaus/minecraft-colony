import { MinecraftBot } from '../../bot/MinecraftBot.js';

export interface DigStraightUpParams {
  /**
   * Number of blocks to dig upward (default: 10)
   */
  blocks?: number;
}

/**
 * Dig straight upward to escape underground.
 *
 * SIMPLIFIED APPROACH:
 * - Looks directly up and digs blocks above the bot
 * - Repeats until reaching specified height or detecting surface (light >= 10)
 * - Safer than complex staircase, relies on bot's natural movement
 *
 * @param blocks - How many blocks to dig upward (default 10)
 * @returns Status message with progress and final position
 */
export async function dig_straight_up(
  bot: MinecraftBot,
  params: DigStraightUpParams = {}
): Promise<string> {
  const { blocks = 10 } = params;
  const mineflayerBot = bot.getBot();

  if (!mineflayerBot) {
    return `Error: Bot not connected to server`;
  }

  try {
    const startPos = mineflayerBot.entity.position.floored();
    const startY = startPos.y;
    const startLight = mineflayerBot.blockAt(startPos)?.light || 0;
    let blocksDug = 0;
    let messages: string[] = [];

    messages.push(`Starting dig from Y=${startY}, Light=${startLight}`);

    for (let i = 0; i < blocks; i++) {
      const currentPos = mineflayerBot.entity.position.floored();
      const currentLight = mineflayerBot.blockAt(currentPos)?.light || 0;

      // Check if we've reached the surface (bright light)
      if (currentLight >= 10) {
        messages.push(`✓ Reached surface! Light level: ${currentLight}`);
        const finalY = currentPos.y;
        return `${messages.join(' | ')} | Blocks dug: ${blocksDug} | Height: Y=${startY}→${finalY} (+${finalY - startY})`;
      }

      // Look at blocks above (1 and 2 blocks up)
      const blockAbove1 = mineflayerBot.blockAt(currentPos.offset(0, 1, 0));
      const blockAbove2 = mineflayerBot.blockAt(currentPos.offset(0, 2, 0));

      // Check for dangerous fluids
      if (blockAbove1 && (blockAbove1.name.includes('lava') || blockAbove1.name.includes('water'))) {
        messages.push(`⚠ ${blockAbove1.name} detected above!`);
        return `${messages.join(' | ')} | Blocks dug: ${blocksDug} | STOPPED (dangerous fluid)`;
      }

      if (blockAbove2 && (blockAbove2.name.includes('lava') || blockAbove2.name.includes('water'))) {
        messages.push(`⚠ ${blockAbove2.name} detected 2 blocks above!`);
        return `${messages.join(' | ')} | Blocks dug: ${blocksDug} | STOPPED (dangerous fluid)`;
      }

      // Dig block 2 blocks above (so we can walk/jump through)
      if (blockAbove2 && blockAbove2.name !== 'air' && blockAbove2.diggable) {
        try {
          await mineflayerBot.dig(blockAbove2);
          blocksDug++;
          messages.push(`Dug ${blockAbove2.name} at Y=${blockAbove2.position.y}`);
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (digError: any) {
          messages.push(`Failed to dig ${blockAbove2.name}: ${digError.message}`);
        }
      }

      // Dig block 1 block above if needed
      if (blockAbove1 && blockAbove1.name !== 'air' && blockAbove1.diggable) {
        try {
          await mineflayerBot.dig(blockAbove1);
          blocksDug++;
          messages.push(`Dug ${blockAbove1.name} at Y=${blockAbove1.position.y}`);
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (digError: any) {
          messages.push(`Failed to dig ${blockAbove1.name}: ${digError.message}`);
        }
      }

      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const finalPos = mineflayerBot.entity.position.floored();
    const finalLight = mineflayerBot.blockAt(finalPos)?.light || 0;
    const heightGained = finalPos.y - startY;

    messages.push(`Finished digging`);

    return `${messages.join(' | ')} | Blocks dug: ${blocksDug} | Height: Y=${startY}→${finalPos.y} (+${heightGained}) | Light: ${startLight}→${finalLight} | ${finalLight < 10 ? 'Still underground - dig more!' : 'Near surface!'}`;

  } catch (error: any) {
    return `Error digging straight up: ${error.message}`;
  }
}
