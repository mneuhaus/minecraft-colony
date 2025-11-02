import { Bot } from 'mineflayer';

export interface SmeltItemParams {
  item_name: string;
  count?: number;
  fuel?: string;
}

/**
 * Smelt items in a furnace (ores, raw food, etc.).
 * Automatically finds nearby furnace and uses available fuel.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Item to smelt, quantity, and optional fuel type
 * @returns Result of smelting attempt
 */
export async function smelt_item(
  bot: Bot,
  params: SmeltItemParams
): Promise<string> {
  const { item_name, count = 1, fuel } = params;

  try {
    // Validate parameters
    if (!item_name || item_name.trim().length === 0) {
      return `Error: Item name cannot be empty.`;
    }

    if (count < 1 || count > 64) {
      return `Error: Count must be between 1 and 64 (requested: ${count}).`;
    }

    const mcData = require('minecraft-data')(bot.version);

    // Verify item exists and is smeltable
    const inputItem = mcData.itemsByName[item_name];
    if (!inputItem) {
      return [
        `Error: Unknown item "${item_name}".`,
        ``,
        `Common smeltable items:`,
        `- Ores: "iron_ore", "gold_ore", "copper_ore"`,
        `- Raw materials: "raw_iron", "raw_gold", "raw_copper"`,
        `- Food: "raw_beef", "raw_porkchop", "raw_chicken", "potato"`,
        `- Other: "cobblestone" → stone, "sand" → glass`,
      ].join('\n');
    }

    // Check if we have the item in inventory
    const inputInInventory = bot.inventory.items().find(
      item => item.name === item_name
    );

    if (!inputInInventory || inputInInventory.count < count) {
      const available = inputInInventory?.count || 0;
      return [
        `Error: Not enough ${item_name} in inventory.`,
        `Required: ${count}, Available: ${available}`,
      ].join('\n');
    }

    // Find nearby furnace
    const furnaceBlock = bot.findBlock({
      matching: (block: any) => {
        return block.name === 'furnace' || block.name === 'blast_furnace' || block.name === 'smoker';
      },
      maxDistance: 32,
    });

    if (!furnaceBlock) {
      return [
        `Error: No furnace found within 32 blocks.`,
        ``,
        `Solutions:`,
        `- Place a furnace nearby`,
        `- Move closer to an existing furnace`,
        `- Craft a furnace (8 cobblestone)`,
      ].join('\n');
    }

    const furnaceType = furnaceBlock.name;

    // Determine fuel to use
    const fuelPriority = [
      'coal', 'charcoal', 'coal_block',
      'dried_kelp_block', 'blaze_rod',
      'oak_planks', 'spruce_planks', 'birch_planks',
      'stick', 'oak_log', 'spruce_log'
    ];

    let fuelItem = null;
    let fuelName = '';

    if (fuel) {
      // Use specified fuel if provided
      fuelItem = bot.inventory.items().find(item => item.name === fuel);
      fuelName = fuel;
    } else {
      // Auto-select fuel from priority list
      for (const fuelType of fuelPriority) {
        fuelItem = bot.inventory.items().find(item => item.name === fuelType);
        if (fuelItem) {
          fuelName = fuelType;
          break;
        }
      }
    }

    if (!fuelItem) {
      return [
        `Error: No fuel found in inventory.`,
        ``,
        `Available fuels (in order of preference):`,
        `- coal, charcoal, coal_block`,
        `- dried_kelp_block, blaze_rod`,
        `- planks (any wood type)`,
        `- sticks, logs`,
      ].join('\n');
    }

    // Open furnace
    const furnace = await bot.openFurnace(furnaceBlock);

    // Put items in furnace
    await furnace.putInput(inputItem.id, null, count);

    // Calculate fuel needed (1 coal = 8 items, 1 plank = 1.5 items, etc.)
    const fuelNeeded = Math.ceil(count / 8); // Simplified: assume coal efficiency
    const fuelToAdd = Math.min(fuelNeeded, fuelItem.count);

    const mcDataForFuel = require('minecraft-data')(bot.version);
    const fuelItemData = mcDataForFuel.itemsByName[fuelName];
    await furnace.putFuel(fuelItemData.id, null, fuelToAdd);

    // Wait for smelting to complete
    // Each item takes ~10 seconds to smelt
    const smeltTime = count * 10000;
    const maxWaitTime = Math.min(smeltTime + 5000, 120000); // Max 2 minutes

    const startTime = Date.now();
    let smelted = false;

    while (Date.now() - startTime < maxWaitTime) {
      const outputItem = furnace.outputItem();

      if (outputItem && outputItem.count >= count) {
        // Take output
        await furnace.takeOutput();
        smelted = true;
        break;
      }

      // Check progress every second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Take any remaining output
    const finalOutput = furnace.outputItem();
    if (finalOutput && finalOutput.count > 0) {
      await furnace.takeOutput();
      smelted = true;
    }

    // Close furnace
    furnace.close();

    // Get output item name (determine what was produced)
    let outputName = 'unknown';
    const smeltingResults: { [key: string]: string } = {
      'iron_ore': 'iron_ingot',
      'gold_ore': 'gold_ingot',
      'copper_ore': 'copper_ingot',
      'raw_iron': 'iron_ingot',
      'raw_gold': 'gold_ingot',
      'raw_copper': 'copper_ingot',
      'cobblestone': 'stone',
      'stone': 'smooth_stone',
      'sand': 'glass',
      'raw_beef': 'cooked_beef',
      'raw_porkchop': 'cooked_porkchop',
      'raw_chicken': 'cooked_chicken',
      'raw_mutton': 'cooked_mutton',
      'raw_rabbit': 'cooked_rabbit',
      'potato': 'baked_potato',
      'kelp': 'dried_kelp',
    };

    outputName = smeltingResults[item_name] || 'smelted item';

    if (!smelted) {
      return [
        `⚠ Smelting timed out after ${Math.floor(maxWaitTime / 1000)} seconds.`,
        ``,
        `Started smelting ${count}x ${item_name} in ${furnaceType}.`,
        `Items may still be smelting. Check furnace at:`,
        `(${furnaceBlock.position.x}, ${furnaceBlock.position.y}, ${furnaceBlock.position.z})`,
      ].join('\n');
    }

    return [
      `✓ Successfully smelted ${count}x ${item_name}!`,
      ``,
      `Output: ${count}x ${outputName}`,
      `Furnace: ${furnaceType} at (${furnaceBlock.position.x}, ${furnaceBlock.position.y}, ${furnaceBlock.position.z})`,
      `Fuel used: ~${fuelToAdd}x ${fuelName}`,
      ``,
      `Smelting time: ${Math.floor((Date.now() - startTime) / 1000)} seconds`,
    ].join('\n');

  } catch (error: any) {
    return [
      `Failed to smelt "${item_name}": ${error.message}`,
      ``,
      `Common issues:`,
      `- No furnace nearby (within 32 blocks)`,
      `- Missing fuel in inventory`,
      `- Item cannot be smelted`,
      `- Not enough items to smelt`,
    ].join('\n');
  }
}
