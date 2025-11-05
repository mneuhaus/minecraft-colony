import type { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';
import { Vec3 } from 'vec3';
import pathfinderPkg from 'mineflayer-pathfinder';
import { headingToBasis, selectorToKey, selectorToOffset, yawToHeadingRadians, type Heading } from './selector.js';
import type { Selector as SelAst } from './types.js';

const { goals, Movements } = pathfinderPkg as any;

export type VoxSnapshot = {
  window: { radius: number; shape: [number, number, number] };
  vox: Record<string, string>;
  predicates: Record<string, any>;
};

export function getPose(bot: Bot) {
  const feet = bot.entity?.position?.floored();
  const heading = yawToHeadingRadians(bot.entity.yaw);
  return { heading, feet_world: feet ? [feet.x, feet.y, feet.z] : [0, 0, 0] };
}

export async function get_vox(bot: Bot, radius = 2, include_air = false): Promise<VoxSnapshot> {
  const center = bot.entity.position.floored();
  const heading = yawToHeadingRadians(bot.entity.yaw);
  const vox: Record<string, string> = {};

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const pos = center.offset(dx, dy, dz);
        const b = bot.blockAt(pos);
        if (!b) continue;
        const name = b.name;
        if (!include_air && name === 'air') continue;
        // Convert (dx,dy,dz) to selector key in relative F/R/U basis
        const key = deltaToSelectorKey(dx, dy, dz, heading);
        vox[key] = `minecraft:${name}`.startsWith('minecraft:') ? name : `minecraft:${name}`;
      }
    }
  }

  // Precompute predicates for F1
  const pred: Record<string, any> = {};
  const f1 = selectorFromTerms([{ axis: 'f', n: 1 }]);
  pred[`SAFE_STEP_UP[F1]`] = safe_step_up(bot, f1);
  pred[`SAFE_STEP_DOWN[F1]`] = safe_step_down(bot, f1);
  pred[`CAN_STAND[F1]`] = can_stand(bot, f1);
  pred[`HAZARDS`] = detect_hazards(bot, radius);

  return {
    window: { radius, shape: [radius * 2 + 1, radius * 2 + 1, radius * 2 + 1] },
    vox,
    predicates: pred,
  };
}

export function affordances(bot: Bot, selector: SelAst) {
  const heading = yawToHeadingRadians(bot.entity.yaw);
  const target = bot.entity.position.floored().plus(selectorToOffset(selector, heading));
  const canStand = can_stand_at_world(bot, target);
  // prefetch surrounding blocks
  const selF1: SelAst = selectorFromTerms([{ axis: 'f', n: 1 }]);
  const safeUp = safe_step_up(bot, selF1);
  const safeDown = safe_step_down(bot, selF1);

  const faces: ("up"|"down"|"north"|"south"|"east"|"west")[] = [];
  // Check placeable faces around target using adjacent support blocks
  const adj: [string, Vec3][] = [
    ['up', new Vec3(0, 1, 0)],
    ['down', new Vec3(0, -1, 0)],
    ['north', new Vec3(0, 0, -1)],
    ['south', new Vec3(0, 0, 1)],
    ['west', new Vec3(-1, 0, 0)],
    ['east', new Vec3(1, 0, 0)],
  ];
  for (const [name, off] of adj) {
    const b = bot.blockAt(target.plus(off));
    if (b && b.name !== 'air') faces.push(name as any);
  }

  // Provide a naive best tool hint for the block currently at target
  const block = bot.blockAt(target);
  let break_best: string | null = null;
  if (block) {
    const best = bot.pathfinder?.bestHarvestTool?.(block);
    if (best) break_best = `minecraft:${best.name}`;
  }

  return {
    selector: selectorToKey(selector, heading),
    can_stand: canStand,
    safe_step_up: safeUp,
    safe_step_down: safeDown,
    placeable_faces: faces,
    tools: { break_best, place_requires_support: true },
  };
}

