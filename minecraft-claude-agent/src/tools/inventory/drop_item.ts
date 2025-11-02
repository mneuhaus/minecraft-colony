import { Bot } from 'mineflayer';

export interface DropItemParams {
  item_name: string;
  count?: number;
}

/**
 * Drop items from inventory onto the ground.
 * Useful for discarding unwanted items or transferring items between bots.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Item to drop and quantity
 * @returns Result of drop attempt
 */
export async function drop_item(
  bot: Bot,
  params: DropItemParams
): Promise<string> {
  const { item_name, count } = params;

  try {
    // Validate parameters
    if (!item_name || item_name.trim().length === 0) {
      return `Error: Item name cannot be empty.`;
    }

    // Find all items with this name
    const items = bot.inventory.items().filter(i => i.name === item_name);

    if (items.length === 0) {
      return [
        `Error: "${item_name}" not found in inventory.`,
        ``,
        `Use check_inventory() to see available items.`,
      ].join('\n');
    }

    // Calculate total available
    const totalAvailable = items.reduce((sum, item) => sum + item.count, 0);

    // Determine how many to drop
    const toDrop = count !== undefined ? Math.min(count, totalAvailable) : totalAvailable;

    if (toDrop <= 0) {
      return `Error: Count must be greater than 0 (requested: ${count}, available: ${totalAvailable}).`;
    }

    // Drop the items
    let dropped = 0;
    for (const item of items) {
      if (dropped >= toDrop) break;

      const dropCount = Math.min(item.count, toDrop - dropped);
      await bot.toss(item.type, null, dropCount);
      dropped += dropCount;

      // Small delay between drops to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const remaining = totalAvailable - dropped;

    return [
      `✓ Dropped ${dropped}x ${item_name}`,
      ``,
      `Remaining in inventory: ${remaining}`,
      count !== undefined && count > totalAvailable
        ? `⚠ Requested ${count} but only had ${totalAvailable}`
        : '',
      ``,
      `Dropped items will despawn after 5 minutes if not picked up.`,
    ].filter(Boolean).join('\n');

  } catch (error: any) {
    return [
      `Failed to drop "${item_name}": ${error.message}`,
      ``,
      `Common issues:`,
      `- Item not in inventory`,
      `- Invalid item name`,
    ].join('\n');
  }
}
