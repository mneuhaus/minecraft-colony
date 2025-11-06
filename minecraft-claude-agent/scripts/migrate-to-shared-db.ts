#!/usr/bin/env tsx

/**
 * Migration script: Per-bot SQLite databases → Single shared colony.db
 *
 * Reads all existing logs/memories/{botName}.db files and merges them
 * into the new shared logs/colony.db database.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-to-shared-db.ts
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORIES_DIR = path.resolve(__dirname, '..', 'logs', 'memories');
const BACKUP_DIR = path.resolve(__dirname, '..', 'logs', 'memories.backup');
const COLONY_DB_PATH = path.resolve(__dirname, '..', 'logs', 'colony.db');

interface BotMapping {
  name: string;
  oldDbPath: string;
  newBotId: number;
}

function migrateBotDatabase(oldDbPath: string, botName: string, colonyDb: Database.Database): number {
  console.log(`\n[Migrate] Processing bot: ${botName}`);
  console.log(`[Migrate] Source: ${oldDbPath}`);

  // Open old database in readonly mode
  const oldDb = new Database(oldDbPath, { readonly: true });

  // Register bot in colony database
  const existingBot = colonyDb.prepare('SELECT id FROM bots WHERE name = ?').get(botName) as any;
  let botId: number;

  if (existingBot) {
    botId = existingBot.id;
    console.log(`[Migrate] Bot already exists with ID: ${botId}`);
  } else {
    const result = colonyDb.prepare(`
      INSERT INTO bots (name, config, created_at, updated_at)
      VALUES (?, '{}', ?, ?)
    `).run(botName, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000));
    botId = result.lastInsertRowid as number;
    console.log(`[Migrate] Created bot with ID: ${botId}`);
  }

  // Track counts
  let counts = {
    sessions: 0,
    messages: 0,
    activities: 0,
    accomplishments: 0,
    facts: 0,
    relationships: 0,
    preferences: 0
  };

  // Migrate sessions
  const sessions = oldDb.prepare('SELECT * FROM sessions WHERE bot_name = ?').all(botName) as any[];
  for (const session of sessions) {
    try {
      colonyDb.prepare(`
        INSERT OR IGNORE INTO sessions (session_id, bot_id, start_time, end_time, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        session.session_id,
        botId,
        session.start_time,
        session.end_time,
        session.is_active
      );
      counts.sessions++;
    } catch (error: any) {
      console.error(`[Migrate] Failed to migrate session ${session.session_id}: ${error.message}`);
    }
  }

  // Migrate messages
  const messages = oldDb.prepare('SELECT * FROM messages').all() as any[];
  for (const msg of messages) {
    try {
      colonyDb.prepare(`
        INSERT INTO messages (
          session_id, bot_id, role, content, timestamp,
          position_x, position_y, position_z, health, food, inventory
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        msg.session_id,
        botId,
        msg.role,
        msg.content,
        msg.timestamp,
        msg.position_x,
        msg.position_y,
        msg.position_z,
        msg.health,
        msg.food,
        msg.inventory
      );
      counts.messages++;
    } catch (error: any) {
      // Skip if session doesn't exist (orphaned data)
      if (!error.message.includes('FOREIGN KEY')) {
        console.error(`[Migrate] Failed to migrate message: ${error.message}`);
      }
    }
  }

  // Migrate activities
  const activities = oldDb.prepare('SELECT * FROM activities').all() as any[];
  for (const activity of activities) {
    try {
      colonyDb.prepare(`
        INSERT INTO activities (
          session_id, bot_id, type, description, timestamp, data,
          position_x, position_y, position_z
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        activity.session_id,
        botId,
        activity.type,
        activity.description,
        activity.timestamp,
        activity.data,
        activity.position_x,
        activity.position_y,
        activity.position_z
      );
      counts.activities++;
    } catch (error: any) {
      if (!error.message.includes('FOREIGN KEY')) {
        console.error(`[Migrate] Failed to migrate activity: ${error.message}`);
      }
    }
  }

  // Migrate accomplishments
  const accomplishments = oldDb.prepare('SELECT * FROM accomplishments').all() as any[];
  for (const acc of accomplishments) {
    try {
      colonyDb.prepare(`
        INSERT INTO accomplishments (
          session_id, bot_id, description, timestamp,
          position_x, position_y, position_z
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        acc.session_id,
        botId,
        acc.description,
        acc.timestamp,
        acc.position_x,
        acc.position_y,
        acc.position_z
      );
      counts.accomplishments++;
    } catch (error: any) {
      if (!error.message.includes('FOREIGN KEY')) {
        console.error(`[Migrate] Failed to migrate accomplishment: ${error.message}`);
      }
    }
  }

  // Migrate learned facts
  const facts = oldDb.prepare('SELECT * FROM learned_facts WHERE bot_name = ?').all(botName) as any[];
  for (const fact of facts) {
    try {
      colonyDb.prepare(`
        INSERT OR REPLACE INTO learned_facts (
          bot_id, fact, timestamp, context, importance
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        botId,
        fact.fact,
        fact.timestamp,
        fact.context,
        fact.importance
      );
      counts.facts++;
    } catch (error: any) {
      console.error(`[Migrate] Failed to migrate fact: ${error.message}`);
    }
  }

  // Migrate relationships
  const relationships = oldDb.prepare('SELECT * FROM relationships WHERE bot_name = ?').all(botName) as any[];
  for (const rel of relationships) {
    try {
      colonyDb.prepare(`
        INSERT OR REPLACE INTO relationships (
          bot_id, player_name, trust_level, last_interaction, notes
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        botId,
        rel.player_name,
        rel.trust_level,
        rel.last_interaction,
        rel.notes
      );
      counts.relationships++;
    } catch (error: any) {
      console.error(`[Migrate] Failed to migrate relationship: ${error.message}`);
    }
  }

  // Migrate preferences
  const preferences = oldDb.prepare('SELECT * FROM preferences WHERE bot_name = ?').all(botName) as any[];
  for (const pref of preferences) {
    try {
      colonyDb.prepare(`
        INSERT OR REPLACE INTO preferences (bot_id, key, value)
        VALUES (?, ?, ?)
      `).run(botId, pref.key, pref.value);
      counts.preferences++;
    } catch (error: any) {
      console.error(`[Migrate] Failed to migrate preference: ${error.message}`);
    }
  }

  oldDb.close();

  console.log(`[Migrate] Migrated for ${botName}:`, counts);
  return botId;
}

async function main() {
  console.log('='.repeat(70));
  console.log('Migration: Per-bot databases → Shared colony.db');
  console.log('='.repeat(70));

  // Check if memories directory exists
  if (!fs.existsSync(MEMORIES_DIR)) {
    console.log('[Migrate] No memories directory found. Nothing to migrate.');
    console.log(`[Migrate] Looked in: ${MEMORIES_DIR}`);
    return;
  }

  // Find all .db files
  const dbFiles = fs.readdirSync(MEMORIES_DIR).filter(f => f.endsWith('.db'));

  if (dbFiles.length === 0) {
    console.log('[Migrate] No bot databases found to migrate.');
    return;
  }

  console.log(`[Migrate] Found ${dbFiles.length} bot database(s) to migrate`);

  // Import schema from source
  const schemaPath = path.resolve(__dirname, '..', 'src', 'database', 'schema.js');
  let SCHEMA_SQL: string;

  try {
    // Try to import compiled schema
    const schema = await import(schemaPath);
    SCHEMA_SQL = schema.SCHEMA_SQL;
  } catch (error) {
    console.error('[Migrate] Failed to import schema. Make sure to build first: pnpm build');
    console.error('[Migrate] Using inline schema as fallback...');

    // Inline fallback schema (same as in schema.ts)
    SCHEMA_SQL = `
      CREATE TABLE IF NOT EXISTS bots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        bot_id INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER DEFAULT NULL,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        bot_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        position_x REAL, position_y REAL, position_z REAL,
        health INTEGER, food INTEGER, inventory TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        bot_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT,
        position_x REAL, position_y REAL, position_z REAL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS accomplishments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        bot_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        position_x REAL, position_y REAL, position_z REAL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS learned_facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id INTEGER NOT NULL,
        fact TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        context TEXT,
        importance INTEGER DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
        FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
        UNIQUE(bot_id, fact) ON CONFLICT REPLACE
      );

      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id INTEGER NOT NULL,
        player_name TEXT NOT NULL,
        trust_level INTEGER DEFAULT 50 CHECK(trust_level BETWEEN 0 AND 100),
        last_interaction INTEGER NOT NULL,
        notes TEXT,
        FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
        UNIQUE(bot_id, player_name) ON CONFLICT REPLACE
      );

      CREATE TABLE IF NOT EXISTS preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
        UNIQUE(bot_id, key) ON CONFLICT REPLACE
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_bot ON sessions(bot_id);
      CREATE INDEX IF NOT EXISTS idx_messages_bot ON messages(bot_id);
      CREATE INDEX IF NOT EXISTS idx_activities_bot ON activities(bot_id);
      CREATE INDEX IF NOT EXISTS idx_accomplishments_bot ON accomplishments(bot_id);
    `;
  }

  // Initialize colony database
  console.log(`\n[Migrate] Initializing colony database: ${COLONY_DB_PATH}`);
  const colonyDb = new Database(COLONY_DB_PATH);
  colonyDb.pragma('journal_mode = WAL');
  colonyDb.pragma('foreign_keys = ON');
  colonyDb.exec(SCHEMA_SQL);

  // Migrate each bot database
  const mappings: BotMapping[] = [];

  for (const dbFile of dbFiles) {
    const botName = path.basename(dbFile, '.db');
    const oldDbPath = path.join(MEMORIES_DIR, dbFile);

    const botId = migrateBotDatabase(oldDbPath, botName, colonyDb);
    mappings.push({ name: botName, oldDbPath, newBotId: botId });
  }

  // Close colony database
  colonyDb.close();

  // Create backup directory and move old files
  console.log(`\n[Migrate] Creating backup: ${BACKUP_DIR}`);
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  for (const mapping of mappings) {
    const backupPath = path.join(BACKUP_DIR, path.basename(mapping.oldDbPath));
    fs.renameSync(mapping.oldDbPath, backupPath);
    console.log(`[Migrate] Backed up: ${mapping.name} → ${backupPath}`);
  }

  // Also backup WAL and SHM files if they exist
  for (const ext of ['-wal', '-shm']) {
    const files = fs.readdirSync(MEMORIES_DIR).filter(f => f.endsWith(ext));
    for (const file of files) {
      const srcPath = path.join(MEMORIES_DIR, file);
      const dstPath = path.join(BACKUP_DIR, file);
      fs.renameSync(srcPath, dstPath);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Migration complete!');
  console.log('='.repeat(70));
  console.log(`[Migrate] Colony database: ${COLONY_DB_PATH}`);
  console.log(`[Migrate] Backups: ${BACKUP_DIR}`);
  console.log(`[Migrate] Migrated ${mappings.length} bot(s)`);
  console.log('\nBot ID mappings:');
  for (const mapping of mappings) {
    console.log(`  - ${mapping.name}: ID ${mapping.newBotId}`);
  }
}

main().catch(error => {
  console.error('[Migrate] Fatal error:', error);
  process.exit(1);
});
