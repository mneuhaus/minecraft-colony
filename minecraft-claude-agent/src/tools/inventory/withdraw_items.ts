import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

export interface WithdrawItemsParams {
  x: number;
  y: number;
  z: number;
  item_name: string;
  count?: number;
}

/**
 * Withdraw items from a chest at specific coordinates into bot inventory.
 *
 * @param bot - The Mineflayer bot instance
 * @param x - X coordinate of chest
 * @param y - Y coordinate of chest
 * @param z - Z coordinate of chest
 * @param item_name - Name of item to withdraw (e.g., "oak_log", "cobblestone")
 * @param count - Number of items to withdraw (optional, defaults to all)
 * @returns Confirmation message
 */
export async function withdraw_items(
  bot: Bot,
  params: WithdrawItemsParams
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

    // Open the chest
    const chest = await bot.openContainer(block);

    if (!chest) {
      return `Failed to open ${block.name} at (${x}, ${y}, ${z})`;
    }

    // Find item in chest
    const item = chest.containerItems().find(i => i && i.name.includes(item_name));

    if (!item) {
      chest.close();
      return `No ${item_name} found in ${block.name} at (${x}, ${y}, ${z})`;
    }

    const withdrawCount = count && count < item.count ? count : item.count;

    // Withdraw items
    await chest.withdraw(item.type, null, withdrawCount);

    // Close the chest
    chest.close();

    return `Withdrew ${withdrawCount}x ${item.name} from ${block.name} at (${x}, ${y}, ${z})`;

  } catch (error: any) {
    return `Error withdrawing items from chest at (${x}, ${y}, ${z}): ${error.message}`;
  }
}
