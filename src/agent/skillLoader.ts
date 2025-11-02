import fs from 'fs/promises';
import path from 'path';
import logger from '../logger.js';

interface SkillMetadata {
  name: string;
  description: string;
  allowedTools?: string[];
}

interface Skill {
  metadata: SkillMetadata;
  content: string;
  fullContent: string; // Includes YAML frontmatter
}

/**
 * Parse YAML frontmatter from a SKILL.md file
 */
function parseSkillFrontmatter(content: string): { metadata: SkillMetadata; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    // No frontmatter found
    return {
      metadata: { name: 'unknown', description: '' },
      body: content,
    };
  }

  const yamlContent = match[1];
  const body = match[2];

  // Simple YAML parser for our specific needs
  const metadata: SkillMetadata = {
    name: 'unknown',
    description: '',
  };

  const lines = yamlContent.split('\n');
  for (const line of lines) {
    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) {
      metadata.name = nameMatch[1].trim();
    }

    const descMatch = line.match(/^description:\s*(.+)$/);
    if (descMatch) {
      metadata.description = descMatch[1].trim();
    }

    const toolsMatch = line.match(/^allowed-tools:\s*(.+)$/);
    if (toolsMatch) {
      metadata.allowedTools = toolsMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }
  }

  return { metadata, body };
}

/**
 * Load a single skill from a SKILL.md file
 */
async function loadSkill(skillPath: string): Promise<Skill | null> {
  try {
    const content = await fs.readFile(skillPath, 'utf-8');
    const { metadata, body } = parseSkillFrontmatter(content);

    return {
      metadata,
      content: body,
      fullContent: content,
    };
  } catch (error: any) {
    logger.error('Failed to load skill', {
      skillPath,
      error: error.message,
    });
    return null;
  }
}

/**
 * Load all skills from the .claude/skills directory
 */
export async function loadAllSkills(baseDir: string = process.cwd()): Promise<Skill[]> {
  const skillsDir = path.join(baseDir, '.claude', 'skills');

  try {
    // Check if skills directory exists
    await fs.access(skillsDir);
  } catch {
    logger.warn('No .claude/skills directory found', { skillsDir });
    return [];
  }

  const skills: Skill[] = [];

  try {
    // Read all subdirectories in skills/
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');

        try {
          await fs.access(skillPath);
          const skill = await loadSkill(skillPath);
          if (skill) {
            skills.push(skill);
            logger.info('Loaded skill', {
              name: skill.metadata.name,
              path: skillPath,
            });
          }
        } catch {
          // No SKILL.md in this directory, skip
          logger.debug('No SKILL.md found in directory', {
            directory: entry.name,
          });
        }
      }
    }

    logger.info('Finished loading skills', { count: skills.length });
    return skills;
  } catch (error: any) {
    logger.error('Failed to load skills', {
      error: error.message,
      skillsDir,
    });
    return [];
  }
}

/**
 * Format skills for injection into system prompt
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) {
    return '';
  }

  const skillSections = skills.map((skill) => {
    return `
## Skill: ${skill.metadata.name}

${skill.metadata.description}

${skill.content}
`;
  });

  return `
# Available Skills

You have access to the following specialized skills. These are strategy guides that teach you HOW to accomplish complex tasks using the atomic tools available.

${skillSections.join('\n---\n')}

When a task matches one of these skills, follow the strategy outlined in the skill documentation.
`;
}
