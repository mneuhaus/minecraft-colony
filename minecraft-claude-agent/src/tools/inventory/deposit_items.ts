import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

export interface DepositItemsParams {
  x: number;
  y: number;
  z: number;
  item_name: string;
  count?: number;
}

/**
 * Deposit items from bot inventory into a chest at specific coordinates.
 *
 * @param bot - The Mineflayer bot instance
 * @param x - X coordinate of chest
 * @param y - Y coordinate of chest
 * @param z - Z coordinate of chest
 * @param item_name - Name of item to deposit (e.g., "oak_log", "cobblestone")
 * @param count - Number of items to deposit (optional, defaults to all)
 * @returns Confirmation message
 */
export async function deposit_items(
  bot: Bot,
  params: DepositItemsParams
): Promise<string> {
  const { x, y, z, item_name, count } = params;

  try {
    const targetPos = new Vec3(x, y, z);
    const block = bot.blockAt(targetPos);

    if (!block) {
      return `No block found at (${x}, ${y}, ${z})`;
    }

    // Check if it's a storage container
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

    // Find item in inventory
    const item = bot.inventory.items().find(i => i.name.includes(item_name));

    if (!item) {
      return `No ${item_name} found in inventory`;
    }

    const depositCount = count && count < item.count ? count : item.count;

    // Open the chest
    const chest = await bot.openContainer(block);

    if (!chest) {
      return `Failed to open ${block.name} at (${x}, ${y}, ${z})`;
    }

    // Deposit items
    await chest.deposit(item.type, null, depositCount);

    // Close the chest
    chest.close();

    return `Deposited ${depositCount}x ${item.name} into ${block.name} at (${x}, ${y}, ${z})`;

  } catch (error: any) {
    return `Error depositing items into chest at (${x}, ${y}, ${z}): ${error.message}`;
  }
}
