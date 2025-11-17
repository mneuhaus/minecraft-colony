import dotenv from 'dotenv';
import logger from './logger.js';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  anthropic: {
    apiKey?: string;
    authToken?: string;
    baseUrl?: string;
    model?: string;
    smallFastModel?: string;
  };
  minecraft: {
    host: string;
    port: number;
    username: string;
  };
  botName?: string;
  logging: {
    level: string;
  };
}

/**
 * Validate and load configuration from environment variables
 */
function loadConfig(): Config {
  const missingVars: string[] = [];

  // Required: Either API key OR auth token
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const anthropicAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;

  if (!anthropicApiKey && !anthropicAuthToken) {
    missingVars.push('ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN');
  }

  if (missingVars.length > 0) {
    logger.error('Missing required environment variables', { missing: missingVars });
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please create a .env file based on .env.example'
    );
  }

  // Optional environment variables with defaults
  const mcHost = process.env.MC_HOST || 'localhost';
  const mcPort = parseInt(process.env.MC_PORT || '25565', 10);
  const mcUsername = process.env.MC_USERNAME || 'ClaudeBot';
  const logLevel = process.env.LOG_LEVEL || 'info';

  // Validate port number
  if (isNaN(mcPort) || mcPort < 1 || mcPort > 65535) {
    throw new Error(`Invalid MC_PORT: ${process.env.MC_PORT}. Must be a number between 1 and 65535.`);
  }

  const config: Config = {
    anthropic: {
      apiKey: anthropicApiKey,
      authToken: anthropicAuthToken,
      baseUrl: process.env.ANTHROPIC_BASE_URL,
      model: process.env.ANTHROPIC_MODEL,
      smallFastModel: process.env.ANTHROPIC_SMALL_FAST_MODEL,
    },
    minecraft: {
      host: mcHost,
      port: mcPort,
      username: mcUsername,
    },
    logging: {
      level: logLevel,
    },
  };

  logger.info('Configuration loaded', {
    anthropic: {
      authMethod: anthropicAuthToken ? 'OAuth Token' : 'API Key',
    },
    minecraft: {
      host: config.minecraft.host,
      port: config.minecraft.port,
      username: config.minecraft.username,
    },
    logging: {
      level: config.logging.level,
    },
  });

  return config;
}

export const config = loadConfig();
