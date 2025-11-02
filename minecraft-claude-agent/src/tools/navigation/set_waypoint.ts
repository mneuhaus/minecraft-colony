import { Bot } from 'mineflayer';
import { addWaypoint, Waypoint } from './waypoint_storage.js';

export interface SetWaypointParams {
  name: string;
  x?: number;
  y?: number;
  z?: number;
  description?: string;
}

/**
 * Save a waypoint (named location) for later navigation.
 * If coordinates are not provided, uses bot's current position.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Waypoint name, optional coordinates, and description
 * @returns Result of waypoint creation
 */
export async function set_waypoint(
  bot: Bot,
  params: SetWaypointParams
): Promise<string> {
  const { name, x, y, z, description } = params;

  try {
    // Validate waypoint name
    if (!name || name.trim().length === 0) {
      return `Error: Waypoint name cannot be empty.`;
    }

    // Use provided coordinates or bot's current position
    const waypointX = x !== undefined ? x : bot.entity.position.x;
    const waypointY = y !== undefined ? y : bot.entity.position.y;
    const waypointZ = z !== undefined ? z : bot.entity.position.z;

    // Determine dimension (overworld, nether, end)
    const dimension = getDimensionName(waypointY);

    // Create waypoint object
    const waypoint: Waypoint = {
      name: name.trim(),
      x: Math.floor(waypointX),
      y: Math.floor(waypointY),
      z: Math.floor(waypointZ),
      dimension,
      description: description?.trim(),
      created_at: new Date().toISOString(),
      created_by: bot.username,
    };

    // Save waypoint
    addWaypoint(waypoint);

    const coordsSource = (x !== undefined && y !== undefined && z !== undefined)
      ? 'specified coordinates'
      : 'current position';

    return [
      `✓ Waypoint "${name}" saved successfully!`,
      `Location: (${waypoint.x}, ${waypoint.y}, ${waypoint.z})`,
      `Dimension: ${waypoint.dimension}`,
      `Source: ${coordsSource}`,
      description ? `Description: ${description}` : '',
      `Created by: ${bot.username}`,
      ``,
      `Use this waypoint:`,
      `- list_waypoints() to see all waypoints`,
      `- move_to_position(${waypoint.x}, ${waypoint.y}, ${waypoint.z}) to navigate here`,
    ].filter(Boolean).join('\n');

  } catch (error: any) {
    return `Failed to save waypoint "${name}": ${error.message}`;
  }
}

// Helper function to determine dimension based on Y coordinate
function getDimensionName(y: number): string {
  if (y < 0 && y >= -64) {
    return 'overworld (underground)';
  } else if (y >= 0 && y <= 320) {
    return 'overworld';
  } else if (y >= 0 && y <= 256) {
    // Nether is typically 0-128, but can vary
    return 'nether';
  } else {
    return 'end';
  }
}
