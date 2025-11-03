// Minimal MCRN parser/executor primitives for initial slice
export type McrnOp =
  | { type: 'GOTO_WAYPOINT'; name: string; tol?: number }
  | { type: 'LOOK_AT_WAYPOINT'; name: string }
  | { type: 'GOTO_WORLD'; x: number; y: number; z: number; tol?: number }
  | { type: 'LOOK_AT_WORLD'; x: number; y: number; z: number };

export function parseMcrn(mcrn: string): McrnOp[] {
  const lines = mcrn
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const ops: McrnOp[] = [];
  for (const line of lines) {
    // Examples we support:
    // GOTO @ WAYPOINT("home") tol=1;
    // LOOK_AT @ WAYPOINT("home");
    const gotoMatch = line.match(/^GOTO\s+@\s+WAYPOINT\("([^"]+)"\)\s*(tol=(\d+))?/i);
    if (gotoMatch) {
      ops.push({ type: 'GOTO_WAYPOINT', name: gotoMatch[1], tol: gotoMatch[3] ? Number(gotoMatch[3]) : 1 });
      continue;
    }
    const lookMatch = line.match(/^LOOK_AT\s+@\s+WAYPOINT\("([^"]+)"\)/i);
    if (lookMatch) {
      ops.push({ type: 'LOOK_AT_WAYPOINT', name: lookMatch[1] });
      continue;
    }
    const worldGoto = line.match(/^GOTO\s+@\s+WORLD\(([-\d]+),\s*([-\d]+),\s*([-\d]+)\)\s*(tol=(\d+))?/i);
    if (worldGoto) {
      ops.push({ type: 'GOTO_WORLD', x: Number(worldGoto[1]), y: Number(worldGoto[2]), z: Number(worldGoto[3]), tol: worldGoto[5] ? Number(worldGoto[5]) : 1 });
      continue;
    }
    const worldLook = line.match(/^LOOK_AT\s+@\s+WORLD\(([-\d]+),\s*([-\d]+),\s*([-\d]+)\)/i);
    if (worldLook) {
      ops.push({ type: 'LOOK_AT_WORLD', x: Number(worldLook[1]), y: Number(worldLook[2]), z: Number(worldLook[3]) });
      continue;
    }
    // Ignore unsupported lines for now
  }
  return ops;
}
