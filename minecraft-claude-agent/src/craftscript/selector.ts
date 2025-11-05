import type { SelTerm, Selector } from './types.js';
import { Vec3 } from 'vec3';

export type Heading = 'N' | 'E' | 'S' | 'W';

export function yawToHeadingRadians(yaw: number): Heading {
  // Mineflayer yaw: 0 faces -Z (south?), increases clockwise; normalize to N,E,S,W
  // We'll map yaw to closest cardinal
  const twoPi = Math.PI * 2;
  let y = yaw % twoPi;
  if (y < 0) y += twoPi;
  // Define cardinal yaw centers in radians for mineflayer coordinate system:
  // Facing -Z => yaw = 0 (South), +X => -Math.PI/2 or 3PI/2 (West?), +Z => PI (North), -X => PI/2 (East)
  // For simplicity, map to Minecraft-like: Z- = South, Z+ = North, X+ = East, X- = West
  const sectors: { h: Heading; center: number }[] = [
    { h: 'S', center: 0 },
    { h: 'W', center: Math.PI / 2 },
    { h: 'N', center: Math.PI },
    { h: 'E', center: (3 * Math.PI) / 2 },
  ];
  let best: { h: Heading; d: number } = { h: 'S', d: Infinity };
  for (const s of sectors) {
    const d = Math.min(Math.abs(y - s.center), twoPi - Math.abs(y - s.center));
    if (d < best.d) best = { h: s.h, d };
  }
  return best.h;
}

export function headingToBasis(heading: Heading): { f: Vec3; r: Vec3 } {
  switch (heading) {
    case 'N':
      return { f: new Vec3(0, 0, 1), r: new Vec3(1, 0, 0) };
    case 'S':
      return { f: new Vec3(0, 0, -1), r: new Vec3(-1, 0, 0) };
    case 'E':
      return { f: new Vec3(1, 0, 0), r: new Vec3(0, 0, -1) };
    case 'W':
      return { f: new Vec3(-1, 0, 0), r: new Vec3(0, 0, 1) };
  }
}

export function selectorToOffset(sel: Selector, heading: Heading): Vec3 {
  const { f, r } = headingToBasis(heading);
  let acc = new Vec3(0, 0, 0);
  for (const term of sel.terms) {
    acc = acc.plus(axisTermVector(term, f, r));
  }
  return acc;
}

export function axisTermVector(term: SelTerm, f: Vec3, r: Vec3): Vec3 {
  const n = term.n;
  switch (term.axis) {
    case 'f':
      return f.scaled(n);
    case 'b':
      return f.scaled(-n);
    case 'r':
      return r.scaled(n);
    case 'l':
      return r.scaled(-n);
    case 'u':
      return new Vec3(0, n, 0);
    case 'd':
      return new Vec3(0, -n, 0);
  }
}

export function selectorToKey(sel: Selector, _heading?: Heading, upper = true): string {
  const parts = sel.terms.map((t) => `${axisLetter(t.axis, upper)}${t.n}`);
  return parts.join('+');
}

function axisLetter(a: SelTerm['axis'], upper: boolean): string {
  const m: Record<string, string> = { f: 'F', b: 'B', r: 'R', l: 'L', u: 'U', d: 'D' };
  const s = m[a];
  return upper ? s : s.toLowerCase();
}
