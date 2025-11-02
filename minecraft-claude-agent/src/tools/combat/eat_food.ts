import { Bot } from 'mineflayer';

export interface EatFoodParams {
  food_item?: string; // Optional - if not specified, eats any food
}

/**
 * Eat food to restore health and hunger.
 * Bot will search inventory for specified food or any available food.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Optional food item name to eat
 * @returns Result of eating attempt
 */
export async function eat_food(
  bot: Bot,
  params: EatFoodParams = {}
): Promise<string> {
  const { food_item } = params;

  try {
    // Common food items in Minecraft
    const foodItems = [
      'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'cooked_rabbit',
      'bread', 'baked_potato', 'cooked_cod', 'cooked_salmon',
      'apple', 'golden_apple', 'carrot', 'potato', 'beetroot',
      'melon_slice', 'sweet_berries', 'cookie', 'pumpkin_pie',
      'beef', 'porkchop', 'chicken', 'mutton', 'rabbit', // Raw foods (less effective)
    ];

    let foodToEat: string | null = null;

    if (food_item) {
      // User specified a specific food item
      const item = bot.inventory.items().find(
        item => item.name === food_item || item.name.includes(food_item)
      );

      if (item) {
        foodToEat = item.name;
      } else {
        return `Cannot eat ${food_item}: Not found in inventory. Available food: ${
          bot.inventory.items()
            .filter(item => foodItems.includes(item.name))
            .map(item => item.name)
            .join(', ') || 'None'
        }`;
      }
    } else {
      // Find any food in inventory
      for (const foodName of foodItems) {
        const item = bot.inventory.items().find(item => item.name === foodName);
        if (item) {
          foodToEat = item.name;
          break;
        }
      }

      if (!foodToEat) {
        return `No food available in inventory. Cannot eat.`;
      }
    }

    // Get current stats before eating
    const healthBefore = bot.health;
    const foodBefore = bot.food;

    // Equip the food item
    const itemToEat = bot.inventory.items().find(item => item.name === foodToEat);
    if (!itemToEat) {
      return `Failed to find ${foodToEat} in inventory.`;
    }

    await bot.equip(itemToEat, 'hand');

    // Start eating (consume method)
    await bot.consume();

    // Get stats after eating
    const healthAfter = bot.health;
    const foodAfter = bot.food;

    const healthGained = healthAfter - healthBefore;
    const hungerRestored = foodAfter - foodBefore;

    return [
      `Successfully ate ${foodToEat}`,
      `Health: ${healthBefore.toFixed(1)} → ${healthAfter.toFixed(1)} HP (${healthGained > 0 ? '+' + healthGained.toFixed(1) : 'no change'})`,
      `Hunger: ${foodBefore} → ${foodAfter} (${hungerRestored > 0 ? '+' + hungerRestored : 'no change'})`,
      `Current Status: ${Math.round((healthAfter / 20) * 100)}% health, ${Math.round((foodAfter / 20) * 100)}% hunger`
    ].join('\n');

  } catch (error: any) {
    // Common error: Already eating or cannot eat this item
    if (error.message.includes('not food') || error.message.includes('cannot consume')) {
      return `Cannot eat ${food_item || 'item'}: Not a food item.`;
    }

    if (error.message.includes('food bar is full')) {
      return `Cannot eat: Hunger bar is already full (${bot.food}/20).`;
    }

    return `Failed to eat food: ${error.message}`;
  }
}
