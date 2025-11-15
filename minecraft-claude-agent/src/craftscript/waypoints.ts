import fs from 'fs/promises';
import path from 'path';

export interface SavedWaypoint {
  name: string;
  x: number;
  y: number;
  z: number;
  description?: string;
}

const getWaypointFile = (botName: string) =>
  path.join(process.cwd(), 'logs', `${botName}_waypoints.json`);

async function loadWaypoints(botName: string): Promise<SavedWaypoint[]> {
  try {
    const file = getWaypointFile(botName);
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function get_waypoint(
  botName: string,
  name: string
): Promise<{ x: number; y: number; z: number; description?: string } | null> {
  const waypoints = await loadWaypoints(botName);
  const waypoint = waypoints.find((wp) => wp.name === name);

  if (!waypoint) return null;
  return {
    x: waypoint.x,
    y: waypoint.y,
    z: waypoint.z,
    description: waypoint.description,
  };
}
