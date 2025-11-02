import { Bot } from 'mineflayer';
import { loadWaypoints, calculateDistance } from './waypoint_storage.js';

export interface ListWaypointsParams {
  sort_by_distance?: boolean;
}

/**
 * List all saved waypoints with their coordinates and distances.
 * Optionally sort by distance from bot's current position.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Options for listing waypoints
 * @returns Formatted list of all waypoints
 */
export async function list_waypoints(
  bot: Bot,
  params: ListWaypointsParams = {}
): Promise<string> {
  const { sort_by_distance = false } = params;

  try {
    const waypoints = loadWaypoints();

    if (waypoints.length === 0) {
      return [
        `No waypoints saved yet.`,
        ``,
        `Create a waypoint:`,
        `- set_waypoint(name="Home") to save current position`,
        `- set_waypoint(name="Mine", x=100, y=64, z=200) to save specific coordinates`,
      ].join('\n');
    }

    // Get bot's current position
    const botX = bot.entity.position.x;
    const botY = bot.entity.position.y;
    const botZ = bot.entity.position.z;

    // Calculate distances and prepare waypoint data
    const waypointsWithDistance = waypoints.map(wp => ({
      ...wp,
      distance: calculateDistance(botX, botY, botZ, wp.x, wp.y, wp.z),
    }));

    // Sort if requested
    let sortedWaypoints = waypointsWithDistance;
    if (sort_by_distance) {
      sortedWaypoints = [...waypointsWithDistance].sort((a, b) => a.distance - b.distance);
    }

    // Format output
    const lines = [
      `=== Saved Waypoints (${waypoints.length} total) ===`,
      `Current position: (${Math.floor(botX)}, ${Math.floor(botY)}, ${Math.floor(botZ)})`,
      ``,
    ];

    for (const wp of sortedWaypoints) {
      lines.push(`📍 ${wp.name}`);
      lines.push(`   Location: (${wp.x}, ${wp.y}, ${wp.z})`);
      lines.push(`   Distance: ${wp.distance.toFixed(1)} blocks`);
      if (wp.dimension) {
        lines.push(`   Dimension: ${wp.dimension}`);
      }
      if (wp.description) {
        lines.push(`   Description: ${wp.description}`);
      }
      if (wp.created_by) {
        lines.push(`   Created by: ${wp.created_by}`);
      }
      lines.push(``); // Empty line between waypoints
    }

    lines.push(`Navigation:`);
    lines.push(`- move_to_position(x, y, z) to navigate to a waypoint`);
    lines.push(`- list_waypoints(sort_by_distance=true) to sort by proximity`);

    return lines.join('\n');

  } catch (error: any) {
    return `Failed to list waypoints: ${error.message}`;
  }
}
