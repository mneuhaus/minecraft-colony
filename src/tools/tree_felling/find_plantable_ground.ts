import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

interface PlantableSpot {
  position: Vec3;
  blockType: string;
  lightLevel: number;
  spaceAbove: number;
  distance: number;
}

/**
 * Find suitable ground for planting saplings
 * Returns sorted list of plantable locations
 */
export async function findPlantableGround(bot: Bot, nearX: number, nearY: number, nearZ: number, radius: number = 10): Promise<string> {
  const nearPos = new Vec3(nearX, nearY, nearZ);
  const plantableSpots: PlantableSpot[] = [];

  // Find dirt and grass blocks
  const groundBlocks = bot.findBlocks({
    point: nearPos,
    matching: (block) => block.name === 'dirt' || block.name === 'grass_block' || block.name === 'podzol',
    maxDistance: radius,
    count: 50,
  });

  for (const blockPos of groundBlocks) {
    const block = bot.blockAt(blockPos);
    if (!block) continue;

    // Check if block above is air (can plant here)
    const above = bot.blockAt(blockPos.offset(0, 1, 0));
    if (!above || above.name !== 'air') continue;

    // Count space above (trees need 6-30 blocks depending on type)
    let spaceAbove = 0;
    for (let y = 1; y <= 30; y++) {
      const checkBlock = bot.blockAt(blockPos.offset(0, y, 0));
      if (!checkBlock || checkBlock.name === 'air') {
        spaceAbove++;
      } else {
        break;
      }
    }

    // Get light level (saplings need light > 8)
    const lightLevel = bot.world.getBlockLight(blockPos.offset(0, 1, 0)) || 0;

    const distance = Math.floor(nearPos.distanceTo(blockPos));

    plantableSpots.push({
      position: blockPos,
      blockType: block.name,
      lightLevel,
      spaceAbove,
      distance,
    });
  }

  // Sort by distance
  plantableSpots.sort((a, b) => a.distance - b.distance);

  if (plantableSpots.length === 0) {
    return `No plantable ground found within ${radius} blocks of (${nearX}, ${nearY}, ${nearZ})`;
  }

  // Format output
  const spotList = plantableSpots.slice(0, 5).map((spot, i) => {
    const suitability = spot.lightLevel >= 9 && spot.spaceAbove >= 6 ? 'GOOD' : spot.lightLevel < 9 ? 'TOO DARK' : 'LOW CEILING';
    return `${i + 1}. ${spot.blockType} at (${Math.floor(spot.position.x)}, ${Math.floor(spot.position.y)}, ${Math.floor(spot.position.z)}), light ${spot.lightLevel}, ${spot.spaceAbove} blocks air above, ${spot.distance} blocks away [${suitability}]`;
  }).join('\n');

  return `Found ${plantableSpots.length} plantable spots. Nearest:\n${spotList}${plantableSpots.length > 5 ? `\n...and ${plantableSpots.length - 5} more` : ''}`;
}
