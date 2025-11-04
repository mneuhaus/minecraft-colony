// MCRN parser/executor primitives (small, stable grammar)
export type McrnOp =
  | { type: 'GOTO_WAYPOINT'; name: string; tol?: number }
  | { type: 'LOOK_AT_WAYPOINT'; name: string }
  | { type: 'GOTO_WORLD'; x: number; y: number; z: number; tol?: number }
  | { type: 'LOOK_AT_WORLD'; x: number; y: number; z: number }
  | { type: 'PLACE'; block: string; offset: string }
  | { type: 'DIG'; offset: string }
  | { type: 'MOVE'; offset: string }
  | { type: 'TURN'; dir: 'R90' | 'L90' | '180' }
  | { type: 'REPEAT'; times: number; body: McrnOp[] };

// Public parse entry
export function parseMcrn(mcrn: string): McrnOp[] {
  const raw = mcrn.split('\n');
  const lines = raw.map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
  let i = 0;
  function parseBlock(): McrnOp[] {
    const ops: McrnOp[] = [];
    while (i < lines.length) {
      let line = lines[i];
      // Block end
      if (/^}\s*;?$/.test(line)) { i++; break; }

      // REPEAT n { ... }
      const rep = line.match(/^REPEAT\s+(\d+)\s*{\s*$/i);
      if (rep) {
        i++;
        const body = parseBlock();
        ops.push({ type: 'REPEAT', times: Number(rep[1]), body });
        continue;
      }

      // GOTO/LOOK @ WAYPOINT/WORLD (legacy support)
      const gotoWp = line.match(/^GOTO\s+@\s+WAYPOINT\("([^"]+)"\)\s*(tol=(\d+))?\s*;?$/i);
      if (gotoWp) { ops.push({ type: 'GOTO_WAYPOINT', name: gotoWp[1], tol: gotoWp[3] ? Number(gotoWp[3]) : 1 }); i++; continue; }
      const lookWp = line.match(/^LOOK_AT\s+@\s+WAYPOINT\("([^"]+)"\)\s*;?$/i);
      if (lookWp) { ops.push({ type: 'LOOK_AT_WAYPOINT', name: lookWp[1] }); i++; continue; }
      const gotoWorld = line.match(/^GOTO\s+@\s+WORLD\(([-\d]+),\s*([-\d]+),\s*([-\d]+)\)\s*(tol=(\d+))?\s*;?$/i);
      if (gotoWorld) { ops.push({ type: 'GOTO_WORLD', x: Number(gotoWorld[1]), y: Number(gotoWorld[2]), z: Number(gotoWorld[3]), tol: gotoWorld[5] ? Number(gotoWorld[5]) : 1 }); i++; continue; }
      const lookWorld = line.match(/^LOOK_AT\s+@\s+WORLD\(([-\d]+),\s*([-\d]+),\s*([-\d]+)\)\s*;?$/i);
      if (lookWorld) { ops.push({ type: 'LOOK_AT_WORLD', x: Number(lookWorld[1]), y: Number(lookWorld[2]), z: Number(lookWorld[3]) }); i++; continue; }

      // New primitives
      const place = line.match(/^PLACE\s+([A-Z0-9_:\-]+)\s+@\s*([A-Z0-9+\-^]+)\s*;?$/i);
      if (place) { ops.push({ type: 'PLACE', block: place[1], offset: place[2] }); i++; continue; }
      const dig = line.match(/^DIG\s+([A-Z0-9+\-^]+)\s*;?$/i);
      if (dig) { ops.push({ type: 'DIG', offset: dig[1] }); i++; continue; }
      const move = line.match(/^MOVE\s+([A-Z0-9+\-^]+)\s*;?$/i);
      if (move) { ops.push({ type: 'MOVE', offset: move[1] }); i++; continue; }
      const turn = line.match(/^TURN\s+(R90|L90|180)\s*;?$/i);
      if (turn) { ops.push({ type: 'TURN', dir: turn[1] as any }); i++; continue; }

      // Ignore unsupported line
      i++;
    }
    return ops;
  }
  return parseBlock();
}

// Utility to evaluate offsets like "F1+U1", "F1^" as alias for "F1+U1" (for MOVE semantics).
export function parseOffsetTokens(offset: string): Array<{ axis: 'F'|'B'|'R'|'L'|'U'|'D'; n: number }> {
  const clean = offset.replace('^', '+U1');
  const parts = clean.split('+');
  const out: Array<{ axis: any; n: number }> = [];
  for (const p of parts) {
    const m = p.match(/^([FBRLUD])(\d+)$/i);
    if (!m) continue;
    out.push({ axis: m[1].toUpperCase() as any, n: Number(m[2]) });
  }
  return out;
}
