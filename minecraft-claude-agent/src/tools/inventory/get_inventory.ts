import { Bot } from 'mineflayer';

/**
 * Get a list of all items in the bot's inventory.
 * Returns item names, counts, and slot positions.
 *
 * @param bot - The Mineflayer bot instance
 * @returns Formatted string with inventory contents
 */
export async function get_inventory(bot: Bot): Promise<string> {
  try {
    const items = bot.inventory.items();

    if (items.length === 0) {
      return 'Inventory is empty.';
    }

    // Group items by name and count total
    const itemCounts: { [key: string]: number } = {};
    items.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.count;
    });

    const lines = ['Current Inventory:', ''];

    // Sort by item name for consistent output
    const sortedItems = Object.entries(itemCounts).sort((a, b) => a[0].localeCompare(b[0]));

    sortedItems.forEach(([name, count]) => {
      lines.push(`  ${count}x ${name}`);
    });

    lines.push('');
    lines.push(`Total: ${sortedItems.length} different item type(s)`);
    lines.push(`Total items: ${items.reduce((sum, item) => sum + item.count, 0)}`);
    lines.push(`Slots used: ${items.length}/36`);

    return lines.join('\n');

  } catch (error: any) {
    return `Failed to get inventory: ${error.message}`;
  }
}
