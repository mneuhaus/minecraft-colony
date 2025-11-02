import { Bot } from 'mineflayer';

export interface EquipItemParams {
  item_name: string;
  destination?: 'hand' | 'head' | 'torso' | 'legs' | 'feet' | 'off-hand';
}

/**
 * Equip an item from inventory to a specific slot (hand, armor, off-hand).
 * Useful for equipping tools, weapons, and armor.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Item to equip and destination slot
 * @returns Result of equip attempt
 */
export async function equip_item(
  bot: Bot,
  params: EquipItemParams
): Promise<string> {
  const { item_name, destination = 'hand' } = params;

  try {
    // Validate parameters
    if (!item_name || item_name.trim().length === 0) {
      return `Error: Item name cannot be empty.`;
    }

    // Find the item in inventory
    const item = bot.inventory.items().find(i => i.name === item_name);

    if (!item) {
      const availableItems = bot.inventory.items()
        .map(i => i.name)
        .filter((v, i, a) => a.indexOf(v) === i) // unique
        .slice(0, 10);

      return [
        `Error: "${item_name}" not found in inventory.`,
        ``,
        `Available items: ${availableItems.join(', ')}${availableItems.length >= 10 ? '...' : ''}`,
        ``,
        `Use check_inventory() to see full inventory.`,
      ].join('\n');
    }

    // Get current equipment in destination slot
    const currentlyEquipped = destination === 'hand'
      ? bot.heldItem
      : destination === 'off-hand'
      ? bot.inventory.slots[45] // off-hand slot
      : bot.inventory.slots[
          destination === 'head' ? 5 :
          destination === 'torso' ? 6 :
          destination === 'legs' ? 7 :
          destination === 'feet' ? 8 : 0
        ];

    const previousItem = currentlyEquipped?.name || 'nothing';

    // Equip the item
    await bot.equip(item, destination);

    // Wait a bit for equipment to register
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify equipment
    const nowEquipped = destination === 'hand'
      ? bot.heldItem
      : destination === 'off-hand'
      ? bot.inventory.slots[45]
      : bot.inventory.slots[
          destination === 'head' ? 5 :
          destination === 'torso' ? 6 :
          destination === 'legs' ? 7 :
          destination === 'feet' ? 8 : 0
        ];

    if (nowEquipped?.name === item_name) {
      const lines = [
        `✓ Successfully equipped ${item_name}!`,
        ``,
        `Slot: ${destination}`,
        `Previous: ${previousItem}`,
      ];

      // Add item stats if it's a tool/weapon/armor
      if (item.durabilityUsed !== undefined && item.maxDurability) {
        const remaining = item.maxDurability - item.durabilityUsed;
        const percentage = Math.round((remaining / item.maxDurability) * 100);
        lines.push(`Durability: ${remaining}/${item.maxDurability} (${percentage}%)`);
      }

      return lines.join('\n');
    } else {
      return `⚠ Attempted to equip ${item_name} but verification failed. Item may not be equippable to ${destination} slot.`;
    }

  } catch (error: any) {
    return [
      `Failed to equip "${item_name}": ${error.message}`,
      ``,
      `Common issues:`,
      `- Item not in inventory`,
      `- Item cannot be equipped to specified slot`,
      `- Invalid destination (use: hand, head, torso, legs, feet, off-hand)`,
    ].join('\n');
  }
}
