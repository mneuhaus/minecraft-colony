import sharp from 'sharp';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import path from 'path';
import fs from 'fs/promises';

interface BlockColor {
  r: number;
  g: number;
  b: number;
}

// Simplified color palette for common Minecraft blocks
const BLOCK_COLORS: Record<string, BlockColor> = {
  // Air/Empty
  air: { r: 135, g: 206, b: 235 }, // Sky blue

  // Stone types
  stone: { r: 128, g: 128, b: 128 },
  cobblestone: { r: 110, g: 110, b: 110 },
  andesite: { r: 132, g: 132, b: 132 },
  diorite: { r: 200, g: 200, b: 200 },
  granite: { r: 153, g: 102, b: 89 },

  // Dirt/Grass
  dirt: { r: 134, g: 96, b: 67 },
  grass_block: { r: 91, g: 158, b: 64 },
  podzol: { r: 90, g: 65, b: 40 },

  // Ores
  coal_ore: { r: 70, g: 70, b: 70 },
  iron_ore: { r: 170, g: 135, b: 110 },
  gold_ore: { r: 252, g: 238, b: 75 },
  diamond_ore: { r: 92, g: 219, b: 213 },

  // Wood
  oak_log: { r: 102, g: 81, b: 51 },
  birch_log: { r: 216, g: 216, b: 216 },
  spruce_log: { r: 58, g: 42, b: 24 },
  jungle_log: { r: 91, g: 71, b: 32 },
  oak_planks: { r: 162, g: 130, b: 79 },

  // Leaves
  oak_leaves: { r: 64, g: 128, b: 32 },
  birch_leaves: { r: 128, g: 167, b: 85 },

  // Liquids
  water: { r: 37, g: 87, b: 255 },
  lava: { r: 252, g: 84, b: 0 },

  // Terracotta
  brown_terracotta: { r: 77, g: 51, b: 35 },
  white_terracotta: { r: 209, g: 178, b: 161 },
  orange_terracotta: { r: 161, g: 83, b: 37 },

  // Other
  sand: { r: 237, g: 224, b: 155 },
  gravel: { r: 136, g: 126, b: 126 },
  glass: { r: 220, g: 240, b: 255 },
  ice: { r: 158, g: 200, b: 255 },
  snow: { r: 255, g: 255, b: 255 },

  // Default for unknown blocks
  unknown: { r: 200, g: 0, b: 200 }, // Magenta for debugging
};

function getBlockColor(blockName: string): BlockColor {
  // Remove minecraft: prefix if present
  const cleanName = blockName.replace('minecraft:', '');

  // Try exact match first
  if (BLOCK_COLORS[cleanName]) {
    return BLOCK_COLORS[cleanName];
  }

  // Try partial matches
  for (const [key, color] of Object.entries(BLOCK_COLORS)) {
    if (cleanName.includes(key)) {
      return color;
    }
  }

  // Default color
  return BLOCK_COLORS.unknown;
}

export interface ScreenshotOptions {
  width?: number;        // Number of blocks wide (default: 32)
  height?: number;       // Number of blocks tall (default: 32)
  viewMode?: 'topdown' | 'firstperson'; // View mode (default: topdown)
  scale?: number;        // Pixels per block (default: 16)
  yLevel?: number;       // Y level for top-down view (default: bot's Y position)
  outputPath?: string;   // Output file path (default: logs/screenshots/voxel-{timestamp}.png)
}

/**
 * Generate a screenshot from voxel data without prismarine-viewer
 */
export async function captureVoxelScreenshot(
  bot: Bot,
  options: ScreenshotOptions = {}
): Promise<string> {
  const {
    width = 32,
    height = 32,
    viewMode = 'topdown',
    scale = 16,
    yLevel,
  } = options;

  const outputPath = options.outputPath || await getDefaultOutputPath();

  if (viewMode === 'topdown') {
    return await captureTopDown(bot, width, height, scale, yLevel, outputPath);
  } else {
    return await captureFirstPerson(bot, width, height, scale, outputPath);
  }
}

