import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';

export interface CollectItemsParams {
  item_name?: string;
  max_distance?: number;
  timeout?: number;
}

/**
 * Collect nearby dropped items from the ground.
 * If item_name is specified, only collects that item type.
 * Otherwise collects all nearby items.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Optional item filter, distance, and timeout
 * @returns Result of collection attempt with counts
 */
export async function collect_items(
  bot: Bot,
  params: CollectItemsParams = {}
): Promise<string> {
  const { item_name, max_distance = 16, timeout = 5000 } = params;

  try {
    if (max_distance < 1 || max_distance > 64) {
      return `Error: max_distance must be between 1 and 64 (provided: ${max_distance}).`;
    }

    // Find nearby dropped items
    const nearbyItems = Object.values(bot.entities).filter((entity: any) => {
      if (!entity || !entity.position) return false;

      // Check if it's a dropped item (objectType: Item)
      if (entity.type !== 'object' || entity.objectType !== 'Item') return false;

      // Check distance
      const distance = bot.entity.position.distanceTo(entity.position);
      if (distance > max_distance) return false;

      // If filtering by item name, check metadata
      if (item_name && entity.metadata && entity.metadata[8]) {
        const itemData = entity.metadata[8];
        // ItemStack metadata contains item info
        if (typeof itemData === 'object' && itemData.itemId) {
          const mcData = minecraftData(bot.version);
          const item = mcData.items[itemData.itemId];
          if (item && item.name !== item_name) return false;
        }
      }

      return true;
    });

    if (nearbyItems.length === 0) {
      return [
        item_name
          ? `No "${item_name}" items found nearby.`
          : `No dropped items found within ${max_distance} blocks.`,
        ``,
        `Items may have despawned (5 minute timer) or are farther away.`,
      ].join('\n');
    }

    // Count items before collection
    const inventoryBefore: { [key: string]: number } = {};
    bot.inventory.items().forEach(item => {
      inventoryBefore[item.name] = (inventoryBefore[item.name] || 0) + item.count;
    });

    // Move toward and collect items
    const startTime = Date.now();

    for (const itemEntity of nearbyItems) {
      if (Date.now() - startTime > timeout) {
        break; // Timeout reached
      }

      try {
        // Move close to the item
        const goal = new (require('mineflayer-pathfinder').goals.GoalNear)(
          itemEntity.position.x,
          itemEntity.position.y,
          itemEntity.position.z,
          1
        );

        bot.pathfinder.setGoal(goal);

        // Wait for collection or timeout
        const collectTimeout = 3000;
        const collectStart = Date.now();

        while (Date.now() - collectStart < collectTimeout) {
          // Check if item still exists
          const stillExists = bot.entities[itemEntity.id];
          if (!stillExists) {
            // Item was collected!
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        // Couldn't reach this item, continue to next
        continue;
      }
    }

    // Stop pathfinding
    bot.pathfinder.setGoal(null);

    // Count items after collection
    const inventoryAfter: { [key: string]: number } = {};
    bot.inventory.items().forEach(item => {
      inventoryAfter[item.name] = (inventoryAfter[item.name] || 0) + item.count;
    });

    // Calculate what was collected
    const collectedItems: { [key: string]: number } = {};
    for (const itemName in inventoryAfter) {
      const before = inventoryBefore[itemName] || 0;
      const after = inventoryAfter[itemName];
      if (after > before) {
        collectedItems[itemName] = after - before;
      }
    }

    if (Object.keys(collectedItems).length === 0) {
      return [
        `⚠ Found ${nearbyItems.length} dropped item(s) but couldn't collect any.`,
        ``,
        `Possible reasons:`,
        `- Items too far away or unreachable`,
        `- Inventory full`,
        `- Pathfinding blocked`,
      ].join('\n');
    }

    const lines = [
      `✓ Successfully collected items!`,
      ``,
    ];

    for (const itemName in collectedItems) {
      lines.push(`  +${collectedItems[itemName]}x ${itemName}`);
    }

    lines.push(``);
    lines.push(`Total items collected: ${Object.values(collectedItems).reduce((a, b) => a + b, 0)}`);
    lines.push(`Collection time: ${Math.floor((Date.now() - startTime) / 1000)}s`);

    return lines.join('\n');

  } catch (error: any) {
    return [
      `Failed to collect items: ${error.message}`,
      ``,
      `Common issues:`,
      `- No items nearby`,
      `- Inventory full`,
      `- Pathfinding issues`,
    ].join('\n');
  }
}
