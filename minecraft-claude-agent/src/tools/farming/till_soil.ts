import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { goals } from 'mineflayer-pathfinder';

export interface TillSoilParams {
  x: number;
  y: number;
  z: number;
}

/**
 * Till soil (convert dirt or grass to farmland) for planting crops.
 * Bot will equip a hoe if available and use it to till the ground.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Coordinates of the block to till
 * @returns Result of tilling attempt
 */
export async function till_soil(
  bot: Bot,
  params: TillSoilParams
): Promise<string> {
  const { x, y, z } = params;

  try {
    const position = new Vec3(x, y, z);

    // Check if target block exists and is dirt or grass
    const block = bot.blockAt(position);
    if (!block) {
      return `No block found at (${x}, ${y}, ${z}).`;
    }

    // Valid blocks that can be tilled
    const tillableBlocks = ['dirt', 'grass_block', 'grass', 'dirt_path', 'coarse_dirt'];

    if (!tillableBlocks.includes(block.name)) {
      return `Cannot till ${block.name} at (${x}, ${y}, ${z}). Only dirt, grass blocks, or dirt paths can be tilled.`;
    }

    // Check if already farmland
    if (block.name === 'farmland') {
      return `Block at (${x}, ${y}, ${z}) is already farmland.`;
    }

    // Find a hoe in inventory
    const hoe = bot.inventory.items().find(item =>
      item.name.includes('hoe')
    );

    if (!hoe) {
      return `Cannot till soil: No hoe found in inventory. Craft or obtain a hoe (wooden, stone, iron, diamond, or netherite).`;
    }

    // Equip the hoe
    await bot.equip(hoe, 'hand');

    // Calculate distance to block
    const distance = bot.entity.position.distanceTo(position);

    // Move closer if needed (interaction range is ~4.5 blocks)
    if (distance > 4) {
      try {
        await bot.pathfinder.goto(
          new goals.GoalNear(x, y, z, 3)
        );
      } catch (pathError) {
        return `Cannot reach block at (${x}, ${y}, ${z}) to till. Distance: ${distance.toFixed(1)} blocks.`;
      }
    }

    // Look at the block
    await bot.lookAt(position.offset(0.5, 0.5, 0.5));

    // Activate (right-click) the hoe on the block to till it
    await bot.activateBlock(block);

    // Wait a moment for the tilling to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify the block changed to farmland
    const tilledBlock = bot.blockAt(position);
    if (tilledBlock && tilledBlock.name === 'farmland') {
      return [
        `Successfully tilled soil at (${x}, ${y}, ${z})`,
        `Block changed: ${block.name} → farmland`,
        `Tool used: ${hoe.name}`,
        `Ready for planting crops!`
      ].join('\n');
    } else {
      return `Attempted to till soil at (${x}, ${y}, ${z}), but block may not have changed. Current block: ${tilledBlock?.name || 'unknown'}`;
    }

  } catch (error: any) {
    if (error.message.includes('too far')) {
      return `Block at (${x}, ${y}, ${z}) is too far away to till.`;
    }

    if (error.message.includes('cannot activate')) {
      return `Cannot till block at (${x}, ${y}, ${z}). Make sure you're close enough and the block is accessible.`;
    }

    return `Failed to till soil at (${x}, ${y}, ${z}): ${error.message}`;
  }
}
