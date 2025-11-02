import dotenv from 'dotenv';
import fs from 'fs';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultLogsDir = path.join(__dirname, '..', 'logs');

const resolvedLogPath = process.env.LOG_PATH
  ? path.resolve(process.env.LOG_PATH)
  : path.join(defaultLogsDir, 'agent.log');

const logDirectory = path.dirname(resolvedLogPath);

const resolvedDiaryPath = process.env.DIARY_PATH
  ? path.resolve(process.env.DIARY_PATH)
  : path.join(logDirectory, 'diary.md');

const resolvedErrorPath = process.env.ERROR_LOG_PATH
  ? path.resolve(process.env.ERROR_LOG_PATH)
  : path.join(logDirectory, 'error.log');

fs.mkdirSync(logDirectory, { recursive: true });
fs.mkdirSync(path.dirname(resolvedDiaryPath), { recursive: true });
fs.mkdirSync(path.dirname(resolvedErrorPath), { recursive: true });

const MESSAGE = Symbol.for('message');

const yamlString = (value: string, indent: number) => {
  if (value.includes('\n')) {
    const indented = value
      .split('\n')
      .map((line) => `${' '.repeat(indent + 2)}${line}`)
      .join('\n');
    return `|\n${indented}`;
  }
  if (value === '' || /[:{}\[\],&*#?|\-<>=!%@`]/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
};

const toYaml = (value: any, indent = 0): string => {
  const indentStr = ' '.repeat(indent);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    return yamlString(value, indent);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        const yamlItem = toYaml(item, indent + 2);
        if (yamlItem.startsWith('|\n')) {
          return `${indentStr}- ${yamlItem}`;
        }
        if (yamlItem.includes('\n')) {
          const lines = yamlItem.split('\n');
          const first = `${indentStr}- ${lines[0]}`;
          const rest = lines
            .slice(1)
            .map((line) => `${indentStr}  ${line}`)
            .join('\n');
          return rest ? `${first}\n${rest}` : first;
        }
        return `${indentStr}- ${yamlItem}`;
      })
      .join('\n');
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, val]) => val !== undefined);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, val]) => {
        const yamlVal = toYaml(val, indent + 2);
        if (yamlVal.startsWith('|\n')) {
          return `${indentStr}${key}: ${yamlVal}`;
        }
        if (yamlVal.includes('\n')) {
          const lines = yamlVal.split('\n');
          const first = `${indentStr}${key}: ${lines[0]}`;
          const rest = lines
            .slice(1)
            .map((line) => `${indentStr}  ${line}`)
            .join('\n');
          return rest ? `${first}\n${rest}` : first;
        }
        return `${indentStr}${key}: ${yamlVal}`;
      })
      .join('\n');
  }
  return String(value);
};

const yamlFormatter = winston.format((info) => {
  const { timestamp, level, message, ...meta } = info;
  const payload: Record<string, unknown> = {
    timestamp,
    level,
    message,
  };
  if (meta.stack) {
    payload.stack = meta.stack;
    delete meta.stack;
  }
  const cleanedMeta = Object.keys(meta).length > 0 ? meta : undefined;
  if (cleanedMeta) {
    payload.meta = cleanedMeta;
  }
  info[MESSAGE] = `---\n${toYaml(payload)}\n`;
  return info;
});

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  yamlFormatter()
);

// Custom format for console output (colored and readable)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      const metadataStr = JSON.stringify(metadata, null, 2);
      msg += `\n${metadataStr}`;
    }

    return msg;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  transports: [
    // Console transport with colorized output
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info',
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: resolvedLogPath,
      level: process.env.LOG_LEVEL || 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Separate file for errors
    new winston.transports.File({
      filename: resolvedErrorPath,
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

logger.debug('Logger initialized', { level: logger.level });

// Add performance timing utility
export const startTimer = (label: string) => {
  const start = Date.now();
  return {
    end: () => {
      const duration = Date.now() - start;
      logger.debug(`${label} completed`, { duration: `${duration}ms` });
      return duration;
    },
  };
};

// Add context-aware logging helpers
export const logChat = (username: string, message: string) => {
  logger.info('Chat message received', { username, message });
};

export const logPosition = (x: number, y: number, z: number, context?: string) => {
  logger.debug('Position update', { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z), context });
};

export const logInventory = (items: { name: string; count: number }[]) => {
  logger.debug('Inventory state', { itemCount: items.length, items });
};

export const logHealth = (health: number, food: number) => {
  logger.debug('Health update', { health, food });
};

export const logToolExecution = (toolName: string, params: any, result?: any, error?: any) => {
  if (error) {
    logger.error(`Tool execution failed: ${toolName}`, { params, error: error.message || error });
  } else {
    logger.info(`Tool executed: ${toolName}`, { params, result });
  }
};

export const logClaudeCall = (promptLength: number, responseLength?: number, duration?: number) => {
  logger.info('Claude API call', { promptLength, responseLength, duration: duration ? `${duration}ms` : undefined });
};

const ensureDiary = () => {
  if (!fs.existsSync(resolvedDiaryPath)) {
    fs.writeFileSync(resolvedDiaryPath, '# Agent Diary\n\n', 'utf8');
  }
};

export const appendDiaryEntry = (
  summary: string,
  details?: string | string[] | Record<string, unknown>
): void => {
  ensureDiary();
  const timestamp = new Date().toISOString();
  const lines: string[] = [`## ${timestamp}`, `- ${summary}`];

  if (Array.isArray(details) && details.length > 0) {
    details.forEach((line) => lines.push(`  - ${line}`));
  } else if (typeof details === 'string' && details.trim().length > 0) {
    lines.push('', details.trim());
  } else if (details && typeof details === 'object') {
    lines.push('', '```yaml', toYaml(details), '```');
  }

  lines.push('');
  fs.appendFileSync(resolvedDiaryPath, lines.join('\n'), 'utf8');
};

export default logger;
