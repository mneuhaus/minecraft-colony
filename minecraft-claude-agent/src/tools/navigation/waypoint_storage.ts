import fs from 'fs';
import path from 'path';

export interface Waypoint {
  name: string;
  x: number;
  y: number;
  z: number;
  dimension?: string;
  description?: string;
  created_at: string;
  created_by?: string;
}

const WAYPOINTS_DIR = path.join(process.cwd(), 'waypoints');
const WAYPOINTS_FILE = path.join(WAYPOINTS_DIR, 'waypoints.json');

// Ensure waypoints directory exists
function ensureWaypointsDir(): void {
  if (!fs.existsSync(WAYPOINTS_DIR)) {
    fs.mkdirSync(WAYPOINTS_DIR, { recursive: true });
  }
}

// Load all waypoints from file
export function loadWaypoints(): Waypoint[] {
  ensureWaypointsDir();

  if (!fs.existsSync(WAYPOINTS_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(WAYPOINTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading waypoints:', error);
    return [];
  }
}

// Save waypoints to file
export function saveWaypoints(waypoints: Waypoint[]): void {
  ensureWaypointsDir();

  try {
    fs.writeFileSync(WAYPOINTS_FILE, JSON.stringify(waypoints, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving waypoints:', error);
    throw error;
  }
}

// Add a new waypoint
export function addWaypoint(waypoint: Waypoint): void {
  const waypoints = loadWaypoints();

  // Check if waypoint with same name already exists
  const existingIndex = waypoints.findIndex(w => w.name === waypoint.name);

  if (existingIndex >= 0) {
    // Update existing waypoint
    waypoints[existingIndex] = waypoint;
  } else {
    // Add new waypoint
    waypoints.push(waypoint);
  }

  saveWaypoints(waypoints);
}

// Get waypoint by name
export function getWaypoint(name: string): Waypoint | undefined {
  const waypoints = loadWaypoints();
  return waypoints.find(w => w.name === name);
}

// Delete waypoint by name
export function deleteWaypoint(name: string): boolean {
  const waypoints = loadWaypoints();
  const filtered = waypoints.filter(w => w.name !== name);

  if (filtered.length < waypoints.length) {
    saveWaypoints(filtered);
    return true;
  }

  return false;
}

// Calculate distance between two points
export function calculateDistance(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number
): number {
  return Math.sqrt(
    Math.pow(x2 - x1, 2) +
    Math.pow(y2 - y1, 2) +
    Math.pow(z2 - z1, 2)
  );
}
