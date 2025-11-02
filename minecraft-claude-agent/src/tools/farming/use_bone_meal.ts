import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

export interface UseBoneMealParams {
  x: number;
  y: number;
  z: number;
}

/**
 * Use bone meal on a crop or plant to accelerate its growth.
 * Bone meal instantly advances growth stages for most crops and plants.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Coordinates of the crop/plant to fertilize
 * @returns Result of bone meal application
 */
export async function use_bone_meal(
  bot: Bot,
  params: UseBoneMealParams
): Promise<string> {
  const { x, y, z } = params;

  try {
    const position = new Vec3(x, y, z);

    // Check if target block exists
    const block = bot.blockAt(position);
    if (!block) {
      return `No block found at (${x}, ${y}, ${z}).`;
    }

    // Blocks/crops that can be fertilized with bone meal
    const fertilizableBlocks = [
      'wheat', 'carrots', 'potatoes', 'beetroots',
      'melon_stem', 'pumpkin_stem',
      'oak_sapling', 'birch_sapling', 'spruce_sapling', 'jungle_sapling',
      'acacia_sapling', 'dark_oak_sapling', 'cherry_sapling',
      'grass_block', 'grass', 'dirt',
      'sugar_cane', 'cactus',
      'sweet_berry_bush',
      'bamboo',
      'moss_block', 'azalea',
      'flowers', 'mushrooms'
    ];

    const isFertilizable = fertilizableBlocks.some(type => block.name.includes(type));

    if (!isFertilizable && !block.name.includes('sapling') && !block.name.includes('crop')) {
      return `Cannot use bone meal on ${block.name} at (${x}, ${y}, ${z}). Bone meal works on: crops (wheat, carrots, potatoes, beetroots), saplings, grass, flowers, and some other plants.`;
    }

    // Check if we have bone meal
    const boneMeal = bot.inventory.items().find(item =>
      item.name === 'bone_meal'
    );

    if (!boneMeal) {
      return `Cannot use bone meal: No bone meal found in inventory. Craft bone meal from bones (dropped by skeletons) or use a composter.`;
    }

    const boneMealCountBefore = boneMeal.count;

    // Equip the bone meal
    await bot.equip(boneMeal, 'hand');

    // Calculate distance to block
    const distance = bot.entity.position.distanceTo(position);

    // Move closer if needed (interaction range is ~4.5 blocks)
    if (distance > 4) {
      try {
        await bot.pathfinder.goto(
          new (require('mineflayer-pathfinder').goals.GoalNear)(x, y, z, 3)
        );
      } catch (pathError) {
        return `Cannot reach block at (${x}, ${y}, ${z}) to use bone meal. Distance: ${distance.toFixed(1)} blocks.`;
      }
    }

    // Look at the block
    await bot.lookAt(position.offset(0.5, 0.5, 0.5));

    // Get block state before applying bone meal (to check growth stage if possible)
    const blockBefore = bot.blockAt(position);
    const blockNameBefore = blockBefore?.name || 'unknown';

    // Activate (right-click) with bone meal on the block
    await bot.activateBlock(block);

    // Wait a moment for fertilization effect
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check bone meal count after
    const boneMealAfter = bot.inventory.items().find(item =>
      item.name === 'bone_meal'
    );
    const boneMealCountAfter = boneMealAfter?.count || 0;
    const boneMealUsed = boneMealCountBefore - boneMealCountAfter;

    // Check if block changed (grew)
    const blockAfter = bot.blockAt(position);
    const blockNameAfter = blockAfter?.name || 'unknown';

    if (boneMealUsed > 0) {
      const changed = blockNameBefore !== blockNameAfter;

      return [
        `Successfully used bone meal at (${x}, ${y}, ${z})`,
        `Block: ${blockNameBefore}${changed ? ` → ${blockNameAfter}` : ''}`,
        `Bone meal used: ${boneMealUsed}`,
        `Bone meal remaining: ${boneMealCountAfter}`,
        ``,
        `Effects:`,
        `- Crops: Advances 1-4 growth stages per use`,
        `- Saplings: 45% chance to grow into tree`,
        `- Grass: Spreads tall grass and flowers`,
        `- Flowers/Mushrooms: May duplicate`,
        ``,
        `Note: Some crops may need multiple applications to reach full maturity.`
      ].join('\n');
    } else {
      return [
        `Attempted to use bone meal at (${x}, ${y}, ${z})`,
        `Block: ${blockNameBefore}`,
        `No bone meal was consumed. This might mean:`,
        `- Block cannot be fertilized (wrong block type)`,
        `- Crop is already fully grown`,
        `- Sapling doesn't have enough space to grow`,
        `- Block interaction failed`,
        ``,
        `Current bone meal: ${boneMealCountAfter}`
      ].join('\n');
    }

  } catch (error: any) {
    if (error.message.includes('too far')) {
      return `Block at (${x}, ${y}, ${z}) is too far away to use bone meal.`;
    }

    if (error.message.includes('cannot activate')) {
      return `Cannot use bone meal on block at (${x}, ${y}, ${z}). Make sure you're close enough and the block is accessible.`;
    }

    return `Failed to use bone meal at (${x}, ${y}, ${z}): ${error.message}`;
  }
}
