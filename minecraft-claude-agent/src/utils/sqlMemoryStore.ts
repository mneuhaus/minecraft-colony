import { ColonyDatabase } from '../database/ColonyDatabase.js';

/**
 * SqlMemoryStore - Thin wrapper around ColonyDatabase for backward compatibility
 *
 * This class maintains the same interface as the old per-bot SQLite implementation
 * but delegates all operations to the shared ColonyDatabase.
 */

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context?: {
    position?: { x: number; y: number; z: number };
    health?: number;
    food?: number;
    inventory?: string;
  };
}

export interface LearnedFact {
  fact: string;
  timestamp: string;
  context?: string;
  importance: number; // 1-10 scale
}

export interface ActivityRecord {
  session_id: string;
  type: string;
  description: string;
  timestamp: string;
  data?: string;
  position_x?: number;
  position_y?: number;
  position_z?: number;
}

export interface SessionRecord {
  session_id: string;
  bot_name: string;
  start_time: number;
  end_time?: number;
}

export interface Accomplishment {
  session_id: string;
  description: string;
  timestamp: string;
  position_x?: number;
  position_y?: number;
  position_z?: number;
}

export interface Relationship {
  player_name: string;
  trust_level: number;
  last_interaction: string;
  notes: string[];
}

export class SqlMemoryStore {
  private colonyDb: ColonyDatabase;
  private botName: string;
  private botId: number;
  private pruneDays: number = 90;

  constructor(
    botName: string,
    config?: {
      dbPath?: string;
      pruneDays?: number;
    }
  ) {
    this.botName = botName;
    this.pruneDays = config?.pruneDays || 90;

    // Get shared ColonyDatabase instance
    this.colonyDb = ColonyDatabase.getInstance(config?.dbPath);

    // Register this bot and get its ID
    this.botId = this.colonyDb.registerBot(botName, {});
    console.log(`[SqlMemoryStore] Using shared database for ${botName} (ID: ${this.botId})`);
  }