export async function nearest(bot: Bot, query: { block_id?: string; entity_id?: string; radius?: number; reachable?: boolean }) {
  const heading = yawToHeadingRadians(bot.entity.yaw);
  const origin = bot.entity.position.floored();
  const radius = query.radius ?? 48;
  const matches: any[] = [];

  if (query.block_id) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const pos = origin.offset(dx, dy, dz);
          const b = bot.blockAt(pos);
          if (!b) continue;
          const id = `minecraft:${b.name}`;
          if (id === query.block_id) {
            const sel = deltaToSelectorKey(dx, dy, dz, heading);
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            matches.push({ selector: sel, world: [pos.x, pos.y, pos.z], dist, reachable: undefined });
          }
        }
      }
    }
  }

  if (query.entity_id) {
    for (const e of Object.values(bot.entities)) {
      // Mineflayer doesn't expose registry ids for entities; match by type/name contains
      if ((e as any).name === query.entity_id || (e as any).mobType === query.entity_id) {
        const dx = Math.floor(e.position.x) - origin.x;
        const dy = Math.floor(e.position.y) - origin.y;
        const dz = Math.floor(e.position.z) - origin.z;
        const sel = deltaToSelectorKey(dx, dy, dz, heading);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        matches.push({ selector: sel, world: [Math.floor(e.position.x), Math.floor(e.position.y), Math.floor(e.position.z)], dist, reachable: undefined });
      }
    }
  }

  // If reachable requested, estimate via pathfinder static query when available
  if (query.reachable) {
    for (const m of matches) {
      try {
        const movements = new Movements(bot);
        const goal = new goals.GoalNear(m.world[0], m.world[1], m.world[2], 1);
        const res = await (bot.pathfinder as any).getPathTo(movements, goal);
        m.reachable = Boolean(res?.status === 'success' || res?.path?.length);
      } catch {
        m.reachable = false;
      }
    }
  }

  matches.sort((a, b) => a.dist - b.dist);
  return { matches };
}

export function block_info(bot: Bot, target: { id?: string; selector?: SelAst }) {
  if (target.id) {
    return staticBlockInfo(bot, target.id);
  }
  if (!target.selector) throw new Error('selector or id required');
  const heading = yawToHeadingRadians(bot.entity.yaw);
  const pos = bot.entity.position.floored().plus(selectorToOffset(target.selector, heading));
  const b = bot.blockAt(pos);
  if (!b) return { id: null, state: null, props: {} };
  const info = staticBlockInfo(bot, `minecraft:${b.name}`);
  return info;
}

export function get_topography(bot: Bot, radius = 6) {
  const heading = yawToHeadingRadians(bot.entity.yaw);
  const origin = bot.entity.position.floored();
  const gridSize = radius * 2 + 1;
  const heightmap: Record<string, number> = {};
  const slope: Record<string, string> = {};
  let min = 0;
  let max = 0;
  let flat = 0;

  for (let fx = -radius; fx <= radius; fx++) {
    for (let fr = -radius; fr <= radius; fr++) {
      const key = `${frKey(fx)}+${rrKey(fr)}`.replace('+L0', '+R0').replace('F0+', 'F0+');
      const delta = relativeFRtoDelta(fx, fr, heading);
      const colTopY = findSurfaceY(bot, origin.offset(delta.x, 0, delta.z));
      const rel = colTopY - origin.y;
      heightmap[key] = rel;
      if (rel === 0) flat++;
      if (rel < min) min = rel;
      if (rel > max) max = rel;

      slope[key] = rel > 0 ? 'gentle_up' : rel < 0 ? 'down' : 'flat';
    }
  }

  return {
    grid: { size: [gridSize, gridSize], origin: 'F0/R0' },
    heightmap,
    slope,
    summary: { min, max, flat_cells: flat },
  };
}

// Navigation wrapper
type NavState = {
  id: string;
  state: 'planning' | 'moving' | 'arrived' | 'stuck' | 'failed' | 'canceled';
  start: number;
  updates: number;
  replan_count: number;
  goal: { x: number; y: number; z: number; tol: number };
  timeout_ms: number;
  reason?: string;
};
const NAV_SESSIONS = new Map<string, NavState>();

