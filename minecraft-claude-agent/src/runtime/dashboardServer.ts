import express, { Express } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mcAssets from 'minecraft-assets';
import {
  loadConfig,
  getBotStatus,
  getAllStatuses,
  BotStatus,
} from './botControl.js';
import { registerMasRoutes } from '../mas/apiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MINECRAFT_VERSION = process.env.MINECRAFT_VERSION || '1.20';
const assets: any = mcAssets(MINECRAFT_VERSION);

export function createDashboardApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/bots', (_req, res) => {
    try {
      res.json(getAllStatuses());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/bots/:name', (req, res) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === req.params.name);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      const status: BotStatus = getBotStatus(bot);
      return res.json(status);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/logs/:botName', (req, res) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === req.params.botName);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      const logPath = path.resolve(bot.logs_dir, `${bot.name}.log`);
      if (!fs.existsSync(logPath)) {
        return res.status(404).send('Log file not found');
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.sendFile(logPath);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/diary/:botName', (req, res) => {
    try {
      const bots = loadConfig();
      const bot = bots.find((b) => b.name === req.params.botName);
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      const diaryPath = path.resolve(bot.logs_dir, 'diary.md');
      if (!fs.existsSync(diaryPath)) {
        return res.status(404).send('Diary file not found');
      }

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.sendFile(diaryPath);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/texture/:itemName', (req, res) => {
    try {
      const itemName = req.params.itemName;
      const item = assets.itemsByName[itemName];

      if (item?.textures?.length) {
        const texturePath = path.resolve(assets.texturePath, item.textures[0]);
        if (fs.existsSync(texturePath)) {
          res.setHeader('Content-Type', 'image/png');
          return res.sendFile(texturePath);
        }
      }

      const block = assets.blocksByName[itemName];
      if (block?.textures?.length) {
        const texturePath = path.resolve(assets.texturePath, block.textures[0]);
        if (fs.existsSync(texturePath)) {
          res.setHeader('Content-Type', 'image/png');
          return res.sendFile(texturePath);
        }
      }

      return res.status(404).json({ error: 'Texture not found' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Serve dashboard HTML
  app.get('/', (_req, res) => {
    const dashboardPath = path.resolve(__dirname, 'dashboard.html');
    res.sendFile(dashboardPath);
  });

  // Register MAS API endpoints
  registerMasRoutes(app);

  return app;
}

export function startDashboardServer(port: number) {
  const app = createDashboardApp();
  app.listen(port, () => {
    console.log(`Minecraft Colony dashboard listening on http://localhost:${port}`);
  });
}
