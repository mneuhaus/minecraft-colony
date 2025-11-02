import dotenv from 'dotenv';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
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

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');

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
      filename: path.join(logsDir, 'agent.log'),
      level: process.env.LOG_LEVEL || 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
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

export default logger;
