import { Bot } from 'mineflayer';
import { goals } from 'mineflayer-pathfinder';

export interface FeedEntityParams {
  entity_type: string; // e.g., "cow", "sheep", "pig", "chicken"
  food_item: string;   // e.g., "wheat", "seeds", "carrot"
  max_distance?: number;
}

/**
 * Feed an animal to breed it or speed up baby growth.
 * Bot will find nearest animal of specified type and feed it the appropriate food.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Entity type, food item, and search distance
 * @returns Result of feeding attempt
 */
export async function feed_entity(
  bot: Bot,
  params: FeedEntityParams
): Promise<string> {
  const { entity_type, food_item, max_distance = 16 } = params;

  try {
    // Animal breeding foods reference
    const breedingFoods: { [key: string]: string[] } = {
      'cow': ['wheat'],
      'mooshroom': ['wheat'],
      'sheep': ['wheat'],
      'pig': ['carrot', 'potato', 'beetroot'],
      'chicken': ['wheat_seeds', 'beetroot_seeds', 'melon_seeds', 'pumpkin_seeds'],
      'rabbit': ['carrot', 'golden_carrot', 'dandelion'],
      'horse': ['golden_apple', 'golden_carrot'],
      'donkey': ['golden_apple', 'golden_carrot'],
      'llama': ['hay_block'],
      'wolf': ['bone'], // for taming, not breeding
      'cat': ['raw_cod', 'raw_salmon'], // for taming
      'parrot': ['wheat_seeds', 'beetroot_seeds', 'melon_seeds', 'pumpkin_seeds'],
    };

    // Find nearby entities of specified type
    const entities = Object.values(bot.entities).filter((entity: any) => {
      if (!entity || !entity.position) return false;

      const distance = bot.entity.position.distanceTo(entity.position);
      const matchesType = entity.name === entity_type || entity.type === entity_type;

      return matchesType && distance <= max_distance;
    });

    if (entities.length === 0) {
      const validFoods = breedingFoods[entity_type]?.join(', ') || 'unknown';
      return `No ${entity_type} found within ${max_distance} blocks. Valid foods for ${entity_type}: ${validFoods}`;
    }

    // Find nearest entity
    let nearestEntity: any | null = null;
    let nearestDistance = Infinity;

    for (const entity of entities) {
      const distance = bot.entity.position.distanceTo(entity.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEntity = entity;
      }
    }

    if (!nearestEntity) {
      return `Failed to find nearest ${entity_type}.`;
    }

    // Check if we have the food item
    const foodInInventory = bot.inventory.items().find(item =>
      item.name === food_item || item.name.includes(food_item)
    );

    if (!foodInInventory) {
      const validFoods = breedingFoods[entity_type]?.join(', ') || 'unknown';
      return `Cannot feed ${entity_type}: ${food_item} not found in inventory. Valid foods: ${validFoods}`;
    }

    // Validate food is correct for this animal
    const validFoods = breedingFoods[entity_type];
    if (validFoods && !validFoods.some(f => foodInInventory.name.includes(f))) {
      return `Cannot feed ${entity_type} with ${foodInInventory.name}. Valid foods: ${validFoods.join(', ')}`;
    }

    // Equip the food item
    await bot.equip(foodInInventory, 'hand');

    // Move closer if needed (interaction range is ~3 blocks)
    if (nearestDistance > 3) {
      try {
        await bot.pathfinder.goto(
          new goals.GoalNear(
            nearestEntity.position.x,
            nearestEntity.position.y,
            nearestEntity.position.z,
            2
          )
        );
      } catch (pathError) {
        return `Cannot reach ${entity_type} at distance ${nearestDistance.toFixed(1)} blocks.`;
      }
    }

    // Look at the entity
    await bot.lookAt(nearestEntity.position.offset(0, nearestEntity.height / 2, 0));

    // Use (right-click) the food on the entity
    // This is done by activating the entity while holding food
    await bot.activateEntity(nearestEntity);

    // Wait a moment for feeding to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if entity is in love mode (hearts appear)
    // Note: We can't directly check love mode with current Mineflayer API
    // but we can verify the action was performed

    return [
      `Successfully fed ${entity_type} with ${foodInInventory.name}`,
      `Distance: ${nearestDistance.toFixed(1)} blocks`,
      `Action: Animal should enter love mode (hearts)`,
      `Note: Feed another ${entity_type} nearby to breed them!`,
      `Baby animals grow faster when fed their breeding food.`
    ].join('\n');

  } catch (error: any) {
    if (error.message.includes('entity not found')) {
      return `${entity_type} moved away or is no longer available.`;
    }

    if (error.message.includes('too far')) {
      return `${entity_type} is too far away to feed. Move closer first.`;
    }

    if (error.message.includes('cannot activate')) {
      return `Cannot feed ${entity_type}. Make sure you're close enough and have the correct food equipped.`;
    }

    return `Failed to feed ${entity_type}: ${error.message}`;
  }
}
