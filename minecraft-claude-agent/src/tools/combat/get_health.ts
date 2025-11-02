import { Bot } from 'mineflayer';

/**
 * Get the bot's current health and hunger status.
 * Provides critical information for survival decision-making.
 *
 * @param bot - The Mineflayer bot instance
 * @returns Health and hunger status information
 */
export async function get_health(bot: Bot): Promise<string> {
  try {
    // Get health (max is usually 20 in Minecraft)
    const health = bot.health;
    const maxHealth = 20;
    const healthPercentage = Math.round((health / maxHealth) * 100);

    // Get food level (max is 20)
    const food = bot.food;
    const maxFood = 20;
    const foodPercentage = Math.round((food / maxFood) * 100);

    // Get saturation (affects health regeneration)
    const saturation = bot.foodSaturation;

    // Determine health status
    let healthStatus: string;
    if (healthPercentage >= 80) {
      healthStatus = "Healthy";
    } else if (healthPercentage >= 50) {
      healthStatus = "Injured";
    } else if (healthPercentage >= 20) {
      healthStatus = "Badly Injured";
    } else {
      healthStatus = "Critical";
    }

    // Determine hunger status
    let hungerStatus: string;
    if (foodPercentage >= 80) {
      hungerStatus = "Well Fed";
    } else if (foodPercentage >= 50) {
      hungerStatus = "Satisfied";
    } else if (foodPercentage >= 20) {
      hungerStatus = "Hungry";
    } else {
      hungerStatus = "Starving";
    }

    // Build status report
    const report = [
      `Health: ${health.toFixed(1)}/${maxHealth} HP (${healthPercentage}%) - ${healthStatus}`,
      `Hunger: ${food}/${maxFood} (${foodPercentage}%) - ${hungerStatus}`,
      `Saturation: ${saturation.toFixed(1)}`,
      ``,
      `Status Assessment:`,
    ];

    // Add recommendations based on status
    if (healthPercentage < 50) {
      report.push(`⚠️ Health low! Seek safety and eat food to regenerate.`);
    }

    if (foodPercentage < 30) {
      report.push(`⚠️ Hunger low! Eat food soon to prevent health loss.`);
    }

    if (healthPercentage < 20) {
      report.push(`🚨 CRITICAL HEALTH! Flee to safety immediately!`);
    }

    if (foodPercentage <= 0) {
      report.push(`🚨 STARVING! Health will decrease. Eat food NOW!`);
    }

    if (healthPercentage >= 80 && foodPercentage >= 80) {
      report.push(`✅ Excellent condition. Ready for combat or exploration.`);
    }

    return report.join('\n');

  } catch (error: any) {
    return `Failed to get health status: ${error.message}`;
  }
}
