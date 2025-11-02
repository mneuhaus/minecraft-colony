import { Bot } from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;

/**
 * Collect nearby item entities
 * Returns what was collected and what was missed
 */
export async function collectNearbyItems(bot: Bot, itemTypes: string[] = [], radius: number = 10): Promise<string> {
  const collected: Record<string, number> = {};
  const missed: { item: string; reason: string }[] = [];
  const startTime = Date.now();
  const timeout = 15000; // 15 seconds max

  // Find all item entities
  const itemEntities = Object.values(bot.entities).filter(entity =>
    entity.name === 'item' &&
    entity.position.distanceTo(bot.entity.position) <= radius
  );

  if (itemEntities.length === 0) {
    return `No items found within ${radius} blocks`;
  }

  for (const entity of itemEntities) {
    if (Date.now() - startTime > timeout) {
      missed.push({ item: 'remaining items', reason: 'timeout' });
      break;
    }

    // Check if this item type is requested (if filter specified)
    const metadata = (entity as any).metadata;
    const itemStack = metadata?.[8]; // Item stack is usually at index 8
    const itemName = itemStack?.itemId ? bot.registry.items[itemStack.itemId]?.name : 'unknown';

    if (itemTypes.length > 0 && !itemTypes.includes(itemName)) {
      continue; // Skip items not in filter
    }

    try {
      // Try to pathfind to item
      const goal = new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 1);
      await bot.pathfinder.goto(goal);

      // Wait a moment for pickup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Count collected
      collected[itemName] = (collected[itemName] || 0) + (itemStack?.itemCount || 1);
    } catch (error: any) {
      missed.push({ item: itemName, reason: 'unreachable' });
    }
  }

  const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);

  const result: string[] = [];

  if (Object.keys(collected).length > 0) {
    const collectedStr = Object.entries(collected)
      .map(([item, count]) => `${count}x ${item}`)
      .join(', ');
    result.push(`Collected: ${collectedStr}`);
  }

  if (missed.length > 0) {
    const missedStr = missed.map(m => `${m.item} (${m.reason})`).join(', ');
    result.push(`Missed: ${missedStr}`);
  }

  result.push(`Time taken: ${timeTaken} seconds`);

  return result.join('. ');
}
