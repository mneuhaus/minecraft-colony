/**
 * Colony-wide shared database schema
 *
 * This replaces per-bot SQLite databases with a single shared database
 * where all tables have a bot_id column for multi-tenancy.
 */

export const SCHEMA_VERSION = 3;

/**
 * SQL statements to create the shared colony database schema
 */
export const SCHEMA_SQL = `
  -- Bots table - tracks all bots in the colony
  CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    config TEXT NOT NULL, -- JSON serialized BotConfig
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Sessions table - tracks conversation sessions per bot
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    bot_id INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER DEFAULT NULL,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
  );

  -- Messages table - stores conversation messages
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    bot_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    position_x REAL,
    position_y REAL,
    position_z REAL,
    health INTEGER,
    food INTEGER,
    inventory TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
  );

  -- Activities table - tracks significant bot actions
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    bot_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    data TEXT, -- JSON serialized data
    position_x REAL,
    position_y REAL,
    position_z REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
  );

  -- Accomplishments table
  CREATE TABLE IF NOT EXISTS accomplishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    bot_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    position_x REAL,
    position_y REAL,
    position_z REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
  );

  -- Learned facts table - long-term knowledge with importance ranking
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

  -- Relationships table
  CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    trust_level INTEGER DEFAULT 50 CHECK(trust_level BETWEEN 0 AND 100),
    last_interaction INTEGER NOT NULL,
    notes TEXT, -- JSON array of notes
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    UNIQUE(bot_id, player_name) ON CONFLICT REPLACE
  );

  -- Preferences table
  CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    UNIQUE(bot_id, key) ON CONFLICT REPLACE
  );

  -- Metadata table for colony-wide settings
  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Bug/issue tracking table
  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'open',
    severity TEXT NOT NULL DEFAULT 'medium',
    assigned_to TEXT,
    assigned_bot_id INTEGER,
    created_by TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_bot_id) REFERENCES bots(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS issue_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    author TEXT,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
  );

  -- CraftScript custom functions - reusable bot procedures
  CREATE TABLE IF NOT EXISTS craftscript_functions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    args TEXT NOT NULL, -- JSON array of {name, type, optional, default}
    body TEXT NOT NULL, -- CraftScript source code
    current_version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    created_by TEXT, -- bot name that created it
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    UNIQUE(bot_id, name)
  );

  -- CraftScript function version history
  CREATE TABLE IF NOT EXISTS craftscript_function_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    function_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    body TEXT NOT NULL,
    description TEXT,
    args TEXT NOT NULL, -- JSON array of arg definitions
    created_at INTEGER NOT NULL,
    created_by TEXT,
    change_summary TEXT,
    metadata TEXT, -- JSON: {test_results, performance, notes}
    FOREIGN KEY (function_id) REFERENCES craftscript_functions(id) ON DELETE CASCADE,
    UNIQUE(function_id, version)
  );

  -- CraftScript block changes - tracks all block modifications during execution
  CREATE TABLE IF NOT EXISTS craftscript_block_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    bot_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('placed', 'destroyed')),
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    z INTEGER NOT NULL,
    block_id TEXT NOT NULL,
    previous_block_id TEXT,
    command TEXT,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
  );

  -- Indexes for fast lookups
  CREATE INDEX IF NOT EXISTS idx_sessions_bot ON sessions(bot_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_bot ON messages(bot_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_activities_session ON activities(session_id);
  CREATE INDEX IF NOT EXISTS idx_activities_bot ON activities(bot_id);
  CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
  CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
  CREATE INDEX IF NOT EXISTS idx_activities_position ON activities(position_x, position_y, position_z);
  CREATE INDEX IF NOT EXISTS idx_accomplishments_session ON accomplishments(session_id);
  CREATE INDEX IF NOT EXISTS idx_accomplishments_bot ON accomplishments(bot_id);
  CREATE INDEX IF NOT EXISTS idx_accomplishments_timestamp ON accomplishments(timestamp);
  CREATE INDEX IF NOT EXISTS idx_learned_facts_bot ON learned_facts(bot_id);
  CREATE INDEX IF NOT EXISTS idx_learned_facts_importance ON learned_facts(importance);
  CREATE INDEX IF NOT EXISTS idx_relationships_bot ON relationships(bot_id);
  CREATE INDEX IF NOT EXISTS idx_preferences_bot ON preferences(bot_id);
  CREATE INDEX IF NOT EXISTS idx_craftscript_functions_bot_name ON craftscript_functions(bot_id, name);
  CREATE INDEX IF NOT EXISTS idx_craftscript_function_versions_function ON craftscript_function_versions(function_id, version);
  CREATE INDEX IF NOT EXISTS idx_craftscript_block_changes_job ON craftscript_block_changes(job_id);
  CREATE INDEX IF NOT EXISTS idx_craftscript_block_changes_position ON craftscript_block_changes(x, y, z);
  CREATE INDEX IF NOT EXISTS idx_craftscript_block_changes_bot ON craftscript_block_changes(bot_id);
  CREATE INDEX IF NOT EXISTS idx_issues_state ON issues(state);
  CREATE INDEX IF NOT EXISTS idx_issues_bot ON issues(bot_id);
  CREATE INDEX IF NOT EXISTS idx_issues_assigned_bot ON issues(assigned_bot_id);
  CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id);
`;

/**
 * Bot status derived from database state
 */
export interface BotStatus {
  id: number;
  name: string;
  running: boolean;
  connected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastActivity?: {
    type: string;
    description: string;
    timestamp: number;
  };
  position?: { x: number; y: number; z: number };
  health?: number;
  food?: number;
  sessionId?: string;
  timeSinceUpdate?: number;
}