export function nav(bot: Bot, req: any) {
  const heading = yawToHeadingRadians(bot.entity.yaw);

  if (req.action === 'start') {
    const id = `nav_${Math.random().toString(36).slice(2, 6)}`;
    const target = req.target;
    let x: number, y: number, z: number;
    if (target.type === 'WORLD') {
      ({ x, y, z } = target);
    } else if (target.type === 'SELECTOR') {
      const sel = target.sel as SelAst | string;
      if (typeof sel === 'string') throw new Error('Selector string not supported here');
      const pos = bot.entity.position.floored().plus(selectorToOffset(sel as SelAst, heading));
      x = pos.x; y = pos.y; z = pos.z;
    } else {
      throw new Error('Unknown target type');
    }

    const tol = req.tol ?? 1;
    const timeout_ms = req.timeout_ms ?? 10000;
    const movements = new Movements(bot);
    if (req.policy) {
      if (typeof req.policy.max_drop === 'number') (movements as any).maxDrop = req.policy.max_drop;
      if (typeof req.policy.max_step === 'number') (movements as any).maxStepHeight = req.policy.max_step;
      if (req.policy.allow_dig === false) (movements as any).canDig = false;
    }
    bot.pathfinder.setMovements(movements);
    const goal = new goals.GoalNear(x, y, z, tol);
    const st: NavState = { id, state: 'planning', start: Date.now(), updates: 0, replan_count: 0, goal: { x, y, z, tol }, timeout_ms };
    NAV_SESSIONS.set(id, st);

    const onUpdate = (_u: any) => {
      st.state = 'moving';
      st.updates++;
      st.replan_count++;
    };
    const onArrived = () => {
      st.state = 'arrived';
      cleanup();
    };
    const onAborted = () => {
      st.state = 'canceled';
      st.reason = 'goal_reset';
      cleanup();
    };
    const cleanup = () => {
      (bot as any).removeListener('path_update', onUpdate as any);
      (bot as any).removeListener('goal_reached', onArrived as any);
      (bot as any).removeListener('goal_reset', onAborted as any);
    };

    (bot as any).on('path_update', onUpdate as any);
    (bot as any).once('goal_reached', onArrived as any);
    (bot as any).once('goal_reset', onAborted as any);

    bot.pathfinder.setGoal(goal, true);

    // handle timeout
    setTimeout(() => {
      const cur = NAV_SESSIONS.get(id);
      if (cur && cur.state !== 'arrived' && cur.state !== 'canceled') {
        cur.state = 'failed';
        cur.reason = 'timeout';
        NAV_SESSIONS.set(id, cur);
        bot.pathfinder.setGoal(null);
      }
    }, timeout_ms);

    return { nav_id: id, state: st.state };
  }

  if (req.action === 'status') {
    const st = NAV_SESSIONS.get(req.nav_id);
    if (!st) return { nav_id: req.nav_id, state: 'failed' };
    const me = bot.entity.position;
    const dist = Math.sqrt((st.goal.x - me.x) ** 2 + (st.goal.y - me.y) ** 2 + (st.goal.z - me.z) ** 2);
    const eta = Math.max(1, Math.round(dist / 1.4));
    return {
      nav_id: st.id,
      state: st.state,
      distance_remaining: Number(dist.toFixed(1)),
      nodes_expanded: st.updates,
      replan_count: st.replan_count,
      eta_seconds: eta,
      ...(st.reason ? { reason: st.reason } : {}),
    };
  }

  if (req.action === 'cancel') {
    const st = NAV_SESSIONS.get(req.nav_id);
    if (!st) return { nav_id: req.nav_id, state: 'canceled' };
    bot.pathfinder.setGoal(null);
    st.state = 'canceled';
    NAV_SESSIONS.set(st.id, st);
    return { nav_id: st.id, state: 'canceled' };
  }

  throw new Error('Unknown nav action');
}

// Helpers
function deltaToSelectorKey(dx: number, dy: number, dz: number, heading: Heading): string {
  // Convert world-space delta to relative F/R/U key
  const { f, r } = headingToBasis(heading);
  // Solve for coefficients a, b where a*f + b*r + (0,dy,0) = (dx,dy,dz)
  // f and r are orthonormal in XZ plane.
  const a = dot2D(dx, dz, f.x, f.z);
  const b = dot2D(dx, dz, r.x, r.z);
  const parts = [] as string[];
  if (a !== 0) parts.push(`${a >= 0 ? 'F' : 'B'}${Math.abs(a)}`);
  if (b !== 0) parts.push(`${b >= 0 ? 'R' : 'L'}${Math.abs(b)}`);
  if (dy !== 0) parts.push(`${dy >= 0 ? 'U' : 'D'}${Math.abs(dy)}`);
  return parts.join('+') || 'F0';
}

function dot2D(ax: number, az: number, bx: number, bz: number): number {
  // For our discrete basis vectors, projection reduces to choosing component
  if (bx === 0 && bz === 1) return az; // N
  if (bx === 0 && bz === -1) return -az; // S
  if (bx === 1 && bz === 0) return ax; // E
  if (bx === -1 && bz === 0) return -ax; // W
  return 0;
}

function selectorFromTerms(terms: { axis: any; n: number }[]): SelAst {
  return { type: 'Selector', terms } as any;
}

function can_stand_at_world(bot: Bot, pos: Vec3): boolean {
  const below = bot.blockAt(pos);
  const feet = bot.blockAt(pos.offset(0, 1, 0));
  const head = bot.blockAt(pos.offset(0, 2, 0));
  return !!below && below.name !== 'air' && (!feet || feet.name === 'air') && (!head || head.name === 'air');
}

