import fs from 'fs/promises';
import path from 'path';
import { Vec3 } from 'vec3';
import { Bot } from 'mineflayer';

/**
 * Waypoint data structure
 */
export interface Waypoint {
  name: string;
  x: number;
  y: number;
  z: number;
  description?: string;
  created: string; // ISO timestamp
  dimension: string; // 'overworld', 'nether', 'end'
}

/**
 * Waypoint storage file path
 */
const getWaypointsFilePath = (botName: string): string => {
  return path.join(process.cwd(), 'logs', `${botName}_waypoints.json`);
};

/**
 * Load waypoints from file
 */
async function loadWaypoints(botName: string): Promise<Waypoint[]> {
  try {
    const filePath = getWaypointsFilePath(botName);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet or is invalid - return empty array
    return [];
  }
}

/**
 * Save waypoints to file
 */
async function saveWaypoints(botName: string, waypoints: Waypoint[]): Promise<void> {
  const filePath = getWaypointsFilePath(botName);
  await fs.writeFile(filePath, JSON.stringify(waypoints, null, 2), 'utf-8');
}

/**
 * Get bot's current dimension
 */
function getCurrentDimension(bot: Bot): string {
  // Mineflayer provides dimension info via bot.game.dimension
  // 'minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end'
  const dimension = bot.game?.dimension;

  if (!dimension) return 'overworld';

  if (dimension.includes('nether')) return 'nether';
  if (dimension.includes('end')) return 'end';
  return 'overworld';
}

/**
 * Set a waypoint at specific coordinates
 */
export async function set_waypoint(
  bot: Bot,
  botName: string,
  name: string,
  x: number,
  y: number,
  z: number,
  description?: string
): Promise<string> {
  const waypoints = await loadWaypoints(botName);

  // Check if waypoint with this name already exists
  const existingIndex = waypoints.findIndex((wp) => wp.name === name);

  const waypoint: Waypoint = {
    name,
    x: Math.floor(x),
    y: Math.floor(y),
    z: Math.floor(z),
    description: description || '',
    created: new Date().toISOString(),
    dimension: getCurrentDimension(bot),
  };

  if (existingIndex >= 0) {
    // Update existing waypoint
    waypoints[existingIndex] = waypoint;
    await saveWaypoints(botName, waypoints);
    return `Updated waypoint "${name}" at (${waypoint.x}, ${waypoint.y}, ${waypoint.z}) in ${waypoint.dimension}${description ? `: ${description}` : ''}`;
  } else {
    // Add new waypoint
    waypoints.push(waypoint);
    await saveWaypoints(botName, waypoints);
    return `Created waypoint "${name}" at (${waypoint.x}, ${waypoint.y}, ${waypoint.z}) in ${waypoint.dimension}${description ? `: ${description}` : ''}`;
  }
}

/**
 * List all waypoints with distances from current position
 */
export async function list_waypoints(
  bot: Bot,
  botName: string
): Promise<string> {
  const waypoints = await loadWaypoints(botName);

  if (waypoints.length === 0) {
    return 'No waypoints saved yet. Use set_waypoint to create one.';
  }

  const currentPos = bot.entity.position;
  const currentDimension = getCurrentDimension(bot);

  // Group waypoints by dimension
  const currentDimensionWaypoints = waypoints.filter((wp) => wp.dimension === currentDimension);
  const otherDimensionWaypoints = waypoints.filter((wp) => wp.dimension !== currentDimension);

  const lines: string[] = [];
  lines.push(`Waypoints (${waypoints.length} total):`);
  lines.push('');

  // Current dimension waypoints (with distances)
  if (currentDimensionWaypoints.length > 0) {
    lines.push(`In ${currentDimension}:`);
    const sorted = currentDimensionWaypoints
      .map((wp) => {
        const distance = Math.floor(
          currentPos.distanceTo(new Vec3(wp.x, wp.y, wp.z))
        );
        return { ...wp, distance };
      })
      .sort((a, b) => a.distance - b.distance);

    for (const wp of sorted) {
      const desc = wp.description ? ` - ${wp.description}` : '';
      lines.push(`  "${wp.name}": (${wp.x}, ${wp.y}, ${wp.z}) - ${wp.distance} blocks${desc}`);
    }
    lines.push('');
  }

  // Other dimension waypoints (no distances)
  if (otherDimensionWaypoints.length > 0) {
    lines.push('In other dimensions:');
    for (const wp of otherDimensionWaypoints) {
      const desc = wp.description ? ` - ${wp.description}` : '';
      lines.push(`  "${wp.name}": (${wp.x}, ${wp.y}, ${wp.z}) in ${wp.dimension}${desc}`);
    }
  }

  return lines.join('\n');
}

/**
 * Delete a waypoint by name
 */
export async function delete_waypoint(
  botName: string,
  name: string
): Promise<string> {
  const waypoints = await loadWaypoints(botName);
  const initialLength = waypoints.length;

  const filtered = waypoints.filter((wp) => wp.name !== name);

  if (filtered.length === initialLength) {
    return `Waypoint "${name}" not found. Use list_waypoints to see all waypoints.`;
  }

  await saveWaypoints(botName, filtered);
  return `Deleted waypoint "${name}"`;
}

/**
 * Get waypoint coordinates by name
 */
export async function get_waypoint(
  botName: string,
  name: string
): Promise<{ x: number; y: number; z: number; description?: string } | null> {
  const waypoints = await loadWaypoints(botName);
  const waypoint = waypoints.find((wp) => wp.name === name);

  if (!waypoint) {
    return null;
  }

  return {
    x: waypoint.x,
    y: waypoint.y,
    z: waypoint.z,
    description: waypoint.description,
  };
}

/**
 * Find nearest waypoint to current position
 */
export async function find_nearest_waypoint(
  bot: Bot,
  botName: string
): Promise<string> {
  const waypoints = await loadWaypoints(botName);
  const currentDimension = getCurrentDimension(bot);
  const currentDimensionWaypoints = waypoints.filter((wp) => wp.dimension === currentDimension);

  if (currentDimensionWaypoints.length === 0) {
    return `No waypoints in ${currentDimension}. Use set_waypoint to create one.`;
  }

  const currentPos = bot.entity.position;
  let nearest = currentDimensionWaypoints[0];
  let minDistance = currentPos.distanceTo(new Vec3(nearest.x, nearest.y, nearest.z));

  for (const wp of currentDimensionWaypoints.slice(1)) {
    const distance = currentPos.distanceTo(new Vec3(wp.x, wp.y, wp.z));
    if (distance < minDistance) {
      minDistance = distance;
      nearest = wp;
    }
  }

  const desc = nearest.description ? ` - ${nearest.description}` : '';
  return `Nearest waypoint: "${nearest.name}" at (${nearest.x}, ${nearest.y}, ${nearest.z}) - ${Math.floor(minDistance)} blocks away${desc}`;
}