async function getDefaultOutputPath(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const screenshotDir = path.join(process.cwd(), 'logs', 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  return path.join(screenshotDir, `voxel-${timestamp}.png`);
}

/**
 * Capture top-down view of the world
 */
async function captureTopDown(
  bot: Bot,
  blocksWide: number,
  blocksDeep: number,
  scale: number,
  yLevel: number | undefined,
  outputPath: string
): Promise<string> {
  const centerX = Math.floor(bot.entity.position.x);
  const centerZ = Math.floor(bot.entity.position.z);
  const centerY = yLevel !== undefined ? yLevel : Math.floor(bot.entity.position.y);

  const startX = centerX - Math.floor(blocksWide / 2);
  const startZ = centerZ - Math.floor(blocksDeep / 2);

  const imageWidth = blocksWide * scale;
  const imageHeight = blocksDeep * scale;

  // Create pixel buffer (RGBA)
  const buffer = Buffer.alloc(imageWidth * imageHeight * 4);

  // Render each block
  for (let z = 0; z < blocksDeep; z++) {
    for (let x = 0; x < blocksWide; x++) {
      const worldX = startX + x;
      const worldZ = startZ + z;

      // Find highest non-air block at this X,Z position
      let blockName = 'air';
      for (let y = centerY + 5; y >= centerY - 10; y--) {
        const block = bot.blockAt(new Vec3(worldX, y, worldZ));
        if (block && block.name !== 'air') {
          blockName = block.name;
          break;
        }
      }

      const color = getBlockColor(blockName);

      // Draw this block as a scale x scale square
      for (let py = 0; py < scale; py++) {
        for (let px = 0; px < scale; px++) {
          const pixelX = x * scale + px;
          const pixelY = z * scale + py;
          const idx = (pixelY * imageWidth + pixelX) * 4;

          buffer[idx] = color.r;     // R
          buffer[idx + 1] = color.g; // G
          buffer[idx + 2] = color.b; // B
          buffer[idx + 3] = 255;     // A (opaque)
        }
      }
    }
  }

  // Add bot position indicator (red dot)
  const botX = Math.floor((centerX - startX) * scale);
  const botZ = Math.floor((centerZ - startZ) * scale);
  if (botX >= 0 && botX < imageWidth && botZ >= 0 && botZ < imageHeight) {
    const markerSize = Math.max(2, Math.floor(scale / 4));
    for (let dy = -markerSize; dy <= markerSize; dy++) {
      for (let dx = -markerSize; dx <= markerSize; dx++) {
        const px = botX + dx;
        const py = botZ + dy;
        if (px >= 0 && px < imageWidth && py >= 0 && py < imageHeight) {
          const idx = (py * imageWidth + px) * 4;
          buffer[idx] = 255;     // Red
          buffer[idx + 1] = 0;
          buffer[idx + 2] = 0;
          buffer[idx + 3] = 255;
        }
      }
    }
  }

  // Save image
  await sharp(buffer, {
    raw: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);

  return outputPath;
}

/**
 * Capture first-person view (simplified - shows blocks in front of bot)
 */
async function captureFirstPerson(
  bot: Bot,
  blocksWide: number,
  blocksHigh: number,
  scale: number,
  outputPath: string
): Promise<string> {
  const yaw = bot.entity.yaw; // Horizontal rotation
  const pitch = bot.entity.pitch; // Vertical rotation

  // Calculate view direction
  const dirX = -Math.sin(yaw);
  const dirZ = -Math.cos(yaw);
  const dirY = Math.tan(pitch);

  const centerX = bot.entity.position.x;
  const centerY = bot.entity.position.y + 1.6; // Eye level
  const centerZ = bot.entity.position.z;

  const imageWidth = blocksWide * scale;
  const imageHeight = blocksHigh * scale;

  const buffer = Buffer.alloc(imageWidth * imageHeight * 4);

  // Simple ray-casting for each pixel
  const maxDistance = 32;
  const halfWidth = blocksWide / 2;
  const halfHeight = blocksHigh / 2;

  for (let screenY = 0; screenY < blocksHigh; screenY++) {
    for (let screenX = 0; screenX < blocksWide; screenX++) {
      // Calculate ray direction for this screen pixel
      const offsetX = (screenX - halfWidth) * 0.1;
      const offsetY = (screenY - halfHeight) * 0.1;

      let rayDirX = dirX + offsetX;
      let rayDirZ = dirZ;
      let rayDirY = dirY - offsetY;

      // Normalize
      const len = Math.sqrt(rayDirX * rayDirX + rayDirY * rayDirY + rayDirZ * rayDirZ);
      rayDirX /= len;
      rayDirY /= len;
      rayDirZ /= len;

      // Cast ray and find first block hit
      let blockName = 'air';
      for (let dist = 0.5; dist < maxDistance; dist += 0.5) {
        const x = Math.floor(centerX + rayDirX * dist);
        const y = Math.floor(centerY + rayDirY * dist);
        const z = Math.floor(centerZ + rayDirZ * dist);

        const block = bot.blockAt(new Vec3(x, y, z));
        if (block && block.name !== 'air') {
          blockName = block.name;
          break;
        }
      }

      const color = getBlockColor(blockName);

      // Draw pixel
      for (let py = 0; py < scale; py++) {
        for (let px = 0; px < scale; px++) {
          const pixelX = screenX * scale + px;
          const pixelY = screenY * scale + py;
          const idx = (pixelY * imageWidth + pixelX) * 4;

          buffer[idx] = color.r;
          buffer[idx + 1] = color.g;
          buffer[idx + 2] = color.b;
          buffer[idx + 3] = 255;
        }
      }
    }
  }

  // Save image
  await sharp(buffer, {
    raw: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);

  return outputPath;
}

/**
 * Generate a text-based ASCII representation (bonus feature!)
 */
export function generateASCIIView(bot: Bot, radius: number = 8): string {
  const centerX = Math.floor(bot.entity.position.x);
  const centerY = Math.floor(bot.entity.position.y);
  const centerZ = Math.floor(bot.entity.position.z);

  const chars: Record<string, string> = {
    air: ' ',
    stone: '█',
    dirt: '▓',
    grass_block: '▒',
    water: '≈',
    lava: '~',
    wood: '║',
    leaves: '░',
    sand: '░',
    unknown: '?',
  };

  let output = `\nTop-down view (Y=${centerY}):\n`;
  output += '  ' + '─'.repeat(radius * 2 + 1) + '\n';

  for (let z = centerZ - radius; z <= centerZ + radius; z++) {
    let line = ' │';
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      if (x === centerX && z === centerZ) {
        line += '@'; // Bot position
        continue;
      }

      const block = bot.blockAt(new Vec3(x, centerY, z));
      const name = block?.name || 'air';

      let char = chars.unknown;
      for (const [key, symbol] of Object.entries(chars)) {
        if (name.includes(key)) {
          char = symbol;
          break;
        }
      }

      line += char;
    }
    output += line + '│\n';
  }

  output += '  ' + '─'.repeat(radius * 2 + 1) + '\n';
  return output;
}
