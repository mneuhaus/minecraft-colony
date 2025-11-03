import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

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
  private db: Database.Database;
  private botName: string;
  private pruneDays: number = 90; // Default: prune data older than 90 days
  
  constructor(
    botName: string,
    config?: {
      dbPath?: string;
      pruneDays?: number;
    }
  ) {
    this.botName = botName;
    this.pruneDays = config?.pruneDays || 90;
    const dbPath = config?.dbPath || path.resolve('logs', 'memories', `${botName}.db`);
    
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      // Create database with better-sqlite3
      this.db = new Database(dbPath);
      this.initializeDatabase();
      console.log(`[SqlMemoryStore] Database opened successfully for ${botName}`);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to initialize database: ${error.message}`);
      // Fallback to in-memory storage
      this.db = new Database(':memory:');
      this.initializeDatabase();
      console.warn(`[SqlMemoryStore] Using in-memory database for ${botName}`);
    }
  }

  private initializeDatabase(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Sessions table - tracks conversation sessions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        bot_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER DEFAULT NULL,
        is_active INTEGER DEFAULT 1
      );
    `);

    // Messages table - stores conversation messages
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        position_x REAL,
        position_y REAL,
        position_z REAL,
        health INTEGER,
        food INTEGER,
        inventory TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );
    `);

    // Indexes for fast lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);

    // Learned facts table - long-term knowledge with importance ranking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learned_facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_name TEXT NOT NULL,
        fact TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        context TEXT,
        importance INTEGER DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
        UNIQUE(bot_name, fact) ON CONFLICT REPLACE
      );
    `);

    // Activities table - tracks significant bot actions  
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT,
        position_x REAL,
        position_y REAL,
        position_z REAL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );
    `);

    // Accomplishments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accomplishments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        description TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        position_x REAL,
        position_y REAL,
        position_z REAL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );
    `);

    // Relationships table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_name TEXT NOT NULL,
        player_name TEXT NOT NULL,
        trust_level INTEGER DEFAULT 50 CHECK(trust_level BETWEEN 0 AND 100),
        last_interaction INTEGER NOT NULL,
        notes TEXT,
        UNIQUE(bot_name, player_name) ON CONFLICT REPLACE
      );
    `);

    // Preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_name TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(bot_name, key) ON CONFLICT REPLACE
      );
    `);

    // Indexes for efficient queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activities_session ON activities(session_id);
      CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
      CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
      CREATE INDEX IF NOT EXISTS idx_activities_position ON activities(position_x, position_y, position_z);
      CREATE INDEX IF NOT EXISTS idx_accomplishments_session ON accomplishments(session_id);
      CREATE INDEX IF NOT EXISTS idx_accomplishments_timestamp ON accomplishments(timestamp);
      CREATE INDEX IF NOT EXISTS idx_learned_facts_bot ON learned_facts(bot_name);
      CREATE INDEX IF NOT EXISTS idx_learned_facts_importance ON learned_facts(importance);
      CREATE INDEX IF NOT EXISTS idx_relationships_bot ON relationships(bot_name);
      CREATE INDEX IF NOT EXISTS idx_preferences_bot ON preferences(bot_name);
    `);

    // Metadata table for cleanup tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  public createSession(sessionId: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (session_id, bot_name, start_time, is_active)
      VALUES (?, ?, ?, 1)
    `);
    
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      stmt.run(sessionId, this.botName, timestamp);
      console.log(`[SqlMemoryStore] Created session ${sessionId} for ${this.botName}`);
      
      // Mark other sessions as inactive
      this.db.prepare(`
        UPDATE sessions 
        SET is_active = 0 
        WHERE bot_name = ? AND session_id != ?
      `).run(this.botName, sessionId);
      
      // Clean up old sessions periodically
      if (Math.random() < 0.1) { // 10% chance to prune on session creation
        this.pruneOldData();
      }
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to create session: ${error.message}`);
    }
  }

  public endSession(sessionId: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET end_time = ?, is_active = 0 
      WHERE session_id = ?
    `);
    
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      stmt.run(timestamp, sessionId);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to end session: ${error.message}`);
    }
  }

  public addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string, context?: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        session_id, role, content, timestamp,
        position_x, position_y, position_z,
        health, food, inventory
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      stmt.run(
        sessionId,
        role,
        content,
        timestamp,
        context?.position?.x || null,
        context?.position?.y || null,
        context?.position?.z || null,
        context?.health || null,
        context?.food || null,
        context?.inventory ? JSON.stringify(context.inventory) : null
      );
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to add message: ${error.message}`);
    }
  }

  public addActivity(sessionId: string, type: string, description: string, data?: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO activities (
        session_id, type, description, timestamp, data,
        position_x, position_y, position_z
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const position = data?.position;
      stmt.run(
        sessionId,
        type,
        description,
        timestamp,
        data ? JSON.stringify(data) : null,
        position?.x || null,
        position?.y || null,
        position?.z || null
      );
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to add activity: ${error.message}`);
    }
  }

  public addAccomplishment(sessionId: string, description: string, location?: { x: number; y: number; z: number }): void {
    const stmt = this.db.prepare(`
      INSERT INTO accomplishments (
        session_id, description, timestamp,
        position_x, position_y, position_z
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      stmt.run(
        sessionId,
        description,
        timestamp,
        location?.x || null,
        location?.y || null,
        location?.z || null
      );
      console.log(`[SqlMemoryStore] Added accomplishment: ${description}`);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to add accomplishment: ${error.message}`);
    }
  }

  public learnFact(fact: string, context?: string, importance: number = 5): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO learned_facts (
        bot_name, fact, timestamp, context, importance
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      stmt.run(this.botName, fact, timestamp, context || null, importance);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to learn fact: ${error.message}`);
    }
  }

  public updateRelationship(playerName: string, trustDelta: number, note?: string): void {
    const timestamp = Math.floor(Date.now() / 1000);
    
    // First, get or create the relationship
    const existing = this.db.prepare(`
      SELECT trust_level, notes FROM relationships 
      WHERE bot_name = ? AND player_name = ?
    `).get(this.botName, playerName) as any;
    
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
      // Keep only last 10 notes
      if (notes.length > 10) {
        notes = notes.slice(-10);
      }
    }
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO relationships (
        bot_name, player_name, trust_level, last_interaction, notes
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(
        this.botName,
        playerName,
        newTrustLevel,
        timestamp,
        JSON.stringify(notes)
      );
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to update relationship: ${error.message}`);
    }
  }

  public setPreference(key: string, value: any): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO preferences (bot_name, key, value)
      VALUES (?, ?, ?)
    `);
    
    try {
      stmt.run(this.botName, key, JSON.stringify(value));
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to set preference: ${error.message}`);
    }
  }

  public getPreference(key: string): any {
    const result = this.db.prepare(`
      SELECT value FROM preferences 
      WHERE bot_name = ? AND key = ?
    `).get(this.botName, key) as any;
    
    if (result) {
      try {
        return JSON.parse(result.value);
      } catch {
        return result.value;
      }
    }
    return null;
  }

  public getContextualPrompt(sessionId: string): string {
    let prompt = '';
    
    // Add bot personality and backstory
    prompt += `You are ${this.botName}, an autonomous Minecraft bot. `;
    
    // Get bot creation date
    const firstSession = this.db.prepare(`
      SELECT MIN(start_time) as created_at FROM sessions 
      WHERE bot_name = ?
    `).get(this.botName) as any;
    
    if (firstSession?.created_at) {
      const createdDate = new Date(firstSession.created_at * 1000);
      prompt += `You have existed since ${createdDate.toLocaleDateString()}. `;
    }
    
    // Add recent accomplishments (last 5)
    const accomplishments = this.db.prepare(`
      SELECT a.description, a.timestamp, a.position_x, a.position_y, a.position_z
      FROM accomplishments a
      JOIN sessions s ON a.session_id = s.session_id
      WHERE s.bot_name = ?
      ORDER BY a.timestamp DESC
      LIMIT 5
    `).all(this.botName) as any[];
    
    if (accomplishments.length > 0) {
      prompt += `\nRecent accomplishments:\n`;
      accomplishments.forEach((acc: any) => {
        const date = new Date(acc.timestamp * 1000);
        prompt += `- ${acc.description} (${date.toLocaleDateString()})\n`;
      });
      prompt += '\n';
    }
    
    // Add important learned facts (top 10 by importance)
    const facts = this.db.prepare(`
      SELECT fact, context, importance FROM learned_facts
      WHERE bot_name = ?
      ORDER BY importance DESC, timestamp DESC
      LIMIT 10
    `).all(this.botName) as any[];
    
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
    const relationships = this.db.prepare(`
      SELECT player_name, trust_level, notes FROM relationships
      WHERE bot_name = ?
      ORDER BY last_interaction DESC
      LIMIT 10
    `).all(this.botName) as any[];
    
    if (relationships.length > 0) {
      prompt += `Your relationships:\n`;
      relationships.forEach((rel: any) => {
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
    
    // Add recent conversation history (last 20 messages from current session)
    const messages = this.db.prepare(`
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
    const result = this.db.prepare(`
      SELECT session_id FROM sessions 
      WHERE bot_name = ? AND is_active = 1
      ORDER BY start_time DESC
      LIMIT 1
    `).get(this.botName) as any;
    
    return result?.session_id;
  }

  public getFullConversationHistory(): ConversationMessage[] {
    const messages = this.db.prepare(`
      SELECT role, content, timestamp, 
             position_x, position_y, position_z,
             health, food, inventory
      FROM messages m
      JOIN sessions s ON m.session_id = s.session_id
      WHERE s.bot_name = ?
      ORDER BY m.timestamp ASC
    `).all(this.botName) as any[];
    
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
    const sessions = this.db.prepare(`
      SELECT session_id, bot_name, start_time, end_time
      FROM sessions
      WHERE bot_name = ?
      ORDER BY start_time DESC
      LIMIT ?
    `).all(this.botName, limit) as SessionRecord[];
    
    return sessions;
  }

  private pruneOldData(): void {
    const cutoffTime = Math.floor(Date.now() / 1000) - (this.pruneDays * 24 * 60 * 60);
    
    try {
      // Start transaction for consistency
      const deleteOldSessions = this.db.prepare(`
        DELETE FROM sessions 
        WHERE bot_name = ? AND start_time < ? AND is_active = 0
      `);
      
      const deleteOldFacts = this.db.prepare(`
        DELETE FROM learned_facts 
        WHERE bot_name = ? AND timestamp < ? AND importance < 7
      `);
      
      const transaction = this.db.transaction(() => {
        const sessionsDeleted = deleteOldSessions.run(this.botName, cutoffTime);
        const factsDeleted = deleteOldFacts.run(this.botName, cutoffTime);
        
        // Update metadata
        this.db.prepare(`
          INSERT OR REPLACE INTO metadata (key, value, updated_at)
          VALUES ('last_prune', ?, ?)
        `).run(new Date().toISOString(), Math.floor(Date.now() / 1000));
        
        console.log(`[SqlMemoryStore] Pruned ${sessionsDeleted.changes} old sessions and ${factsDeleted.changes} low-importance facts`);
      });
      
      transaction();
      
      // VACUUM to reclaim space (run occasionally)
      if (Math.random() < 0.1) { // 10% chance
        this.db.exec('VACUUM');
      }
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to prune old data: ${error.message}`);
    }
  }

  public close(): void {
    try {
      this.db.close();
      console.log(`[SqlMemoryStore] Database closed for ${this.botName}`);
    } catch (error: any) {
      console.error(`[SqlMemoryStore] Failed to close database: ${error.message}`);
    }
  }

  // Migration helper - import from JSON
  public importFromJson(jsonMemory: any): void {
    console.log(`[SqlMemoryStore] Starting import from JSON for ${this.botName}`);
    
    const transaction = this.db.transaction(() => {
      // Import sessions and their data
      for (const session of jsonMemory.sessions || []) {
        // Create session
        this.db.prepare(`
          INSERT OR IGNORE INTO sessions (session_id, bot_name, start_time, end_time, is_active)
          VALUES (?, ?, ?, ?, 0)
        `).run(
          session.sessionId,
          this.botName,
          Math.floor(new Date(session.startTime).getTime() / 1000),
          session.endTime ? Math.floor(new Date(session.endTime).getTime() / 1000) : null
        );
        
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
          const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO activities (session_id, type, description, timestamp, data)
            VALUES (?, ?, ?, ?, ?)
          `);
          stmt.run(
            session.sessionId,
            activity.type,
            activity.description,
            Math.floor(new Date(activity.timestamp).getTime() / 1000),
            activity.data ? JSON.stringify(activity.data) : null
          );
        }
        
        // Import accomplishments
        for (const acc of session.accomplishments || []) {
          const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO accomplishments (session_id, description, timestamp, position_x, position_y, position_z)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            session.sessionId,
            acc.description,
            Math.floor(new Date(acc.timestamp).getTime() / 1000),
            acc.location?.x || null,
            acc.location?.y || null,
            acc.location?.z || null
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
        this.db.prepare(`
          INSERT OR REPLACE INTO relationships (bot_name, player_name, trust_level, last_interaction, notes)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          this.botName,
          playerName,
          relationship.trustLevel,
          Math.floor(new Date(relationship.lastInteraction).getTime() / 1000),
          JSON.stringify(relationship.notes || [])
        );
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
}