import { Bot } from 'mineflayer';

export interface MilkCowParams {
  max_distance?: number;
}

/**
 * Milk a nearby cow to get a milk bucket.
 * Bot will find nearest cow and use a bucket to collect milk.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Maximum search distance for cows
 * @returns Result of milking attempt
 */
export async function milk_cow(
  bot: Bot,
  params: MilkCowParams = {}
): Promise<string> {
  const { max_distance = 16 } = params;

  try {
    // Find nearby cows
    const entities = Object.values(bot.entities).filter((entity: any) => {
      if (!entity || !entity.position) return false;

      const distance = bot.entity.position.distanceTo(entity.position);
      const isCow = entity.name === 'cow' || entity.type === 'cow';

      return isCow && distance <= max_distance;
    });

    if (entities.length === 0) {
      return `No cows found within ${max_distance} blocks. Cows spawn in grass plains and other grassy biomes.`;
    }

    // Find nearest cow
    let nearestCow: any | null = null;
    let nearestDistance = Infinity;

    for (const entity of entities) {
      const distance = bot.entity.position.distanceTo(entity.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestCow = entity;
      }
    }

    if (!nearestCow) {
      return `Failed to find nearest cow.`;
    }

    // Check if we have an empty bucket
    const bucket = bot.inventory.items().find(item =>
      item.name === 'bucket'
    );

    if (!bucket) {
      return `Cannot milk cow: No empty bucket found in inventory. Craft a bucket with 3 iron ingots.`;
    }

    // Count milk buckets before milking
    const milkBucketsBefore = bot.inventory.items()
      .filter(item => item.name === 'milk_bucket')
      .reduce((sum, item) => sum + item.count, 0);

    // Equip the bucket
    await bot.equip(bucket, 'hand');

    // Move closer if needed (interaction range is ~3 blocks)
    if (nearestDistance > 3) {
      try {
        await bot.pathfinder.goto(
          new (require('mineflayer-pathfinder').goals.GoalNear)(
            nearestCow.position.x,
            nearestCow.position.y,
            nearestCow.position.z,
            2
          )
        );
      } catch (pathError) {
        return `Cannot reach cow at distance ${nearestDistance.toFixed(1)} blocks.`;
      }
    }

    // Look at the cow
    await bot.lookAt(nearestCow.position.offset(0, nearestCow.height / 2, 0));

    // Use (right-click) the bucket on the cow
    await bot.activateEntity(nearestCow);

    // Wait a moment for milking to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Count buckets after milking
    const emptyBucketsAfter = bot.inventory.items()
      .filter(item => item.name === 'bucket')
      .reduce((sum, item) => sum + item.count, 0);

    const milkBucketsAfter = bot.inventory.items()
      .filter(item => item.name === 'milk_bucket')
      .reduce((sum, item) => sum + item.count, 0);

    const milkBucketChange = milkBucketsAfter - milkBucketsBefore;

    if (milkBucketChange > 0) {
      return [
        `Successfully milked cow!`,
        `Milk buckets collected: ${milkBucketChange}`,
        `Empty buckets remaining: ${emptyBucketsAfter}`,
        `Total milk buckets: ${milkBucketsAfter}`,
        `Distance: ${nearestDistance.toFixed(1)} blocks`,
        ``,
        `Milk bucket uses:`,
        `- Drink to remove all status effects (poison, wither, etc.)`,
        `- Craft into cake (requires eggs, sugar, wheat)`,
        `- Cows can be milked unlimited times with no cooldown`
      ].join('\n');
    } else {
      return [
        `Attempted to milk cow at distance ${nearestDistance.toFixed(1)} blocks.`,
        `No milk bucket received. This might indicate:`,
        `- Inventory is full (clear space for milk bucket)`,
        `- Bucket was not properly equipped`,
        `- Entity interaction failed`,
        `Try again with inventory space available.`
      ].join('\n');
    }

  } catch (error: any) {
    if (error.message.includes('entity not found')) {
      return `Cow moved away or is no longer available.`;
    }

    if (error.message.includes('too far')) {
      return `Cow is too far away to milk. Move closer first.`;
    }

    if (error.message.includes('cannot activate')) {
      return `Cannot milk cow. Make sure you're close enough and have a bucket equipped.`;
    }

    return `Failed to milk cow: ${error.message}`;
  }
}
