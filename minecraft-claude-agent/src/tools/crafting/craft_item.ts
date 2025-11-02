import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';

export interface CraftItemParams {
  item_name: string;
  count?: number;
}

/**
 * Craft items using a crafting table or inventory crafting grid.
 * Automatically finds nearby crafting table if recipe requires 3x3 grid.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Item to craft and quantity
 * @returns Result of crafting attempt
 */
export async function craft_item(
  bot: Bot,
  params: CraftItemParams
): Promise<string> {
  const { item_name, count = 1 } = params;

  try {
    // Validate parameters
    if (!item_name || item_name.trim().length === 0) {
      return `Error: Item name cannot be empty.`;
    }

    if (count < 1 || count > 64) {
      return `Error: Count must be between 1 and 64 (requested: ${count}).`;
    }

    // Get the item ID from registry
    const mcData = minecraftData(bot.version);
    const item = mcData.itemsByName[item_name];

    if (!item) {
      return [
        `Error: Unknown item "${item_name}".`,
        ``,
        `Common craftable items:`,
        `- Wooden planks: "oak_planks", "spruce_planks", etc.`,
        `- Tools: "wooden_pickaxe", "stone_axe", "iron_sword"`,
        `- Blocks: "crafting_table", "furnace", "chest"`,
        `- Sticks: "stick"`,
      ].join('\n');
    }

    // Get the recipe for this item
    const recipes = bot.recipesFor(item.id, null, 1, null);

    if (!recipes || recipes.length === 0) {
      return [
        `Cannot craft "${item_name}" - no recipe found.`,
        ``,
        `This item might be:`,
        `- Uncraftable (must be found/mined)`,
        `- Requires special conditions`,
        `- Not available in this Minecraft version`,
      ].join('\n');
    }

    // Check if we have the materials
    const recipe = recipes[0];

    // Determine if we need a crafting table (3x3 recipes)
    let requiresCraftingTable = false;
    if (recipe.inShape) {
      const shapeHeight = recipe.inShape.length;
      const shapeWidth = recipe.inShape[0]?.length || 0;
      requiresCraftingTable = shapeHeight > 2 || shapeWidth > 2;
    }

    // Get inventory counts before crafting
    const inventoryBefore = bot.inventory.items()
      .filter(item => item.name === item_name)
      .reduce((sum, item) => sum + item.count, 0);

    let craftingTableUsed = false;
    let craftingTable = null;

    // If crafting table needed, find one nearby
    if (requiresCraftingTable) {
      craftingTable = bot.findBlock({
        matching: mcData.blocksByName.crafting_table.id,
        maxDistance: 32,
      });

      if (!craftingTable) {
        return [
          `Error: Recipe for "${item_name}" requires a crafting table.`,
          `No crafting table found within 32 blocks.`,
          ``,
          `Solutions:`,
          `- Craft a crafting table first (4 planks)`,
          `- Move closer to an existing crafting table`,
          `- Place a crafting table nearby`,
        ].join('\n');
      }

      craftingTableUsed = true;
    }

    // Attempt to craft
    let totalCrafted = 0;
    const errors = [];

    for (let i = 0; i < count; i++) {
      try {
        if (craftingTableUsed && craftingTable) {
          await bot.craft(recipe, 1, craftingTable);
        } else {
          await bot.craft(recipe, 1, undefined);
        }
        totalCrafted++;
      } catch (error: any) {
        errors.push(error.message);
        break; // Stop on first error (likely missing materials)
      }
    }

    // Get inventory counts after crafting
    const inventoryAfter = bot.inventory.items()
      .filter(item => item.name === item_name)
      .reduce((sum, item) => sum + item.count, 0);

    const actualCrafted = inventoryAfter - inventoryBefore;

    if (actualCrafted === 0) {
      return [
        `Failed to craft "${item_name}".`,
        ``,
        `Reason: ${errors[0] || 'Missing required materials'}`,
        ``,
        `Check that you have all required materials in your inventory.`,
      ].join('\n');
    }

    // Build success message
    const lines = [
      `✓ Successfully crafted ${actualCrafted}x ${item_name}!`,
      ``,
    ];

    if (craftingTableUsed) {
      lines.push(`Used crafting table at (${craftingTable!.position.x}, ${craftingTable!.position.y}, ${craftingTable!.position.z})`);
    } else {
      lines.push(`Crafted using inventory crafting (2x2 grid)`);
    }

    lines.push(`Inventory: ${inventoryBefore} → ${inventoryAfter} ${item_name}`);

    if (actualCrafted < count) {
      lines.push(``);
      lines.push(`⚠ Only crafted ${actualCrafted}/${count} - ran out of materials`);
    }

    return lines.join('\n');

  } catch (error: any) {
    return [
      `Failed to craft "${item_name}": ${error.message}`,
      ``,
      `Common issues:`,
      `- Missing required materials`,
      `- Need crafting table (for 3x3 recipes)`,
      `- Invalid item name`,
    ].join('\n');
  }
}
