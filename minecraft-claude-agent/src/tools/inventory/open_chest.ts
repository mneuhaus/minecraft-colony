import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

export interface OpenChestParams {
  x: number;
  y: number;
  z: number;
}

/**
 * Open a chest at specific coordinates and return its contents.
 * This allows bots to view chest inventory without taking items.
 *
 * @param bot - The Mineflayer bot instance
 * @param x - X coordinate of chest
 * @param y - Y coordinate of chest
 * @param z - Z coordinate of chest
 * @returns String describing chest contents
 */
export async function open_chest(
  bot: Bot,
  params: OpenChestParams
): Promise<string> {
  const { x, y, z } = params;

  try {
    const targetPos = new Vec3(x, y, z);
    const block = bot.blockAt(targetPos);

    if (!block) {
      return `No block found at (${x}, ${y}, ${z})`;
    }

    // Check if it's a chest (including trapped chests, barrels, shulker boxes)
    const chestTypes = ['chest', 'trapped_chest', 'barrel', 'ender_chest',
                        'shulker_box', 'white_shulker_box', 'orange_shulker_box',
                        'magenta_shulker_box', 'light_blue_shulker_box',
                        'yellow_shulker_box', 'lime_shulker_box', 'pink_shulker_box',
                        'gray_shulker_box', 'light_gray_shulker_box', 'cyan_shulker_box',
                        'purple_shulker_box', 'blue_shulker_box', 'brown_shulker_box',
                        'green_shulker_box', 'red_shulker_box', 'black_shulker_box'];

    if (!chestTypes.includes(block.name)) {
      return `Block at (${x}, ${y}, ${z}) is ${block.name}, not a storage container`;
    }

    // Check if chest is reachable
    const distance = bot.entity.position.distanceTo(targetPos);
    if (distance > 6) {
      return `Chest at (${x}, ${y}, ${z}) is too far away (${distance.toFixed(1)} blocks). Move closer (within 6 blocks).`;
    }

    // Open the chest
    const chest = await bot.openContainer(block);

    if (!chest) {
      return `Failed to open ${block.name} at (${x}, ${y}, ${z})`;
    }

    // Read chest contents
    const items: { [key: string]: number } = {};

    for (const item of chest.containerItems()) {
      if (item) {
        const itemName = item.name;
        items[itemName] = (items[itemName] || 0) + item.count;
      }
    }

    // Close the chest
    chest.close();

    // Format output
    if (Object.keys(items).length === 0) {
      return `${block.name} at (${x}, ${y}, ${z}) is empty`;
    }

    const itemList = Object.entries(items)
      .map(([name, count]) => `${name} x${count}`)
      .join(', ');

    return `${block.name} at (${x}, ${y}, ${z}) contains: ${itemList}`;

  } catch (error: any) {
    return `Error opening chest at (${x}, ${y}, ${z}): ${error.message}`;
  }
}
