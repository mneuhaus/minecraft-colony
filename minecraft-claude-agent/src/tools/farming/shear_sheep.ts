import { Bot } from 'mineflayer';

export interface ShearSheepParams {
  max_distance?: number;
}

/**
 * Shear a nearby sheep to collect wool.
 * Bot will find nearest sheep and use shears to collect 1-3 wool blocks.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Maximum search distance for sheep
 * @returns Result of shearing attempt
 */
export async function shear_sheep(
  bot: Bot,
  params: ShearSheepParams = {}
): Promise<string> {
  const { max_distance = 16 } = params;

  try {
    // Find nearby sheep
    const entities = Object.values(bot.entities).filter((entity: any) => {
      if (!entity || !entity.position) return false;

      const distance = bot.entity.position.distanceTo(entity.position);
      const isSheep = entity.name === 'sheep' || entity.type === 'sheep';

      return isSheep && distance <= max_distance;
    });

    if (entities.length === 0) {
      return `No sheep found within ${max_distance} blocks. Sheep spawn in grass plains and other grassy biomes.`;
    }

    // Find nearest sheep
    let nearestSheep: any | null = null;
    let nearestDistance = Infinity;

    for (const entity of entities) {
      const distance = bot.entity.position.distanceTo(entity.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSheep = entity;
      }
    }

    if (!nearestSheep) {
      return `Failed to find nearest sheep.`;
    }

    // Check if we have shears
    const shears = bot.inventory.items().find(item =>
      item.name === 'shears'
    );

    if (!shears) {
      return `Cannot shear sheep: No shears found in inventory. Craft shears with 2 iron ingots.`;
    }

    // Equip the shears
    await bot.equip(shears, 'hand');

    // Move closer if needed (interaction range is ~3 blocks)
    if (nearestDistance > 3) {
      try {
        await bot.pathfinder.goto(
          new (require('mineflayer-pathfinder').goals.GoalNear)(
            nearestSheep.position.x,
            nearestSheep.position.y,
            nearestSheep.position.z,
            2
          )
        );
      } catch (pathError) {
        return `Cannot reach sheep at distance ${nearestDistance.toFixed(1)} blocks.`;
      }
    }

    // Look at the sheep
    await bot.lookAt(nearestSheep.position.offset(0, nearestSheep.height / 2, 0));

    // Count wool before shearing
    const woolBefore = bot.inventory.items()
      .filter(item => item.name.includes('wool'))
      .reduce((sum, item) => sum + item.count, 0);

    // Use (right-click) the shears on the sheep
    await bot.activateEntity(nearestSheep);

    // Wait a moment for shearing to complete and items to drop
    await new Promise(resolve => setTimeout(resolve, 500));

    // Collect nearby items
    await bot.pathfinder.goto(
      new (require('mineflayer-pathfinder').goals.GoalNear)(
        nearestSheep.position.x,
        nearestSheep.position.y,
        nearestSheep.position.z,
        1
      )
    );

    // Wait for item collection
    await new Promise(resolve => setTimeout(resolve, 300));

    // Count wool after shearing
    const woolAfter = bot.inventory.items()
      .filter(item => item.name.includes('wool'))
      .reduce((sum, item) => sum + item.count, 0);

    const woolGained = woolAfter - woolBefore;

    if (woolGained > 0) {
      // Try to determine wool color
      const woolItems = bot.inventory.items().filter(item => item.name.includes('wool'));
      const woolTypes = [...new Set(woolItems.map(item => item.name))].join(', ');

      return [
        `Successfully sheared sheep!`,
        `Wool collected: ${woolGained} blocks`,
        `Wool types: ${woolTypes}`,
        `Distance: ${nearestDistance.toFixed(1)} blocks`,
        `Note: Sheep wool will regrow when it eats grass. Sheep appear naked after shearing.`
      ].join('\n');
    } else {
      return [
        `Attempted to shear sheep at distance ${nearestDistance.toFixed(1)} blocks.`,
        `No wool collected - sheep may have been already sheared (appears naked).`,
        `Wool regrows when sheep eats grass. Wait for wool to regrow before shearing again.`
      ].join('\n');
    }

  } catch (error: any) {
    if (error.message.includes('entity not found')) {
      return `Sheep moved away or is no longer available.`;
    }

    if (error.message.includes('too far')) {
      return `Sheep is too far away to shear. Move closer first.`;
    }

    if (error.message.includes('cannot activate')) {
      return `Cannot shear sheep. Make sure you're close enough and have shears equipped.`;
    }

    return `Failed to shear sheep: ${error.message}`;
  }
}
