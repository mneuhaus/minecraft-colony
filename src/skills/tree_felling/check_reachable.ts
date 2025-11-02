import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

/**
 * Check if bot can reach a block position
 * Provides actionable data for LLM decision-making
 */
export async function checkReachable(bot: Bot, x: number, y: number, z: number): Promise<string> {
  const targetPos = new Vec3(x, y, z);
  const botPos = bot.entity.position;

  const horizontalDist = Math.sqrt(
    Math.pow(targetPos.x - botPos.x, 2) +
    Math.pow(targetPos.z - botPos.z, 2)
  );
  const verticalDist = targetPos.y - botPos.y;
  const totalDist = botPos.distanceTo(targetPos);

  // Bot can reach blocks within ~4.5 blocks
  const maxReach = 4.5;
  const canReach = totalDist <= maxReach;

  // Need scaffolding if too high vertically
  const needsScaffold = verticalDist > maxReach;

  // Recommended position: get within 3 blocks horizontally at same Y level
  const recommendedPos = new Vec3(
    Math.floor(targetPos.x),
    Math.floor(botPos.y),
    Math.floor(targetPos.z)
  );

  const result: string[] = [
    `Block at (${x}, ${y}, ${z}):`,
    `- Can reach: ${canReach ? 'YES' : 'NO'}`,
    `- Distance: ${totalDist.toFixed(1)} blocks total (${horizontalDist.toFixed(1)} horizontal, ${verticalDist > 0 ? '+' : ''}${verticalDist.toFixed(1)} vertical)`,
    `- Needs scaffolding: ${needsScaffold ? 'YES' : 'NO'}`,
  ];

  if (!canReach) {
    if (needsScaffold) {
      const scaffoldHeight = Math.ceil(verticalDist - 3); // Build to within 3 blocks
      result.push(`- Recommendation: Build pillar ${scaffoldHeight} blocks high to reach`);
    } else {
      result.push(`- Recommendation: Move closer to (${recommendedPos.x}, ${recommendedPos.y}, ${recommendedPos.z})`);
    }
  }

  return result.join('\n');
}
