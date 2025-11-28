/**
 * SimplePathfinder - A custom A* pathfinder with proper scaffolding support
 *
 * Built from scratch to handle block types that mineflayer-pathfinder struggles with,
 * particularly scaffolding which is both climbable AND standable.
 */

import { Vec3 } from 'vec3';
import type { Bot } from 'mineflayer';

// Priority Queue implementation for A*
class PriorityQueue<T> {
  private items: { item: T; priority: number }[] = [];

  enqueue(item: T, priority: number): void {
    this.items.push({ item, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  dequeue(): T | undefined {
    return this.items.shift()?.item;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

// Node in the pathfinding graph
interface PathNode {
  pos: Vec3;
  g: number;      // Cost from start
  h: number;      // Heuristic (estimated cost to goal)
  f: number;      // Total cost (g + h)
  parent: PathNode | null;
  moveType: MoveType;
}

type MoveType = 'start' | 'walk' | 'jump_up' | 'drop' | 'climb_up' | 'climb_down';

// Block classification
type BlockClass = 'solid' | 'passable' | 'climbable' | 'liquid' | 'danger';

// Movement costs
const COSTS = {
  walk: 1,
  jump_up: 2,
  drop_per_block: 0.5,
  drop_base: 1,
  climb: 1.2,
  swim: 2,
};

// Dangerous blocks to avoid
const DANGER_BLOCKS = new Set([
  'lava', 'flowing_lava',
  'fire', 'soul_fire',
  'cactus',
  'magma_block',
  'campfire', 'soul_campfire',
  'sweet_berry_bush',
  'wither_rose',
]);

// Climbable blocks
const CLIMBABLE_BLOCKS = new Set([
  'ladder',
  'vine', 'cave_vines', 'cave_vines_plant', 'weeping_vines', 'weeping_vines_plant', 'twisting_vines', 'twisting_vines_plant',
  'scaffolding',
]);

// Liquid blocks
const LIQUID_BLOCKS = new Set([
  'water', 'flowing_water',
]);

export class SimplePathfinder {
  private bot: Bot;
  private maxIterations = 10000;
  private maxDropHeight = 3;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Classify a block by its properties
   */
  private classifyBlock(pos: Vec3): BlockClass {
    const block = this.bot.blockAt(pos);
    if (!block) return 'passable'; // Unloaded chunks treated as passable

    const name = block.name;

    // Check danger first
    if (DANGER_BLOCKS.has(name)) return 'danger';

    // Check climbable
    if (CLIMBABLE_BLOCKS.has(name)) return 'climbable';

    // Check liquid
    if (LIQUID_BLOCKS.has(name)) return 'liquid';

    // Check if solid (has collision box)
    if (block.boundingBox === 'block') return 'solid';

    // Everything else is passable (air, flowers, grass, etc.)
    return 'passable';
  }

  /**
   * Check if a position can be stood on
   */
  private canStandOn(pos: Vec3): boolean {
    const blockBelow = this.classifyBlock(pos.offset(0, -1, 0));
    const blockAt = this.classifyBlock(pos);
    const blockAbove = this.classifyBlock(pos.offset(0, 1, 0));

    // Can't stand in danger
    if (blockAt === 'danger' || blockBelow === 'danger') return false;

    // Need 2 blocks of head room (passable or climbable)
    if (blockAt !== 'passable' && blockAt !== 'climbable') return false;
    if (blockAbove !== 'passable' && blockAbove !== 'climbable') return false;

    // Can stand on solid blocks
    if (blockBelow === 'solid') return true;

    // Can stand IN climbable blocks (scaffolding, ladders)
    if (blockAt === 'climbable') return true;
    if (blockBelow === 'climbable') return true;

    return false;
  }

  /**
   * Check if we can move through a position (head clearance)
   */
  private canPassThrough(pos: Vec3): boolean {
    const blockAt = this.classifyBlock(pos);
    const blockAbove = this.classifyBlock(pos.offset(0, 1, 0));

    if (blockAt === 'danger' || blockAbove === 'danger') return false;
    if (blockAt === 'solid' || blockAbove === 'solid') return false;

    return true;
  }

  /**
   * Generate valid neighbors for a position
   */
  private getNeighbors(node: PathNode): PathNode[] {
    const neighbors: PathNode[] = [];
    const pos = node.pos;

    // Cardinal directions
    const directions = [
      new Vec3(1, 0, 0),
      new Vec3(-1, 0, 0),
      new Vec3(0, 0, 1),
      new Vec3(0, 0, -1),
    ];

    for (const dir of directions) {
      const newPos = pos.plus(dir);

      // Simple walk (same level)
      if (this.canStandOn(newPos) && this.canPassThrough(newPos)) {
        neighbors.push(this.createNode(newPos, node, 'walk', COSTS.walk));
      }

      // Jump up (1 block higher)
      const upPos = newPos.offset(0, 1, 0);
      if (this.canStandOn(upPos) && this.canPassThrough(upPos)) {
        // Need 3 blocks clearance at start position for jump
        const jumpClearance = this.classifyBlock(pos.offset(0, 2, 0));
        if (jumpClearance === 'passable' || jumpClearance === 'climbable') {
          neighbors.push(this.createNode(upPos, node, 'jump_up', COSTS.jump_up));
        }
      }

      // Drop down (up to maxDropHeight)
      for (let dropHeight = 1; dropHeight <= this.maxDropHeight; dropHeight++) {
        const dropPos = newPos.offset(0, -dropHeight, 0);
        if (this.canStandOn(dropPos)) {
          // Check that we can pass through all blocks on the way down
          let canDrop = true;
          for (let h = 0; h < dropHeight; h++) {
            if (!this.canPassThrough(newPos.offset(0, -h, 0))) {
              canDrop = false;
              break;
            }
          }
          if (canDrop) {
            const cost = COSTS.drop_base + COSTS.drop_per_block * dropHeight;
            neighbors.push(this.createNode(dropPos, node, 'drop', cost));
            break; // Don't check further drops once we find ground
          }
        }
      }
    }

    // Climb up (if on/in climbable)
    const blockAt = this.classifyBlock(pos);
    const blockBelow = this.classifyBlock(pos.offset(0, -1, 0));
    if (blockAt === 'climbable' || blockBelow === 'climbable') {
      const upPos = pos.offset(0, 1, 0);
      const blockAtUp = this.classifyBlock(upPos);
      const blockAboveUp = this.classifyBlock(upPos.offset(0, 1, 0));

      // Can climb up if destination is passable/climbable
      if ((blockAtUp === 'passable' || blockAtUp === 'climbable') &&
          (blockAboveUp === 'passable' || blockAboveUp === 'climbable')) {
        neighbors.push(this.createNode(upPos, node, 'climb_up', COSTS.climb));
      }
    }

    // Climb down (if destination has climbable)
    const downPos = pos.offset(0, -1, 0);
    const blockAtDown = this.classifyBlock(downPos);
    if (blockAtDown === 'climbable' || blockBelow === 'climbable') {
      if (this.canPassThrough(downPos)) {
        neighbors.push(this.createNode(downPos, node, 'climb_down', COSTS.climb));
      }
    }

    return neighbors;
  }

  /**
   * Create a path node
   */
  private createNode(pos: Vec3, parent: PathNode, moveType: MoveType, moveCost: number): PathNode {
    const g = parent.g + moveCost;
    return {
      pos: pos.floored(),
      g,
      h: 0, // Will be set later
      f: 0, // Will be set later
      parent,
      moveType,
    };
  }

  /**
   * Heuristic function (Euclidean distance)
   */
  private heuristic(a: Vec3, b: Vec3): number {
    return a.distanceTo(b);
  }

  /**
   * Find path from start to goal using A*
   */
  public findPath(start: Vec3, goal: Vec3): Vec3[] | null {
    const startNode: PathNode = {
      pos: start.floored(),
      g: 0,
      h: this.heuristic(start, goal),
      f: this.heuristic(start, goal),
      parent: null,
      moveType: 'start',
    };

    const openSet = new PriorityQueue<PathNode>();
    const closedSet = new Set<string>();

    openSet.enqueue(startNode, startNode.f);

    let iterations = 0;

    while (!openSet.isEmpty() && iterations < this.maxIterations) {
      iterations++;

      const current = openSet.dequeue()!;
      const posKey = `${current.pos.x},${current.pos.y},${current.pos.z}`;

      // Skip if already visited
      if (closedSet.has(posKey)) continue;
      closedSet.add(posKey);

      // Check if we reached the goal (within 1 block)
      if (current.pos.distanceTo(goal) < 1.5) {
        return this.reconstructPath(current);
      }

      // Explore neighbors
      for (const neighbor of this.getNeighbors(current)) {
        const neighborKey = `${neighbor.pos.x},${neighbor.pos.y},${neighbor.pos.z}`;
        if (closedSet.has(neighborKey)) continue;

        neighbor.h = this.heuristic(neighbor.pos, goal);
        neighbor.f = neighbor.g + neighbor.h;

        openSet.enqueue(neighbor, neighbor.f);
      }
    }

    // No path found
    console.log(`[SimplePathfinder] No path found after ${iterations} iterations`);
    return null;
  }

  /**
   * Reconstruct path from goal node
   */
  private reconstructPath(node: PathNode): Vec3[] {
    const path: Vec3[] = [];
    let current: PathNode | null = node;

    while (current) {
      path.unshift(current.pos);
      current = current.parent;
    }

    return path;
  }

  /**
   * Execute movement along a path
   */
  public async executePath(path: Vec3[]): Promise<void> {
    for (let i = 1; i < path.length; i++) {
      const target = path[i];
      const prev = path[i - 1];

      // Determine move type for this segment
      const dy = target.y - prev.y;
      const isClimbing = Math.abs(dy) > 0.5 && this.classifyBlock(target) === 'climbable';

      // Move towards target with appropriate method
      if (isClimbing) {
        await this.moveClimbing(target, dy > 0);
      } else {
        await this.moveWalking(target);
      }

      // Small delay between moves
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }

  /**
   * Move by walking/running to a point
   */
  private async moveWalking(target: Vec3): Promise<void> {
    const bot = this.bot;
    const targetCenter = target.offset(0.5, 0, 0.5);
    const startTime = Date.now();
    const timeout = 3000; // 3 seconds per waypoint

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const pos = bot.entity.position;
        const dx = targetCenter.x - pos.x;
        const dz = targetCenter.z - pos.z;
        const dy = target.y - pos.y;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        // Reached target (within 0.5 blocks)
        if (horizontalDist < 0.5 && Math.abs(dy) < 1) {
          bot.clearControlStates();
          clearInterval(checkInterval);
          resolve();
          return;
        }

        // Timeout
        if (Date.now() - startTime > timeout) {
          bot.clearControlStates();
          clearInterval(checkInterval);
          resolve();
          return;
        }

        // Look towards target
        const yaw = Math.atan2(-dx, -dz);
        bot.look(yaw, 0, true);

        // Move forward
        bot.setControlState('forward', true);

        // Jump if we need to go up (for stairs/slabs/1-block jumps)
        if (dy > 0.4) {
          bot.setControlState('jump', true);
        } else {
          bot.setControlState('jump', false);
        }

        // Sprint if far enough
        bot.setControlState('sprint', horizontalDist > 3);

      }, 50);
    });
  }

  /**
   * Move by climbing (scaffolding/ladder/vine)
   */
  private async moveClimbing(target: Vec3, goingUp: boolean): Promise<void> {
    const bot = this.bot;
    const startTime = Date.now();
    const timeout = 2000; // 2 seconds per climb step

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const pos = bot.entity.position;
        const dy = target.y - pos.y;

        // Reached target Y
        if (Math.abs(dy) < 0.5) {
          bot.clearControlStates();
          clearInterval(checkInterval);
          resolve();
          return;
        }

        // Timeout
        if (Date.now() - startTime > timeout) {
          bot.clearControlStates();
          clearInterval(checkInterval);
          resolve();
          return;
        }

        // Climbing controls
        if (goingUp) {
          // Hold jump to climb up scaffolding/ladder
          bot.setControlState('jump', true);
          bot.setControlState('forward', true);
        } else {
          // Sneak to climb down slowly
          bot.setControlState('sneak', true);
        }

      }, 50);
    });
  }

  /**
   * High-level goto function
   */
  public async goto(goal: Vec3, tolerance: number = 0): Promise<boolean> {
    const start = this.bot.entity.position.floored();
    const goalFloored = goal.floored();

    console.log(`[SimplePathfinder] Finding path from ${start} to ${goalFloored}`);

    const path = this.findPath(start, goalFloored);

    if (!path) {
      console.log(`[SimplePathfinder] No path found!`);
      return false;
    }

    console.log(`[SimplePathfinder] Found path with ${path.length} waypoints`);

    await this.executePath(path);

    const finalDist = this.bot.entity.position.distanceTo(goal);
    const success = finalDist <= tolerance;

    console.log(`[SimplePathfinder] Finished. Distance to goal: ${finalDist.toFixed(2)}, Success: ${success}`);

    return success;
  }
}

export default SimplePathfinder;
