import { MinecraftBot } from '../../bot/MinecraftBot.js';

/**
 * DEBUG TOOL: Try to dig a single block above and report detailed information
 *
 * This tool helps diagnose why digging isn't working.
 */
export async function debug_dig(
  bot: MinecraftBot
): Promise<string> {
  const mineflayerBot = bot.getBot();

  if (!mineflayerBot) {
    return `Error: Bot not connected to server`;
  }

  try {
    const currentPos = mineflayerBot.entity.position.floored();
    const messages: string[] = [];

    messages.push(`Bot position: ${currentPos.toString()}`);
    messages.push(`Bot Y: ${currentPos.y}`);

    // Check block 1 above
    const blockAbove1 = mineflayerBot.blockAt(currentPos.offset(0, 1, 0));
    messages.push(`\nBlock 1 above:`);
    if (blockAbove1) {
      messages.push(`  - Name: ${blockAbove1.name}`);
      messages.push(`  - Position: ${blockAbove1.position.toString()}`);
      messages.push(`  - Diggable: ${blockAbove1.diggable}`);
      messages.push(`  - Hardness: ${blockAbove1.hardness}`);
      messages.push(`  - Light: ${blockAbove1.light}`);
    } else {
      messages.push(`  - ERROR: Block not found!`);
    }

    // Check block 2 above
    const blockAbove2 = mineflayerBot.blockAt(currentPos.offset(0, 2, 0));
    messages.push(`\nBlock 2 above:`);
    if (blockAbove2) {
      messages.push(`  - Name: ${blockAbove2.name}`);
      messages.push(`  - Position: ${blockAbove2.position.toString()}`);
      messages.push(`  - Diggable: ${blockAbove2.diggable}`);
      messages.push(`  - Hardness: ${blockAbove2.hardness}`);
      messages.push(`  - Light: ${blockAbove2.light}`);
    } else {
      messages.push(`  - ERROR: Block not found!`);
    }

    // Try to dig block 2 above if it exists and is not air
    messages.push(`\n=== ATTEMPTING TO DIG BLOCK 2 ABOVE ===`);
    if (blockAbove2 && blockAbove2.name !== 'air') {
      try {
        messages.push(`Trying to dig ${blockAbove2.name}...`);
        const canDig = mineflayerBot.canDigBlock(blockAbove2);
        messages.push(`Can dig this block: ${canDig}`);

        if (canDig) {
          messages.push(`Starting dig operation...`);
          await mineflayerBot.dig(blockAbove2);
          messages.push(`✓ Successfully dug ${blockAbove2.name}!`);

          // Check what's there now
          await new Promise(resolve => setTimeout(resolve, 500));
          const blockAfter = mineflayerBot.blockAt(currentPos.offset(0, 2, 0));
          messages.push(`Block after digging: ${blockAfter?.name || 'null'}`);
        } else {
          messages.push(`✗ Cannot dig this block (canDigBlock returned false)`);
          const tool = mineflayerBot.pathfinder.bestHarvestTool(blockAbove2);
          messages.push(`Best harvest tool: ${tool ? tool.name : 'none'}`);
        }
      } catch (digError: any) {
        messages.push(`✗ Dig error: ${digError.message}`);
        messages.push(`Error stack: ${digError.stack?.substring(0, 200)}`);
      }
    } else if (blockAbove2 && blockAbove2.name === 'air') {
      messages.push(`Block is air, nothing to dig`);
    } else {
      messages.push(`No block found to dig`);
    }

    return messages.join('\n');

  } catch (error: any) {
    return `Debug dig error: ${error.message}\nStack: ${error.stack}`;
  }
}
