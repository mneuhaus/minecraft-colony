import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

/**
 * Place a sapling at a specific position
 * Validates the location is suitable (dirt/grass below, air above, proper light)
 */
export async function placeSapling(bot: Bot, x: number, y: number, z: number, saplingType: string): Promise<string> {
  const targetPos = new Vec3(x, y, z);

  // Validate sapling type
  const validSaplings = ['oak_sapling', 'spruce_sapling', 'birch_sapling', 'jungle_sapling', 'acacia_sapling', 'dark_oak_sapling'];
  if (!validSaplings.includes(saplingType)) {
    return `Invalid sapling type: ${saplingType}. Must be one of: ${validSaplings.join(', ')}`;
  }

  // Check if we have the sapling
  const item = bot.inventory.items().find(i => i.name === saplingType);
  if (!item) {
    return `Cannot place sapling: ${saplingType} not found in inventory`;
  }

  // Validate target position is air
  const targetBlock = bot.blockAt(targetPos);
  if (!targetBlock || targetBlock.name !== 'air') {
    return `Cannot place sapling at (${x}, ${y}, ${z}): position is not air (found ${targetBlock?.name || 'nothing'})`;
  }

  // Check block below is suitable (dirt, grass, podzol, coarse_dirt)
  const blockBelow = bot.blockAt(targetPos.offset(0, -1, 0));
  const validGround = ['dirt', 'grass_block', 'podzol', 'coarse_dirt'];
  if (!blockBelow || !validGround.includes(blockBelow.name)) {
    return `Cannot place sapling at (${x}, ${y}, ${z}): ground below is ${blockBelow?.name || 'nothing'}, need dirt/grass`;
  }

  // Check air above (need at least 2 blocks for small trees)
  const blockAbove1 = bot.blockAt(targetPos.offset(0, 1, 0));
  const blockAbove2 = bot.blockAt(targetPos.offset(0, 2, 0));
  if (blockAbove1?.name !== 'air' || blockAbove2?.name !== 'air') {
    return `Cannot place sapling at (${x}, ${y}, ${z}): need 2 blocks of air above (found ${blockAbove1?.name}, ${blockAbove2?.name})`;
  }

  // Check light level (saplings need light level >= 9)
  const skyLight = targetBlock.skyLight;
  const blockLight = targetBlock.light;
  const totalLight = Math.max(skyLight, blockLight);
  if (totalLight < 9) {
    return `Warning: Light level at (${x}, ${y}, ${z}) is ${totalLight} (need >= 9). Sapling may not grow.`;
  }

  // Check distance (must be within reach)
  const distance = bot.entity.position.distanceTo(targetPos);
  if (distance > 4.5) {
    return `Cannot place sapling: position (${x}, ${y}, ${z}) is too far away (${distance.toFixed(1)} blocks). Move closer first.`;
  }

  // Equip the sapling
  await bot.equip(item, 'hand');

  // Place the sapling (place against the dirt block below)
  const faceVector = new Vec3(0, 1, 0); // Point upward from dirt
  try {
    await bot.placeBlock(blockBelow, faceVector);
    return `Placed ${saplingType} at (${x}, ${y}, ${z})`;
  } catch (error: any) {
    // Verify if it was actually placed despite timeout
    await new Promise(resolve => setTimeout(resolve, 100));
    const placedBlock = bot.blockAt(targetPos);
    if (placedBlock && placedBlock.name === saplingType) {
      return `Placed ${saplingType} at (${x}, ${y}, ${z})`;
    }
    return `Failed to place sapling: ${error.message}`;
  }
}
