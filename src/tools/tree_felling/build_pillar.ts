import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

/**
 * Build a pillar by jumping and placing blocks beneath
 * Used to reach high tree blocks
 */
export async function buildPillar(bot: Bot, height: number, descendAfter: boolean = false): Promise<string> {
  const startY = bot.entity.position.y;
  const targetY = startY + height;
  let blocksUsed = 0;

  // Find a suitable building material (dirt, cobblestone, or any block)
  const buildingMaterial = bot.inventory.items().find(item =>
    item.name.includes('dirt') ||
    item.name.includes('cobblestone') ||
    item.name.includes('stone') ||
    item.name.includes('planks')
  );

  if (!buildingMaterial) {
    return `FAILED: No suitable building blocks in inventory (need dirt, cobblestone, stone, or planks)`;
  }

  try {
    // Equip building material
    await bot.equip(buildingMaterial, 'hand');

    // Look straight down
    await bot.look(0, Math.PI / 2); // Pitch down 90 degrees

    // Build upward
    while (bot.entity.position.y < targetY && blocksUsed < height + 2) {
      // Jump
      bot.setControlState('jump', true);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Place block beneath while in air
      const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0));
      if (blockBelow && blockBelow.name === 'air') {
        try {
          const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -2, 0));
          if (referenceBlock) {
            await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
            blocksUsed++;
          }
        } catch (err) {
          // Block placement might fail mid-air, that's ok
        }
      }

      bot.setControlState('jump', false);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Safety check
      if (blocksUsed > height + 5) {
        break; // Something went wrong
      }
    }

    const finalY = Math.floor(bot.entity.position.y);
    const heightGained = finalY - Math.floor(startY);

    const result: string[] = [
      `Built pillar to Y=${finalY} (+${heightGained} blocks).`,
      `Used ${blocksUsed}x ${buildingMaterial.name}.`,
    ];

    if (descendAfter) {
      result.push(`Descending now...`);
      const descendResult = await descendPillarSafely(bot);
      result.push(descendResult);
    }

    return result.join(' ');
  } catch (error: any) {
    return `FAILED to build pillar: ${error.message}`;
  }
}

/**
 * Descend a pillar safely by breaking blocks beneath
 */
export async function descendPillarSafely(bot: Bot): Promise<string> {
  const startY = bot.entity.position.y;
  let blocksBroken = 0;

  // Look straight down
  await bot.look(0, Math.PI / 2);

  // Descend until we hit ground
  while (true) {
    const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0));

    // Check if we're on ground (dirt, grass, stone, etc)
    if (!blockBelow || blockBelow.name === 'air') {
      break; // At ground level
    }

    const isNaturalGround = blockBelow.name.includes('dirt') ||
                            blockBelow.name.includes('grass') ||
                            blockBelow.name.includes('stone') ||
                            blockBelow.name.includes('podzol');

    if (isNaturalGround && blocksBroken > 0) {
      // Hit natural ground, stop
      break;
    }

    try {
      // Dig block beneath
      await bot.dig(blockBelow);
      blocksBroken++;

      // Wait to fall
      await new Promise(resolve => setTimeout(resolve, 300));

      // Safety limit
      if (blocksBroken > 50) {
        return `Descended ${blocksBroken} blocks but safety limit reached`;
      }
    } catch (error: any) {
      break; // Can't dig anymore
    }
  }

  const finalY = Math.floor(bot.entity.position.y);
  const heightLost = Math.floor(startY) - finalY;

  return `Descended safely to Y=${finalY}. Broke ${blocksBroken} blocks (${heightLost} blocks down).`;
}
