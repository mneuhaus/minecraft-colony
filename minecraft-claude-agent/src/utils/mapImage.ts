import type { Bot } from 'mineflayer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import mcAssets from 'minecraft-assets';
import { look_at_map } from '../craftscript/env.js';

type MapOptions = {
  radius?: number;
  zoom?: number;
  grep?: string[];
  view?: 'stacked' | 'top';
};

const COLOR_FALLBACKS: Record<string, string> = {
  grass_block: '#7cbd6b',
  dirt: '#96651b',
  stone: '#7f7f7f',
  cobblestone: '#7a7a7a',
  sand: '#dbd3a0',
  sandstone: '#d9c8a4',
  gravel: '#857b7b',
  oak_log: '#6e5231',
  oak_planks: '#9c7f4e',
  oak_leaves: '#62a835',
  jungle_leaves: '#69a839',
  jungle_planks: '#a67d4d',
  water: '#3f76e4',
  lava: '#ea5b09',
  terracotta: '#a26a52',
  brown_terracotta: '#7a4b2a',
  light_gray_terracotta: '#b6b0a2',
  white_terracotta: '#d6c3b0',
  orange_terracotta: '#d78a42',
  red_terracotta: '#b44940'
};

const MC_VERSION = process.env.MINECRAFT_VERSION || '1.21.4';
const assets = mcAssets(MC_VERSION);
const textureCache = new Map<string, Buffer | null>();