  public createSession(sessionId: string): void {
    try {
      this.colonyDb.createSession(this.botId, sessionId);
      console.log(`[SqlMemoryStore] Created session ${sessionId} for ${this.botName}`);

      // Clean up old sessions periodically
      if (Math.random() < 0.1) {
        this.pruneOldData();
      }
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to create session: ${error.message}`);
    }
  }

  public endSession(sessionId: string): void {
    try {
      this.colonyDb.endSession(sessionId);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to end session: ${error.message}`);
    }
  }

  public addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    context?: any
  ): void {
    try {
      this.colonyDb.addMessage(sessionId, this.botId, role, content, context);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to add message: ${error.message}`);
    }
  }

  public addActivity(sessionId: string, type: string, description: string, data?: any): void {
    try {
      this.colonyDb.addActivity(sessionId, this.botId, type, description, data);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to add activity: ${error.message}`);
    }
  }

  public addAccomplishment(
    sessionId: string,
    description: string,
    location?: { x: number; y: number; z: number }
  ): void {
    try {
      this.colonyDb.addAccomplishment(sessionId, this.botId, description, location);
      console.log(`[SqlMemoryStore] Added accomplishment: ${description}`);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to add accomplishment: ${error.message}`);
    }
  }

  public learnFact(fact: string, context?: string, importance: number = 5): void {
    try {
      this.colonyDb.learnFact(this.botId, fact, context, importance);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to learn fact: ${error.message}`);
    }
  }

  public updateRelationship(playerName: string, trustDelta: number, note?: string): void {
    try {
      this.colonyDb.updateRelationship(this.botId, playerName, trustDelta, note);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to update relationship: ${error.message}`);
    }
  }

  public setPreference(key: string, value: any): void {
    try {
      this.colonyDb.setPreference(this.botId, key, value);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to set preference: ${error.message}`);
    }
  }

  public getPreference(key: string): any {
    return this.colonyDb.getPreference(this.botId, key);
  }

  public getContextualPrompt(sessionId: string): string {
    let prompt = '';

    // Add bot personality and backstory
    prompt += `You are ${this.botName}, an autonomous Minecraft bot. `;

    // Get bot creation date
    const db = this.colonyDb.getDb();
    const firstSession = db.prepare(`
      SELECT MIN(start_time) as created_at FROM sessions
      WHERE bot_id = ?
    `).get(this.botId) as any;

    if (firstSession?.created_at) {
      const createdDate = new Date(firstSession.created_at * 1000);
      prompt += `You have existed since ${createdDate.toLocaleDateString()}. `;
    }

    // Add recent accomplishments
    const accomplishments = this.colonyDb.getRecentAccomplishments(this.botId, 5);
    if (accomplishments.length > 0) {
      prompt += `\nRecent accomplishments:\n`;
      accomplishments.forEach((acc: any) => {
        const date = new Date(acc.timestamp * 1000);
        prompt += `- ${acc.description} (${date.toLocaleDateString()})\n`;
      });
      prompt += '\n';
    }

    // Add important learned facts
    const facts = this.colonyDb.getImportantFacts(this.botId, 10);
    if (facts.length > 0) {
      prompt += `Important facts you've learned:\n`;
      facts.forEach((fact: any) => {
        prompt += `- ${fact.fact}`;
        if (fact.context) prompt += ` (Context: ${fact.context})`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    // Add relationships
    const relationships = this.colonyDb.getRelationships(this.botId);
    if (relationships.length > 0) {
      prompt += `Your relationships:\n`;
      relationships.slice(0, 10).forEach((rel: any) => {
        const trust = rel.trust_level > 70 ? 'highly trust' :
                     rel.trust_level > 30 ? 'are neutral with' : 'are wary of';
        prompt += `- You ${trust} ${rel.player_name}`;

        // Add most recent note if available
        if (rel.notes) {
          try {
            const notes = JSON.parse(rel.notes);
            if (notes.length > 0) {
              const lastNote = notes[notes.length - 1];
              prompt += ` (${lastNote.split(': ')[1]})`;
            }
          } catch {}
        }
        prompt += '\n';
      });
      prompt += '\n';
    }

    // Add recent conversation history
    const db2 = this.colonyDb.getDb();
    const messages = db2.prepare(`
      SELECT role, content, timestamp FROM messages
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `).all(sessionId) as any[];

    if (messages.length > 0) {
      prompt += `Recent conversation in this session:\n`;
      messages.reverse().forEach((msg: any) => {
        const time = new Date(msg.timestamp * 1000).toLocaleTimeString();
        const role = msg.role === 'user' ? 'Player' :
                    msg.role === 'assistant' ? 'You' : 'System';
        prompt += `[${time}] ${role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    return prompt;
  }

  public getLastActiveSessionId(): string | undefined {
    return this.colonyDb.getActiveSession(this.botId) || undefined;
  }

  public getFullConversationHistory(): ConversationMessage[] {
    const db = this.colonyDb.getDb();
    const messages = db.prepare(`
      SELECT role, content, timestamp,
             position_x, position_y, position_z,
             health, food, inventory
      FROM messages
      WHERE bot_id = ?
      ORDER BY timestamp ASC
    `).all(this.botId) as any[];

    return messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp * 1000).toISOString(),
      context: (msg.position_x !== null || msg.health !== null) ? {
        position: msg.position_x !== null ? {
          x: msg.position_x,
          y: msg.position_y,
          z: msg.position_z
        } : undefined,
        health: msg.health || undefined,
        food: msg.food || undefined,
        inventory: msg.inventory ? JSON.parse(msg.inventory) : undefined
      } : undefined
    }));
  }

  public getRecentSessions(limit: number = 10): SessionRecord[] {
    const db = this.colonyDb.getDb();
    const sessions = db.prepare(`
      SELECT s.session_id, b.name as bot_name, s.start_time, s.end_time
      FROM sessions s
      JOIN bots b ON s.bot_id = b.id
      WHERE s.bot_id = ?
      ORDER BY s.start_time DESC
      LIMIT ?
    `).all(this.botId, limit) as SessionRecord[];

    return sessions;
  }

  private pruneOldData(): void {
    try {
      this.colonyDb.pruneOldData(this.botId, this.pruneDays);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to prune old data: ${error.message}`);
    }
  }

  public close(): void {
    // Don't close the shared database - it's managed by ColonyDatabase singleton
    console.log(`[SqlMemoryStore] Bot ${this.botName} disconnected from shared database`);
  }

  // Migration helper - import from JSON
  public importFromJson(jsonMemory: any): void {
    console.log(`[SqlMemoryStore] Starting import from JSON for ${this.botName}`);

    const db = this.colonyDb.getDb();
    const transaction = db.transaction(() => {
      // Import sessions and their data
      for (const session of jsonMemory.sessions || []) {
        // Create session
        this.colonyDb.createSession(this.botId, session.sessionId);

        // Import messages
        for (const msg of session.messages || []) {
          this.addMessage(
            session.sessionId,
            msg.role,
            msg.content,
            msg.context
          );
        }

        // Import activities
        for (const activity of session.activities || []) {
          this.addActivity(
            session.sessionId,
            activity.type,
            activity.description,
            activity.data
          );
        }

        // Import accomplishments
        for (const acc of session.accomplishments || []) {
          this.addAccomplishment(
            session.sessionId,
            acc.description,
            acc.location
          );
        }
      }

      // Import learned facts
      for (const fact of jsonMemory.learnedFacts || []) {
        this.learnFact(fact.fact, fact.context, 5);
      }

      // Import relationships
      for (const [playerName, rel] of Object.entries(jsonMemory.relationships || {})) {
        const relationship = rel as any;
        this.updateRelationship(playerName, relationship.trustLevel - 50, '');
      }

      // Import preferences
      for (const [key, value] of Object.entries(jsonMemory.preferences || {})) {
        this.setPreference(key, value);
      }
    });

    try {
      transaction();
      console.log(`[SqlMemoryStore] Successfully imported JSON data for ${this.botName}`);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to import JSON data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the bot ID for this store
   */
  public getBotId(): number {
    return this.botId;
  }

  /**
   * Get direct access to the shared ColonyDatabase
   */
  public getColonyDatabase(): ColonyDatabase {
    return this.colonyDb;
  }
}
