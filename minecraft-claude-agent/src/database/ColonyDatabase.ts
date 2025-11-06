import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { SCHEMA_SQL, SCHEMA_VERSION, BotStatus } from './schema.js';

/**
 * Shared colony-wide database that replaces per-bot SQLite files
 *
 * All bots read/write to this single database with bot_id for multi-tenancy.
 * Provides EventEmitter for realtime updates without WebSocket complexity.
 *
 * Now using Bun's built-in SQLite - no native compilation needed!
 */
export class ColonyDatabase extends EventEmitter {
  private db: Database;
  private dbPath: string;
  private static instance: ColonyDatabase | null = null;

  /**
   * Singleton pattern - ensures only one database connection exists
   */
  public static getInstance(dbPath?: string): ColonyDatabase {
    if (!ColonyDatabase.instance) {
      ColonyDatabase.instance = new ColonyDatabase(dbPath);
    }
    return ColonyDatabase.instance;
  }

  private constructor(customDbPath?: string) {
    super();

    this.dbPath = customDbPath || path.resolve('logs', 'colony.db');

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      this.db = new Database(this.dbPath);
      this.initialize();
      console.log(`[ColonyDatabase] Database opened at ${this.dbPath}`);
    } catch (error: any) {
      console.error(`[ColonyDatabase] Failed to initialize: ${error.message}`);
      // Fallback to in-memory for emergency situations
      this.db = new Database(':memory:');
      this.initialize();
      console.warn(`[ColonyDatabase] Using in-memory database (changes not persisted!)`);
    }
  }

  private initialize(): void {
    // Enable WAL mode for better concurrent access
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA foreign_keys = ON');

    // Create schema
    this.db.run(SCHEMA_SQL);

    // Store schema version
    const version = this.getMetadata('schema_version');
    if (!version) {
      this.setMetadata('schema_version', SCHEMA_VERSION.toString());
    }
  }

  // ============================================================================
  // Bot Management
  // ============================================================================

  public registerBot(name: string, config: any): number {
    const existing = this.db.prepare('SELECT id FROM bots WHERE name = ?').get(name) as any;

    if (existing) {
      // Update existing bot
      this.db.prepare(`
        UPDATE bots SET config = ?, updated_at = ? WHERE name = ?
      `).run(JSON.stringify(config), Math.floor(Date.now() / 1000), name);
      return existing.id;
    }

    // Insert new bot
    const result = this.db.prepare(`
      INSERT INTO bots (name, config, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(
      name,
      JSON.stringify(config),
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );

    const botId = result.lastInsertRowid as number;
    this.emit('bot:registered', { botId, name, config });
    return botId;
  }

  public getBotId(name: string): number | null {
    const result = this.db.prepare('SELECT id FROM bots WHERE name = ?').get(name) as any;
    return result?.id || null;
  }

  public getBotName(botId: number): string | null {
    const result = this.db.prepare('SELECT name FROM bots WHERE id = ?').get(botId) as any;
    return result?.name || null;
  }

  public getAllBots(): Array<{ id: number; name: string; config: any }> {
    const rows = this.db.prepare('SELECT id, name, config FROM bots').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      config: JSON.parse(row.config)
    }));
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  public createSession(botId: number, sessionId: string): void {
    this.db.prepare(`
      INSERT INTO sessions (session_id, bot_id, start_time, is_active)
      VALUES (?, ?, ?, 1)
    `).run(sessionId, botId, Math.floor(Date.now() / 1000));

    // Mark other sessions for this bot as inactive
    this.db.prepare(`
      UPDATE sessions SET is_active = 0
      WHERE bot_id = ? AND session_id != ?
    `).run(botId, sessionId);

    this.emit('session:created', { botId, sessionId });
  }

  public endSession(sessionId: string): void {
    this.db.prepare(`
      UPDATE sessions SET end_time = ?, is_active = 0
      WHERE session_id = ?
    `).run(Math.floor(Date.now() / 1000), sessionId);

    this.emit('session:ended', { sessionId });
  }

  public getActiveSession(botId: number): string | null {
    const result = this.db.prepare(`
      SELECT session_id FROM sessions
      WHERE bot_id = ? AND is_active = 1
      ORDER BY start_time DESC LIMIT 1
    `).get(botId) as any;

    return result?.session_id || null;
  }

  // ============================================================================
  // Messages
  // ============================================================================

  public addMessage(
    sessionId: string,
    botId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    context?: any
  ): void {
    this.db.prepare(`
      INSERT INTO messages (
        session_id, bot_id, role, content, timestamp,
        position_x, position_y, position_z, health, food, inventory
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      botId,
      role,
      content,
      Math.floor(Date.now() / 1000),
      context?.position?.x || null,
      context?.position?.y || null,
      context?.position?.z || null,
      context?.health || null,
      context?.food || null,
      context?.inventory ? JSON.stringify(context.inventory) : null
    );

    this.emit('message:added', { sessionId, botId, role, content });
  }

  public getRecentMessages(botId: number, limit: number = 20): any[] {
    return this.db.prepare(`
      SELECT role, content, timestamp, position_x, position_y, position_z, health, food
      FROM messages
      WHERE bot_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(botId, limit) as any[];
  }

  // ============================================================================
  // Activities
  // ============================================================================

  public addActivity(
    sessionId: string,
    botId: number,
    type: string,
    description: string,
    data?: any
  ): void {
    const position = data?.position;

    this.db.prepare(`
      INSERT INTO activities (
        session_id, bot_id, type, description, timestamp, data,
        position_x, position_y, position_z
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      botId,
      type,
      description,
      Math.floor(Date.now() / 1000),
      data ? JSON.stringify(data) : null,
      position?.x || null,
      position?.y || null,
      position?.z || null
    );

    this.emit('activity:added', { sessionId, botId, type, description, data });
  }

  public getRecentActivities(botId: number, limit: number = 100): any[] {
    return this.db.prepare(`
      SELECT id, session_id, type, description, timestamp, data,
             position_x, position_y, position_z
      FROM activities
      WHERE bot_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(botId, limit) as any[];
  }

  public getActivitiesSince(botId: number, timestamp: number): any[] {
    return this.db.prepare(`
      SELECT id, session_id, type, description, timestamp, data,
             position_x, position_y, position_z
      FROM activities
      WHERE bot_id = ? AND timestamp > ?
      ORDER BY timestamp ASC
    `).all(botId, timestamp) as any[];
  }

  // ============================================================================
  // Accomplishments
  // ============================================================================

  public addAccomplishment(
    sessionId: string,
    botId: number,
    description: string,
    location?: { x: number; y: number; z: number }
  ): void {
    this.db.prepare(`
      INSERT INTO accomplishments (
        session_id, bot_id, description, timestamp,
        position_x, position_y, position_z
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      botId,
      description,
      Math.floor(Date.now() / 1000),
      location?.x || null,
      location?.y || null,
      location?.z || null
    );

    this.emit('accomplishment:added', { sessionId, botId, description, location });
  }

  public getRecentAccomplishments(botId: number, limit: number = 10): any[] {
    return this.db.prepare(`
      SELECT description, timestamp, position_x, position_y, position_z
      FROM accomplishments
      WHERE bot_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(botId, limit) as any[];
  }

  // ============================================================================
  // Learned Facts
  // ============================================================================

  public learnFact(botId: number, fact: string, context?: string, importance: number = 5): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO learned_facts (bot_id, fact, timestamp, context, importance)
      VALUES (?, ?, ?, ?, ?)
    `).run(botId, fact, Math.floor(Date.now() / 1000), context || null, importance);

    this.emit('fact:learned', { botId, fact, importance });
  }

  public getImportantFacts(botId: number, limit: number = 10): any[] {
    return this.db.prepare(`
      SELECT fact, context, importance, timestamp
      FROM learned_facts
      WHERE bot_id = ?
      ORDER BY importance DESC, timestamp DESC
      LIMIT ?
    `).all(botId, limit) as any[];
  }

  // ============================================================================
  // Relationships
  // ============================================================================

  public updateRelationship(botId: number, playerName: string, trustDelta: number, note?: string): void {
    const existing = this.db.prepare(`
      SELECT trust_level, notes FROM relationships
      WHERE bot_id = ? AND player_name = ?
    `).get(botId, playerName) as any;

    let newTrustLevel = 50; // Default neutral
    let notes: string[] = [];

    if (existing) {
      newTrustLevel = Math.max(0, Math.min(100, existing.trust_level + trustDelta));
      try {
        notes = existing.notes ? JSON.parse(existing.notes) : [];
      } catch {
        notes = [];
      }
    } else {
      newTrustLevel = Math.max(0, Math.min(100, 50 + trustDelta));
    }

    if (note) {
      notes.push(`${new Date().toISOString()}: ${note}`);
      if (notes.length > 10) {
        notes = notes.slice(-10);
      }
    }

    this.db.prepare(`
      INSERT OR REPLACE INTO relationships (bot_id, player_name, trust_level, last_interaction, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(botId, playerName, newTrustLevel, Math.floor(Date.now() / 1000), JSON.stringify(notes));

    this.emit('relationship:updated', { botId, playerName, trustLevel: newTrustLevel });
  }

  public getRelationships(botId: number): any[] {
    return this.db.prepare(`
      SELECT player_name, trust_level, last_interaction, notes
      FROM relationships
      WHERE bot_id = ?
      ORDER BY last_interaction DESC
    `).all(botId) as any[];
  }

  // ============================================================================
  // Preferences
  // ============================================================================

  public setPreference(botId: number, key: string, value: any): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO preferences (bot_id, key, value)
      VALUES (?, ?, ?)
    `).run(botId, key, JSON.stringify(value));
  }

  public getPreference(botId: number, key: string): any {
    const result = this.db.prepare(`
      SELECT value FROM preferences WHERE bot_id = ? AND key = ?
    `).get(botId, key) as any;

    if (result) {
      try {
        return JSON.parse(result.value);
      } catch {
        return result.value;
      }
    }
    return null;
  }

  // ============================================================================
  // Bot Status (replaces duplicate code from botControl.ts)
  // ============================================================================

  public getBotStatus(botId: number): BotStatus | null {
    const bot = this.db.prepare('SELECT id, name FROM bots WHERE id = ?').get(botId) as any;
    if (!bot) return null;

    const status: BotStatus = {
      id: bot.id,
      name: bot.name,
      running: false, // Will be set by BotManager
      connected: false,
      connectionStatus: 'disconnected'
    };

    // Get latest message for position/health
    const lastMessage = this.db.prepare(`
      SELECT timestamp, position_x, position_y, position_z, health, food
      FROM messages
      WHERE bot_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(botId) as any;

    if (lastMessage) {
      status.timeSinceUpdate = Math.floor(Date.now() / 1000) - lastMessage.timestamp;

      if (lastMessage.position_x !== null) {
        status.position = {
          x: lastMessage.position_x,
          y: lastMessage.position_y,
          z: lastMessage.position_z
        };
      }

      status.health = lastMessage.health;
      status.food = lastMessage.food;

      // Derive connection status from time since update
      if (status.timeSinceUpdate < 10) {
        status.connectionStatus = 'connected';
        status.connected = true;
      } else if (status.timeSinceUpdate < 60) {
        status.connectionStatus = 'connecting';
      } else {
        status.connectionStatus = 'error';
      }
    }

    // Get latest activity
    const lastActivity = this.db.prepare(`
      SELECT type, description, timestamp
      FROM activities
      WHERE bot_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(botId) as any;

    if (lastActivity) {
      status.lastActivity = {
        type: lastActivity.type,
        description: lastActivity.description,
        timestamp: lastActivity.timestamp
      };
    }

    // Get active session
    status.sessionId = this.getActiveSession(botId) || undefined;

    return status;
  }

  // ============================================================================
  // Metadata
  // ============================================================================

  private setMetadata(key: string, value: string): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value, updated_at)
      VALUES (?, ?, ?)
    `).run(key, value, Math.floor(Date.now() / 1000));
  }

  private getMetadata(key: string): string | null {
    const result = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as any;
    return result?.value || null;
  }

  // ============================================================================
  // Cleanup & Maintenance
  // ============================================================================

  public pruneOldData(botId: number, pruneDays: number = 90): void {
    const cutoffTime = Math.floor(Date.now() / 1000) - (pruneDays * 24 * 60 * 60);

    const transaction = this.db.transaction(() => {
      // Delete old inactive sessions (cascades to messages/activities/accomplishments)
      const sessionsDeleted = this.db.prepare(`
        DELETE FROM sessions
        WHERE bot_id = ? AND start_time < ? AND is_active = 0
      `).run(botId, cutoffTime);

      // Delete low-importance old facts
      const factsDeleted = this.db.prepare(`
        DELETE FROM learned_facts
        WHERE bot_id = ? AND timestamp < ? AND importance < 7
      `).run(botId, cutoffTime);

      console.log(`[ColonyDatabase] Pruned ${sessionsDeleted.changes} sessions, ${factsDeleted.changes} facts for bot ${botId}`);
    });

    transaction();

    // Occasional VACUUM
    if (Math.random() < 0.1) {
      this.db.exec('VACUUM');
    }
  }

  // ============================================================================
  // Database Lifecycle
  // ============================================================================

  public close(): void {
    try {
      this.db.close();
      console.log('[ColonyDatabase] Database closed');
      ColonyDatabase.instance = null;
    } catch (error: any) {
      console.error(`[ColonyDatabase] Failed to close: ${error.message}`);
    }
  }

  public getDb(): Database.Database {
    return this.db;
  }
}
