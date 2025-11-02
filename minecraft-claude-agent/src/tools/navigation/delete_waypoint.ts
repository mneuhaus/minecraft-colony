import { Bot } from 'mineflayer';
import { deleteWaypoint as removeWaypoint, getWaypoint } from './waypoint_storage.js';

export interface DeleteWaypointParams {
  name: string;
}

/**
 * Delete a saved waypoint by name.
 *
 * @param bot - The Mineflayer bot instance
 * @param params - Name of waypoint to delete
 * @returns Result of deletion attempt
 */
export async function delete_waypoint(
  _bot: Bot,
  params: DeleteWaypointParams
): Promise<string> {
  const { name } = params;

  try {
    if (!name || name.trim().length === 0) {
      return `Error: Waypoint name cannot be empty.`;
    }

    // Check if waypoint exists
    const waypoint = getWaypoint(name);

    if (!waypoint) {
      return [
        `Waypoint "${name}" not found.`,
        ``,
        `Use list_waypoints() to see all available waypoints.`,
      ].join('\n');
    }

    // Delete the waypoint
    const deleted = removeWaypoint(name);

    if (deleted) {
      return [
        `✓ Waypoint "${name}" deleted successfully!`,
        `Location was: (${waypoint.x}, ${waypoint.y}, ${waypoint.z})`,
        waypoint.dimension ? `Dimension: ${waypoint.dimension}` : '',
        ``,
        `Use list_waypoints() to see remaining waypoints.`,
      ].filter(Boolean).join('\n');
    } else {
      return `Failed to delete waypoint "${name}".`;
    }

  } catch (error: any) {
    return `Failed to delete waypoint "${name}": ${error.message}`;
  }
}
