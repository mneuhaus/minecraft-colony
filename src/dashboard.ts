import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import mcAssets from 'minecraft-assets';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 8080;

app.use(cors());
app.use(express.json());

// Initialize minecraft assets (using 1.20 as default)
const MINECRAFT_VERSION = process.env.MINECRAFT_VERSION || '1.20';
const assets = mcAssets(MINECRAFT_VERSION);

interface BotConfig {
  name: string;
  username: string;
  logs_dir: string;
  viewer_port?: number | null;
}

interface BotStatus {
  name: string;
  username: string;
  running: boolean;
  position?: { x: number; y: number; z: number };
  health?: number;
  food?: number;
  gameMode?: string;
  inventory?: Array<{ name: string; count: number }>;
  viewerUrl?: string;
  lastUpdate?: string;
}

// Load bot configuration
function loadBotConfig(): BotConfig[] {
  const configPath = process.env.BOTS_CONFIG || 'bots.yaml';
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = yaml.parse(raw);
  return parsed.bots || [];
}

// Check if bot is running
function isBotRunning(bot: BotConfig): boolean {
  const pidPath = path.resolve(bot.logs_dir, 'pids', `${bot.name}.pid`);
  if (!fs.existsSync(pidPath)) return false;

  try {
    const pid = Number(fs.readFileSync(pidPath, 'utf-8'));
    if (!pid) return false;
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return false;
  }
}

// Parse latest bot status from log file
function getBotStatus(bot: BotConfig): BotStatus {
  const status: BotStatus = {
    name: bot.name,
    username: bot.username,
    running: isBotRunning(bot),
    viewerUrl: bot.viewer_port ? `http://localhost:${bot.viewer_port}` : undefined,
  };

  if (!status.running) {
    return status;
  }

  try {
    // Read from structured state file instead of parsing logs
    const stateFilePath = path.resolve(bot.logs_dir, `${bot.name}.state.json`);
    if (fs.existsSync(stateFilePath)) {
      const stateData = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
      status.position = stateData.position;
      status.health = stateData.health;
      status.food = stateData.food;
      status.gameMode = stateData.gameMode;
      status.inventory = stateData.inventory || [];
      status.lastUpdate = stateData.lastUpdate;
    }
  } catch (error) {
    console.error(`Error reading status for ${bot.name}:`, error);
  }

  return status;
}