function hashColor(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  const sat = 45 + (Math.abs(hash) % 30);
  const light = 35 + (Math.abs(hash) % 25);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function blockColor(blocks: string[] = []): string {
  if (!blocks.length) return '#2a2a2a';
  for (const id of blocks) {
    const key = Object.keys(COLOR_FALLBACKS).find((k) => id.includes(k));
    if (key) return COLOR_FALLBACKS[key];
  }
  return hashColor(blocks[0]);
}

function pickSurfaceBlock(cell: any): string | null {
  const tops = Array.isArray(cell?.top_blocks) ? cell.top_blocks.filter(Boolean) : [];
  if (tops.length) {
    const counts = new Map<string, number>();
    for (const block of tops) counts.set(block, (counts.get(block) ?? 0) + 1);
    let winner: string | null = null;
    let max = 0;
    counts.forEach((count, block) => {
      if (count > max) {
        max = count;
        winner = block;
      }
    });
    if (winner) return winner;
  }
  const blocks = Array.isArray(cell?.blocks) ? cell.blocks : [];
  return blocks.length ? blocks[0] : null;
}

function readTextureFromDisk(key: string): Buffer | null {
  const p = path.join(assets.directory || '', `${key}.png`);
  if (fs.existsSync(p)) {
    return fs.readFileSync(p);
  }
  return null;
}

function getTextureBuffer(blockName: string | null | undefined): Buffer | null {
  if (!blockName) return null;
  const clean = blockName.replace(/^minecraft:/, '');
  if (textureCache.has(clean)) return textureCache.get(clean) || null;

  const fromIndex = assets.textureContent?.[clean]?.texture;
  if (typeof fromIndex === 'string' && fromIndex.startsWith('data:image')) {
    const b64 = fromIndex.split(',')[1];
    if (b64) {
      const buf = Buffer.from(b64, 'base64');
      textureCache.set(clean, buf);
      return buf;
    }
  }

  const textureKey = assets.getTexture?.(clean);
  if (textureKey) {
    const key = textureKey.replace(/^minecraft:/, '');
    const entry = assets.textureContent?.[key]?.texture;
    if (typeof entry === 'string' && entry.startsWith('data:image')) {
      const b64 = entry.split(',')[1];
      if (b64) {
        const buf = Buffer.from(b64, 'base64');
        textureCache.set(clean, buf);
        return buf;
      }
    }
    const disk = readTextureFromDisk(key);
    if (disk) {
      textureCache.set(clean, disk);
      return disk;
    }
  }

  textureCache.set(clean, null);
  return null;
}

export async function generateMapImage(bot: Bot, options: MapOptions = {}) {
  const radius = options.radius ?? 20;
  const zoom = options.zoom ?? 1;
  const grep = options.grep ?? [];
  const view = options.view ?? 'top';

  const snapshot = look_at_map(bot, radius, zoom, grep);
  const cells = Array.isArray(snapshot?.cells) ? snapshot.cells : [];
  if (!cells.length) {
    return { image: null, width: 0, height: 0, info: { message: 'No cells to render' } };
  }

  const xs = Array.from(new Set(cells.map((c: any) => c.x))).sort((a, b) => a - b);
  const zs = Array.from(new Set(cells.map((c: any) => c.z))).sort((a, b) => a - b);
  const cellSize = view === 'stacked' ? 20 : 24;
  const offset = 120;
  const gridWidth = xs.length * cellSize;
  const gridHeight = zs.length * cellSize;
  const canvasWidth = gridWidth + offset * 2;
  const canvasHeight = gridHeight + offset * 2;

  const overlays: sharp.OverlayOptions[] = [];
  for (const cell of cells as any[]) {
    const xIndex = xs.indexOf(cell.x);
    const zIndex = zs.indexOf(cell.z);
    if (xIndex === -1 || zIndex === -1) continue;
    const topBlock = view === 'stacked' ? null : pickSurfaceBlock(cell);
    const blockId = topBlock || (Array.isArray(cell.blocks) ? cell.blocks[0] : null);
    const texture = getTextureBuffer(blockId);
    let tile: Buffer;
    if (texture) {
      tile = await sharp(texture).resize(cellSize, cellSize, { fit: 'cover' }).png().toBuffer();
    } else {
      const fill = blockColor(blockId ? [blockId] : cell.blocks || []);
      tile = await sharp({
        create: { width: cellSize, height: cellSize, channels: 4, background: fill }
      }).png().toBuffer();
    }
    const left = Math.round(offset + xIndex * cellSize);
    const top = Math.round(offset + (zs.length - 1 - zIndex) * cellSize);
    overlays.push({ input: tile, left, top });
  }

  const base = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: '#04060d'
    }
  }).png();

  const gridBuffer = await base.composite(overlays).png().toBuffer();

  const svgParts: string[] = [];
  xs.forEach((x, idx) => {
    const labelX = offset + idx * cellSize + cellSize / 2;
    svgParts.push(`<text x="${labelX}" y="${offset - 30}" font-size="16" text-anchor="middle" fill="#d1d5db">${x}</text>`);
    svgParts.push(`<text x="${labelX}" y="${canvasHeight - offset + 45}" font-size="16" text-anchor="middle" fill="#d1d5db">${x}</text>`);
  });
  zs.forEach((z, idx) => {
    const labelY = offset + (zs.length - 1 - idx) * cellSize + cellSize / 2 + 5;
    svgParts.push(`<text x="${offset - 25}" y="${labelY}" font-size="16" text-anchor="end" fill="#d1d5db">${z}</text>`);
    svgParts.push(`<text x="${canvasWidth - offset + 25}" y="${labelY}" font-size="16" text-anchor="start" fill="#d1d5db">${z}</text>`);
  });

  const originX = snapshot?.grid?.origin?.x ?? null;
  const originZ = snapshot?.grid?.origin?.z ?? null;
  if (originX !== null && originZ !== null) {
    const botX = offset + xs.indexOf(originX) * cellSize + cellSize / 2;
    const botY = offset + (zs.length - 1 - zs.indexOf(originZ)) * cellSize + cellSize / 2;
    svgParts.push(`<circle cx="${botX}" cy="${botY}" r="${cellSize / 2}" stroke="#ffffff" stroke-width="3" fill="none" />`);
  }

  svgParts.push(`<text x="${canvasWidth / 2}" y="${canvasHeight - 20}" font-size="18" fill="#e5e7eb" text-anchor="middle">radius=${radius} | zoom=${zoom} | view=${view}</text>`);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;">
  ${svgParts.join('\n')}
</svg>`;

  const imageBuffer = await sharp(gridBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return {
    image: `data:image/png;base64,${imageBuffer.toString('base64')}`,
    width: canvasWidth,
    height: canvasHeight,
    info: {
      radius,
      zoom,
      cells: cells.length,
      view
    }
  };
}

export async function getMapImagePayload(bot: Bot, options: MapOptions = {}) {
  return generateMapImage(bot, options);
}
