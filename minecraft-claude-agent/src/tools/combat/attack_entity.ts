import { Bot } from 'mineflayer';
import { goals } from 'mineflayer-pathfinder';

export interface AttackEntityParams {
  entity_type?: string; // e.g., "zombie", "skeleton", "creeper"
  max_distance?: number; // Maximum distance to find target (default: 10)
}

/**
 * Attack a nearby hostile entity.
 * Bot will find the nearest entity of specified type and attack it.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Entity type to attack and max search distance
 * @returns Result of attack attempt
 */
export async function attack_entity(
  bot: Bot,
  params: AttackEntityParams
): Promise<string> {
  const { entity_type, max_distance = 10 } = params;

  try {
    if (!entity_type) {
      return `Error: Must specify entity_type to attack (e.g., "zombie", "skeleton", "creeper")`;
    }

    // Find nearby entities of specified type
    const entities = Object.values(bot.entities).filter((entity: any) => {
      if (!entity || !entity.position) return false;

      const distance = bot.entity.position.distanceTo(entity.position);
      const matchesType = entity.name === entity_type || entity.type === entity_type;

      return matchesType && distance <= max_distance;
    });

    if (entities.length === 0) {
      return `No ${entity_type} found within ${max_distance} blocks.`;
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

    // Get current weapon
    const weapon = bot.inventory.items().find(item =>
      item.name.includes('sword') ||
      item.name.includes('axe') ||
      item.name === 'trident'
    );

    if (weapon) {
      await bot.equip(weapon, 'hand');
    }

    // Move closer if needed (attack range is ~3 blocks)
    if (nearestDistance > 3.5) {
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
        // Pathfinding failed, try to attack anyway
      }
    }

    // Attack the entity
    await bot.attack(nearestEntity);

    // Wait a moment for attack to register
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if entity is still alive
    const stillAlive = Object.values(bot.entities).some(
      (e: any) => e.id === nearestEntity!.id
    );

    if (stillAlive) {
      return [
        `Attacked ${entity_type} at distance ${nearestDistance.toFixed(1)} blocks`,
        `Weapon: ${weapon ? weapon.name : 'fists (no weapon equipped)'}`,
        `Entity still alive - continue attacking or flee if necessary`,
      ].join('\n');
    } else {
      return [
        `Successfully killed ${entity_type}!`,
        `Weapon used: ${weapon ? weapon.name : 'fists'}`,
        `Distance: ${nearestDistance.toFixed(1)} blocks`,
      ].join('\n');
    }

  } catch (error: any) {
    if (error.message.includes('entity is not alive')) {
      return `${entity_type} is already dead.`;
    }

    if (error.message.includes('too far')) {
      return `${entity_type} is too far away to attack. Move closer first.`;
    }

    return `Failed to attack ${entity_type}: ${error.message}`;
  }
}