// API: Get all bot statuses
app.get('/api/bots', (_req, res) => {
  try {
    const bots = loadBotConfig();
    const statuses = bots.map(getBotStatus);
    res.json(statuses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get specific bot status
app.get('/api/bots/:name', (req, res) => {
  try {
    const bots = loadBotConfig();
    const bot = bots.find((b) => b.name === req.params.name);
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    const status = getBotStatus(bot);
    return res.json(status);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Serve bot log file
app.get('/api/logs/:botName', (req, res) => {
  try {
    const bots = loadBotConfig();
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

// API: Serve bot diary file
app.get('/api/diary/:botName', (req, res) => {
  try {
    const bots = loadBotConfig();
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

// API: Get item/block texture
app.get('/api/texture/:itemName', (req, res) => {
  try {
    const itemName = req.params.itemName;

    // Get texture content from minecraft-assets
    if (assets.textureContent && assets.textureContent[itemName]) {
      const textureData = assets.textureContent[itemName];

      // textureData.texture is a data URL like "data:image/png;base64,..."
      // Extract the base64 part and decode it
      const dataUrl = textureData.texture;
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      return res.send(buffer);
    } else {
      // Fallback: return 404
      return res.status(404).json({ error: 'Texture not found' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Serve static dashboard HTML
app.get('/', (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minecraft Bot Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .inventory-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .inventory-scrollbar::-webkit-scrollbar-track {
      background: #1e293b;
    }
    .inventory-scrollbar::-webkit-scrollbar-thumb {
      background: #475569;
      border-radius: 3px;
    }
  </style>
</head>
<body class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen">
  <div class="container mx-auto px-4 py-8">
    <div class="text-center mb-12">
      <h1 class="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mb-2">
        🤖 Minecraft Bot Dashboard
      </h1>
      <p class="text-slate-400">Real-time monitoring of Claude-powered Minecraft bots</p>
    </div>

    <div id="dashboard" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"></div>
  </div>

  <script>
    async function fetchBots() {
      try {
        const response = await fetch('/api/bots');
        const bots = await response.json();
        renderDashboard(bots);
      } catch (error) {
        console.error('Error fetching bots:', error);
      }
    }

    function openViewer(url) {
      window.open(url, '_blank', 'width=1200,height=800');
    }

    function renderDashboard(bots) {
      const dashboard = document.getElementById('dashboard');
      dashboard.innerHTML = bots.map(bot => {
        const isRunning = bot.running;
        const skinUrl = \`https://mc-heads.net/avatar/\${bot.username}/64\`;
        const bodySkinUrl = \`https://mc-heads.net/body/\${bot.username}/100\`;

        return \`
          <div class="bg-slate-800/50 backdrop-blur rounded-2xl overflow-hidden shadow-2xl border-2 \${isRunning ? 'border-green-500/50' : 'border-red-500/30'} transition-all hover:scale-105">
            <div class="bg-gradient-to-r \${isRunning ? 'from-green-600 to-emerald-600' : 'from-red-600 to-rose-600'} p-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <img src="\${skinUrl}" alt="\${bot.username}" class="w-12 h-12 rounded-lg border-2 border-white/30 shadow-lg pixelated" style="image-rendering: pixelated;">
                  <div>
                    <h2 class="text-2xl font-bold text-white">\${bot.name}</h2>
                    <p class="text-sm text-white/80">\${bot.username}</p>
                  </div>
                </div>
                <span class="px-4 py-2 rounded-full text-sm font-semibold \${isRunning ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}">
                  \${isRunning ? '● ONLINE' : '○ OFFLINE'}
                </span>
              </div>
            </div>

            <div class="p-6">
              \${isRunning ? \`
                <div class="flex items-center justify-center mb-6">
                  <img src="\${bodySkinUrl}" alt="\${bot.username}" class="pixelated" style="image-rendering: pixelated;">
                </div>

                <div class="space-y-3 mb-6">
                  <div class="flex justify-between items-center bg-slate-700/50 rounded-lg px-4 py-3">
                    <span class="text-slate-400 font-medium">📍 Position</span>
                    <span class="text-white font-mono">\${bot.position ? \`(\${bot.position.x}, \${bot.position.y}, \${bot.position.z})\` : 'N/A'}</span>
                  </div>
                  <div class="flex justify-between items-center bg-slate-700/50 rounded-lg px-4 py-3">
                    <span class="text-slate-400 font-medium">❤️ Health</span>
                    <span class="text-red-400 font-bold">\${bot.health ?? 'N/A'}/20</span>
                  </div>
                  <div class="flex justify-between items-center bg-slate-700/50 rounded-lg px-4 py-3">
                    <span class="text-slate-400 font-medium">🍖 Food</span>
                    <span class="text-orange-400 font-bold">\${bot.food ?? 'N/A'}/20</span>
                  </div>
                  <div class="flex justify-between items-center bg-slate-700/50 rounded-lg px-4 py-3">
                    <span class="text-slate-400 font-medium">🎮 Mode</span>
                    <span class="text-purple-400 font-bold capitalize">\${bot.gameMode || 'N/A'}</span>
                  </div>
                </div>

                <div class="bg-slate-700/30 rounded-lg p-4 mb-4">
                  <h3 class="text-green-400 font-bold mb-3 flex items-center">
                    <span class="mr-2">🎒</span> Inventory (\${bot.inventory?.length || 0} items)
                  </h3>
                  \${bot.inventory && bot.inventory.length > 0 ? \`
                    <div class="grid grid-cols-9 gap-1">
                      \${bot.inventory.map(item => \`
                        <div class="relative bg-[#8B8B8B] border-2 border-t-[#FFFFFF] border-l-[#FFFFFF] border-b-[#373737] border-r-[#373737] aspect-square flex items-center justify-center hover:brightness-110 transition-all group">
                          <img
                            src="/api/texture/\${item.name}"
                            alt="\${item.name}"
                            class="w-8 h-8 pixelated"
                            style="image-rendering: pixelated;"
                            onerror="this.style.display='none'"
                          />
                          <span class="absolute bottom-0.5 right-1 text-white text-xs font-bold drop-shadow-[0_1px_0_rgba(0,0,0,1)]">\${item.count}</span>
                          <div class="absolute invisible group-hover:visible bg-slate-900/95 text-white text-xs px-2 py-1 rounded -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 border border-slate-700">
                            \${item.name.replace(/_/g, ' ')}
                          </div>
                        </div>
                      \`).join('')}
                    </div>
                  \` : \`
                    <div class="text-center py-8 text-slate-500">
                      <div class="text-4xl mb-2">📭</div>
                      <div class="text-sm">Empty inventory</div>
                    </div>
                  \`}
                </div>

                <div class="grid grid-cols-3 gap-2">
                  \${bot.viewerUrl ? \`
                    <button onclick="openViewer('\${bot.viewerUrl}')" class="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex flex-col items-center justify-center space-y-1 shadow-lg">
                      <span class="text-2xl">🎥</span>
                      <span class="text-xs">POV Viewer</span>
                    </button>
                  \` : '<div></div>'}
                  <button onclick="window.open('/api/logs/\${bot.name}', '_blank')" class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex flex-col items-center justify-center space-y-1 shadow-lg">
                    <span class="text-2xl">📋</span>
                    <span class="text-xs">View Log</span>
                  </button>
                  <button onclick="window.open('/api/diary/\${bot.name}', '_blank')" class="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex flex-col items-center justify-center space-y-1 shadow-lg">
                    <span class="text-2xl">📔</span>
                    <span class="text-xs">View Diary</span>
                  </button>
                </div>
              \` : \`
                <div class="text-center py-12">
                  <div class="text-6xl mb-4">😴</div>
                  <p class="text-slate-400 text-lg">Bot is offline</p>
                </div>
              \`}
            </div>
          </div>
        \`;
      }).join('');
    }

    // Fetch bots every 2 seconds
    fetchBots();
    setInterval(fetchBots, 2000);
  </script>
</body>
</html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Bot Dashboard running at http://localhost:${PORT}`);
  console.log(`   View all bots: http://localhost:${PORT}`);
  console.log(`   API endpoint: http://localhost:${PORT}/api/bots\n`);
});
