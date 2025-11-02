import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, devices } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

const VIEWER_URL = process.env.VIEWER_URL || 'http://localhost:3000';
const SCREENSHOT_BASENAME = process.env.VIEWER_SCREENSHOT_BASENAME || 'viewer';
const OUTPUT_DIR =
  process.env.VIEWER_SCREENSHOT_DIR || path.join(LOGS_DIR, 'screenshots');

const VIEWPORT_WIDTH = parseInt(process.env.VIEWER_SCREENSHOT_WIDTH || '1280', 10);
const VIEWPORT_HEIGHT = parseInt(process.env.VIEWER_SCREENSHOT_HEIGHT || '720', 10);

const WAIT_SELECTOR = process.env.VIEWER_WAIT_SELECTOR || '#viewerCanvas';
const WAIT_TIMEOUT = parseInt(process.env.VIEWER_WAIT_TIMEOUT || '15000', 10);

const timestamp = () => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({
    headless: process.env.VIEWER_SCREENSHOT_HEADLESS !== 'false',
  });

  try {
    const context = await browser.newContext({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      userAgent: devices['Desktop Chrome'].userAgent,
    });

    const page = await context.newPage();
    console.log(`Navigating to ${VIEWER_URL} ...`);
    const response = await page.goto(VIEWER_URL, {
      waitUntil: 'domcontentloaded',
      timeout: WAIT_TIMEOUT,
    });

    if (!response || !response.ok()) {
      throw new Error(
        `Failed to load viewer. Status: ${
          response ? response.status() : 'no response'
        }`
      );
    }

    if (WAIT_SELECTOR) {
      console.log(`Waiting for selector ${WAIT_SELECTOR}`);
      await page.waitForSelector(WAIT_SELECTOR, { timeout: WAIT_TIMEOUT });
    } else {
      await page.waitForTimeout(2000);
    }

    const filename = `${SCREENSHOT_BASENAME}-${timestamp()}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    await page.screenshot({
      path: outputPath,
      fullPage: true,
    });

    console.log(`Saved viewer screenshot → ${outputPath}`);

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to capture viewer screenshot:', error);
  process.exit(1);
});
