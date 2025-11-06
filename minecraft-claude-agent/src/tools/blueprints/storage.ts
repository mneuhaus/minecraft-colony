import fs from 'fs';
import path from 'path';

export type PlaceFace = 'up' | 'down' | 'north' | 'south' | 'east' | 'west';

export interface BlueprintVoxel {
  x: number;
  y: number;
  z: number;
  id: string; // minecraft:<block>
  face?: PlaceFace; // preferred place face
  label?: string;   // optional tag for grouping
}

export interface Blueprint {
  name: string;
  description?: string;
  origin?: { x: number; y: number; z: number }; // default (0,0,0)
  vox: BlueprintVoxel[];
  meta?: {
    created_at: string;
    updated_at: string;
  };
}

export interface BlueprintSummary {
  name: string;
  description?: string;
  count: number;
  updated_at?: string;
}

function ensureDir(): string {
  const dir = path.resolve('logs', 'blueprints');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fileFor(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(ensureDir(), `${safe}.json`);
}

function normalizeBlockId(id: string): string {
  const s = String(id).trim();
  if (s.startsWith('minecraft:')) return s;
  return `minecraft:${s}`;
}

export function listBlueprints(): BlueprintSummary[] {
  const dir = ensureDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const out: BlueprintSummary[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Blueprint;
      out.push({
        name: raw.name,
        description: raw.description,
        count: Array.isArray(raw.vox) ? raw.vox.length : 0,
        updated_at: raw.meta?.updated_at,
      });
    } catch {}
  }
  out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return out;
}

export function getBlueprint(name: string): Blueprint | null {
  const file = fileFor(name);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Blueprint;
    return raw;
  } catch {
    return null;
  }
}

export function validateBlueprint(bp: Blueprint): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!bp || typeof bp !== 'object') return { ok: false, issues: ['invalid_blueprint_object'] };
  if (!bp.name || typeof bp.name !== 'string') issues.push('name_required');
  if (!Array.isArray(bp.vox)) issues.push('vox_required');
  else {
    for (let i = 0; i < bp.vox.length; i++) {
      const v = bp.vox[i] as any;
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) issues.push(`vox[${i}]:invalid_coords`);
      if (!v.id || typeof v.id !== 'string') issues.push(`vox[${i}]:id_required`);
      else if (!v.id.includes(':')) issues.push(`vox[${i}]:id_missing_namespace`);
      if (v.face && !['up','down','north','south','east','west'].includes(String(v.face))) issues.push(`vox[${i}]:invalid_face`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export type RotationY = 0 | 90 | 180 | 270;

function rotateXZ(x: number, z: number, rot: RotationY): { x: number; z: number } {
  switch (rot) {
    case 0: return { x, z };
    case 90: return { x: z, z: -x };         // 90° CW around Y
    case 180: return { x: -x, z: -z };
    case 270: return { x: -z, z: x };
  }
}

function rotateFaceY(face: PlaceFace | undefined, rot: RotationY): PlaceFace | undefined {
  if (!face) return face;
  if (face === 'up' || face === 'down') return face;
  const order: PlaceFace[] = ['north', 'east', 'south', 'west'];
  const idx = order.indexOf(face);
  if (idx < 0) return face;
  const steps = (rot / 90) | 0;
  return order[(idx + steps) % 4];
}

export function instantiateBlueprint(bp: Blueprint, origin: { x: number; y: number; z: number }, rotation: RotationY = 0): BlueprintVoxel[] {
  const vox = bp.vox || [];
  return vox.map((v) => {
    const rz = rotateXZ(v.x, v.z, rotation);
    return {
      x: origin.x + rz.x,
      y: origin.y + v.y,
      z: origin.z + rz.z,
      id: normalizeBlockId(v.id),
      face: rotateFaceY(v.face, rotation),
      label: v.label,
    } as BlueprintVoxel;
  });
}

export function createBlueprint(bp: Blueprint): Blueprint {
  const now = new Date().toISOString();
  const normalized: Blueprint = {
    name: String(bp.name).trim(),
    description: bp.description || '',
    origin: bp.origin ?? { x: 0, y: 0, z: 0 },
    vox: (bp.vox || []).map((v) => ({
      x: Number(v.x), y: Number(v.y), z: Number(v.z), id: normalizeBlockId(v.id), face: v.face, label: v.label,
    })),
    meta: { created_at: now, updated_at: now },
  };
  if (!normalized.name) throw new Error('name required');
  if (normalized.vox.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z))) {
    throw new Error('vox must contain finite x/y/z');
  }
  const file = fileFor(normalized.name);
  if (fs.existsSync(file)) throw new Error('blueprint_exists');
  fs.writeFileSync(file, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

export function updateBlueprint(name: string, patch: Partial<Blueprint>): Blueprint {
  const current = getBlueprint(name);
  if (!current) throw new Error('blueprint_not_found');
  const next: Blueprint = {
    ...current,
    description: patch.description ?? current.description,
    origin: patch.origin ?? current.origin,
    vox: Array.isArray(patch.vox)
      ? patch.vox.map((v) => ({ x: Number(v.x), y: Number(v.y), z: Number(v.z), id: normalizeBlockId(v.id), face: v.face, label: v.label }))
      : current.vox,
    meta: { created_at: current.meta?.created_at || new Date().toISOString(), updated_at: new Date().toISOString() },
  };
  fs.writeFileSync(fileFor(name), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function removeBlueprint(name: string): boolean {
  const file = fileFor(name);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}
