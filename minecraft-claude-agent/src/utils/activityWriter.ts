import WebSocket from 'ws';

export type ActivityRole = 'bot' | 'player' | 'system' | 'tool';

export interface ActivityItem {
  timestamp: string;
  type: 'chat' | 'tool' | 'thinking' | 'skill' | 'error' | 'warn' | 'info';
  message: string;
  speaker?: string;
  role?: ActivityRole;
  details?: any;
}

const MAX_ACTIVITIES = 200; // Keep last 200 activities in memory for getActivities()

export class ActivityWriter {
  private activityLog: ActivityItem[] = [];
  private botName: string;
  private ws: WebSocket | null = null;
  private wsUrl: string | null = null;

  constructor(botName: string) {
    this.botName = botName;

    // Core realtime WebSocket streaming to the dashboard server (always on)
    try {
      const port = Number(process.env.DASHBOARD_PORT || 4242);
      this.wsUrl = `ws://localhost:${port}/ingest`;
      this.connectWs();
    } catch {}
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

    // Try to push in realtime via WebSocket (best-effort)
    this.sendRealtime(activity);
  }

  public getActivities(): ActivityItem[] {
    return this.activityLog;
  }

  public destroy(): void {
    try { this.ws?.close(); } catch {}
  }

  private connectWs(): void {
    if (!this.wsUrl) return;
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => {/* ok */});
      this.ws.on('error', () => {/* ignore */});
      this.ws.on('close', () => { setTimeout(() => this.connectWs(), 1500); });
    } catch {}
  }

  private sendRealtime(activity: ActivityItem): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const payload = {
        type: 'activity',
        bot_id: this.botName,
        item: activity,
      };
      this.ws.send(JSON.stringify(payload));
    } catch {}
  }
}
