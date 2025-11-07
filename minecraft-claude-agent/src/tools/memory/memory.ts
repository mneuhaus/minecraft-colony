import fs from 'fs';
import path from 'path';

const MEMORY_DIR = path.resolve('logs/memories');

/**
 * Get bot memory as markdown text
 */
export async function getMemoryText(botName: string): Promise<string> {
  try {
    const memoryPath = path.join(MEMORY_DIR, `${botName}.md`);

    if (fs.existsSync(memoryPath)) {
      return fs.readFileSync(memoryPath, 'utf-8');
    }

    // Return default empty memory
    return `# ${botName}'s Memory

## Important Facts
- (none yet)

## Accomplishments
- (none yet)

## Notes
- (none yet)
`;
  } catch (error: any) {
    return `Failed to read memory: ${error.message}`;
  }
}

/**
 * Update bot memory with markdown text
 */
export async function updateMemoryText(botName: string, content: string): Promise<void> {
  try {
    // Ensure directory exists
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }

    const memoryPath = path.join(MEMORY_DIR, `${botName}.md`);

    // Write memory with atomic operation
    const tempPath = `${memoryPath}.tmp`;
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, memoryPath);
  } catch (error: any) {
    throw new Error(`Failed to update memory: ${error.message}`);
  }
}
