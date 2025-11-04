import fs from 'fs';
import path from 'path';

export type ActivityRole = 'bot' | 'player' | 'system' | 'tool';

export interface ActivityItem {
  timestamp: string;
  type: 'chat' | 'tool' | 'thinking' | 'skill' | 'error' | 'warn' | 'info';
  message: string;
  speaker?: string;
  role?: ActivityRole;
  details?: any;
}

const ACTIVITY_DIR = process.env.ACTIVITY_DIR || 'logs';
const MAX_ACTIVITIES = 200; // Keep last 200 activities

export class ActivityWriter {
  private activityLog: ActivityItem[] = [];
  private botName: string;
  private activityFilePath: string;
  private writeInterval: NodeJS.Timeout | null = null;

  constructor(botName: string) {
    this.botName = botName;
    this.activityFilePath = path.resolve(ACTIVITY_DIR, `${botName}.activity.json`);

    // Load existing activity if available
    this.loadActivity();

    // Write activity every 2 seconds
    this.writeInterval = setInterval(() => {
      this.writeActivity();
    }, 2000);
  }

  private loadActivity(): void {
    try {
      if (fs.existsSync(this.activityFilePath)) {
        const data = fs.readFileSync(this.activityFilePath, 'utf-8');
        this.activityLog = JSON.parse(data);
      }
    } catch (error) {
      console.error(`Failed to load activity for ${this.botName}:`, error);
      this.activityLog = [];
    }
  }

  private writeActivity(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.activityFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const payload = JSON.stringify(this.activityLog, null, 2);
      const tempPath = `${this.activityFilePath}.tmp`;

      fs.writeFileSync(tempPath, payload);
      try {
        fs.renameSync(tempPath, this.activityFilePath);
      } catch (renameError) {
        // Fallback for filesystems that do not support atomic rename overwrite
        fs.writeFileSync(this.activityFilePath, payload);
        fs.rmSync(tempPath, { force: true });
      }
    } catch (error) {
      console.error(`Failed to write activity for ${this.botName}:`, error);
    }
  }

  public addActivity(item: Omit<ActivityItem, 'timestamp'>): void {
    const activity: ActivityItem = {
      timestamp: new Date().toISOString(),
      ...item,
    };

    this.activityLog.unshift(activity); // Add to beginning

    // Keep only last MAX_ACTIVITIES
    if (this.activityLog.length > MAX_ACTIVITIES) {
      this.activityLog = this.activityLog.slice(0, MAX_ACTIVITIES);
    }
  }

  public getActivities(): ActivityItem[] {
    return this.activityLog;
  }

  public destroy(): void {
    if (this.writeInterval) {
      clearInterval(this.writeInterval);
      this.writeInterval = null;
    }
    this.writeActivity(); // Final write
  }
}