export function can_stand(bot: Bot, selector: SelAst): boolean {
  const heading = yawToHeadingRadians(bot.entity.yaw);
  const pos = bot.entity.position.floored().plus(selectorToOffset(selector, heading));
  return can_stand_at_world(bot, pos);
}

export function is_air(bot: Bot, selector: SelAst): boolean {
  const heading = yawToHeadingRadians(bot.entity.yaw);
  const pos = bot.entity.position.floored().plus(selectorToOffset(selector, heading));
  const b = bot.blockAt(pos);
  return !b || b.name === 'air';
}

export function safe_step_up(bot: Bot, selector: SelAst): boolean {
  const heading = yawToHeadingRadians(bot.entity.yaw);
  const pos = bot.entity.position.floored().plus(selectorToOffset(selector, heading));
  // Need a solid block at feet (pos) and two air blocks above that position
  const foot = bot.blockAt(pos);
  const step = bot.blockAt(pos.offset(0, 1, 0));
  const head = bot.blockAt(pos.offset(0, 2, 0));
  return !!foot && foot.name !== 'air' && (!step || step.name === 'air') && (!head || head.name === 'air');
}

export function safe_step_down(bot: Bot, selector: SelAst): boolean {
  const heading = yawToHeadingRadians(bot.entity.yaw);
  const from = bot.entity.position.floored();
  const to = from.plus(selectorToOffset(selector, heading));
  const belowTo = bot.blockAt(to.offset(0, -1, 0));
  const toFeet = bot.blockAt(to);
  const toHead = bot.blockAt(to.offset(0, 1, 0));
  return !!belowTo && belowTo.name !== 'air' && (!toFeet || toFeet.name === 'air') && (!toHead || toHead.name === 'air');
}

export function detect_hazards(bot: Bot, radius: number): string[] {
  const center = bot.entity.position.floored();
  const hazards: string[] = [];
  // Simple checks: gravel/sand overhead, lava nearby
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = 1; dy <= radius; dy++) {
      const b = bot.blockAt(center.offset(dx, dy, 0));
      if (b && (b.name.includes('gravel') || b.name.includes('sand'))) {
        hazards.push('gravel_overhead');
        break;
      }
    }
  }
  // Lava within radius
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const b = bot.blockAt(center.offset(dx, 0, dz));
      if (b && b.name.includes('lava')) hazards.push('lava_near');
    }
  }
  return Array.from(new Set(hazards));
}

function staticBlockInfo(bot: Bot, id: string) {
  const mc = minecraftData(bot.version);
  const name = id.startsWith('minecraft:') ? id.slice('minecraft:'.length) : id;
  const b = mc.blocksByName[name];
  if (!b) return { id, state: null, props: {} };
  const falls = name.includes('gravel') || name.includes('sand');
  const preferred_tool = guessPreferredTool(mc, b);
  return {
    id: `minecraft:${name}`,
    state: null,
    props: {
      category: falls ? 'gravity' : 'solid',
      preferred_tool,
      falls,
      liquid: name.includes('water') || name.includes('lava'),
      place_requires_support: true,
      hardness: b.hardness ?? 1,
      light_emission: b.emitLight ?? 0,
      drops: b.drops?.map((d: any) => `minecraft:${mc.items[d]?.name || d}`) ?? [],
    },
  };
}

function guessPreferredTool(mc: any, block: any): string | null {
  if (block.harvestTools) {
    const toolIds = Object.keys(block.harvestTools).map((n) => Number(n));
    const item = mc.items[toolIds[0]];
    if (item) return `minecraft:${item.name}`;
  }
  return null;
}

function relativeFRtoDelta(f: number, r: number, heading: Heading): Vec3 {
  const basis = headingToBasis(heading);
  return basis.f.scaled(f).plus(basis.r.scaled(r));
}

function mkKey(n: number, positive: string, negative: string) {
  if (n === 0) return `${positive}0`;
  return `${n >= 0 ? positive : negative}${Math.abs(n)}`;
}
export function rrKey(n: number) { return mkKey(n, 'R', 'L'); }
export function frKey(n: number) { return mkKey(n, 'F', 'B'); }

function findSurfaceY(bot: Bot, xz: Vec3): number {
  // scan up and down from current Y to find first solid block top surface
  const startY = Math.floor(bot.entity.position.y);
  let y = startY + 12;
  for (; y > -64; y--) {
    const here = bot.blockAt(new Vec3(xz.x, y, xz.z));
    const above = bot.blockAt(new Vec3(xz.x, y + 1, xz.z));
    if (here && here.name !== 'air' && (!above || above.name === 'air')) return y;
  }
  return startY;
}
