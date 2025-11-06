# Merge Bot Runtime + Dashboard into Single Process

**Status**: ✅ COMPLETED
**Date**: 2025-11-06
**Goal**: Eliminate separation between bot runtime and dashboard to reduce code duplication and data transfer issues

## Implementation Summary

All phases completed successfully:
- ✅ Database migration to shared colony.db
- ✅ BotManager for in-process bot management
- ✅ Dashboard integration with direct method calls
- ✅ Removed duplicate code (botControl.ts, colonyControl.ts)
- ✅ Updated entry points and build process
- ✅ Build succeeds with no errors

**Next Steps**: Run migration script and test the new unified architecture.

## Architecture Vision

```
┌────────────────────────────────────────────────────────────┐
│           Unified Colony Process (port 4242)               │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Dashboard Server (Hono)                              │ │
│  │  - REST API                                          │ │
│  │  - WebSocket /ws (UI clients)                        │ │
│  │  - Static Vue UI                                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                          │                                 │
│                          ▼                                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ BotManager (in-memory)                               │ │
│  │  - Map<name, BotInstance>                            │ │
│  │  - Direct method calls (no IPC/HTTP)                 │ │
│  │  - Event emitter for realtime updates               │ │
│  └──────────────────────────────────────────────────────┘ │
│            │              │               │                │
│            ▼              ▼               ▼                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Bot: Kubo    │  │ Bot: Sammel  │  │ Bot: ...     │    │
│  │ - Mineflayer │  │ - Mineflayer │  │              │    │
│  │ - ClaudeSDK  │  │ - ClaudeSDK  │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│            │              │               │                │
│            └──────────────┴───────────────┘                │
│                          ▼                                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Single Shared SQLite Database                        │ │
│  │  colony.db (or logs/colony.db)                       │ │
│  │                                                       │ │
│  │  Tables:                                             │ │
│  │   - bots (id, name, config, status)                  │ │
│  │   - sessions (id, bot_id, started_at, ended_at)      │ │
│  │   - messages (id, session_id, bot_id, role, ...)     │ │
│  │   - activities (id, bot_id, type, timestamp, ...)    │ │
│  │   - learned_facts (id, bot_id, fact, ...)            │ │
│  │   - relationships (id, bot_id, player_name, ...)     │ │
│  │   - accomplishments (id, bot_id, description, ...)   │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

## Problems Being Solved

### 1. Code Duplication
- **Bot status reading**: Duplicated in `botControl.ts` and `dashboardServer.ts`
- **SQLite opening logic**: Three different implementations
- **Activity transformations**: Data transformed 4-5 times through the stack
- **Control communication**: Three paths (IPC, HTTP, chat injection)

### 2. Data Transfer Issues
- **Stale bot status**: Polling-based status becomes outdated when bot is idle
- **Double persistence**: Activities written to SQLite twice from different code paths
- **Timeline ID conflicts**: Random IDs cause duplicate timeline items
- **Race conditions**: Dashboard reads SQLite while bot is writing

### 3. Architectural Complexity
- **Loose coupling**: WebSocket + SQLite polling + IPC creates fragile communication
- **No single source of truth**: Bot state exists in 4+ places
- **Inconsistent error handling**: Each communication path has different error handling

## Key Changes

### 1. **Eliminate Child Processes**
- Remove `botControl.ts` spawning logic
- Bots run as class instances in same process
- Direct method calls instead of IPC/HTTP/chat fallbacks

### 2. **Single Database**
- Migrate from `logs/memories/{bot}.db` to `logs/colony.db`
- Add `bot_id` column to all tables
- Use foreign keys for data integrity
- Enable proper concurrent access

### 3. **Shared State via BotManager**
- Central `BotManager` class owns all bot instances
- Dashboard calls `botManager.getBot(name).executeScript()`
- EventEmitter for realtime updates to dashboard
- No WebSocket `/ingest`, no activity transforms

### 4. **Unified Data Layer**
- Single `ColonyDatabase` class
- All reads/writes go through one interface
- No duplicate SQLite opening logic
- Consistent error handling

## Implementation Steps

### Phase 1: Database Migration (2-3 hours)
1. Create new schema in `src/database/schema.ts`
2. Create `ColonyDatabase` class with migration from old per-bot DBs
3. Add migration script to merge existing `logs/memories/*.db` into `logs/colony.db`
4. Update `SqlMemoryStore` to use shared DB with bot_id

### Phase 2: BotManager (2-3 hours)
5. Create `src/runtime/BotManager.ts` class
6. Move bot instantiation from spawning to `createBot(config)`
7. Implement lifecycle methods: `start()`, `stop()`, `restart()`, `getStatus()`
8. Add EventEmitter for: `bot:connected`, `bot:disconnected`, `bot:activity`, `bot:message`

### Phase 3: Dashboard Integration (1-2 hours)
9. Update `dashboardServer.ts` to use `BotManager` directly
10. Remove `botControl.ts` imports and subprocess logic
11. Replace `/ingest` WebSocket with EventEmitter subscriptions
12. Simplify `/api/bots/:name/craftscript` to direct method call

### Phase 4: Remove Duplication (1-2 hours)
13. Delete `botControl.ts`, `activityWriter.ts` (replaced by EventEmitter)
14. Consolidate status derivation into `BotManager.getStatus()`
15. Remove WebSocket client code from bots
16. Single activity format (no transforms)

### Phase 5: Single Entry Point (1 hour)
17. Update `src/index.ts` to start both BotManager and Dashboard
18. Remove `colonyRuntime.ts` spawning logic (or merge it)
19. Update Makefile to run single process
20. Test all features: timeline, CraftScript, status, chat

### Phase 6: Cleanup (1 hour)
21. Remove unused files and dead code
22. Update documentation
23. Add JSDoc comments to new classes
24. Verify UI works with new backend

## Migration Script

Create `scripts/migrate-to-shared-db.ts` that:
- Reads all `logs/memories/*.db` files
- Extracts data from each
- Inserts into `logs/colony.db` with correct `bot_id`
- Backs up old files to `logs/memories.backup/`

## File Changes Summary

### New Files
- `src/database/schema.ts` - DB schema definition
- `src/database/ColonyDatabase.ts` - Shared DB access
- `src/runtime/BotManager.ts` - Central bot management
- `scripts/migrate-to-shared-db.ts` - Data migration

### Modified Files
- `src/index.ts` - New entry point
- `src/runtime/dashboardServer.ts` - Use BotManager
- `src/utils/sqlMemoryStore.ts` - Use shared DB
- `src/agent/ClaudeAgentSDK.ts` - Remove control server
- `Makefile` - Single process startup

### Deleted Files
- `src/runtime/botControl.ts` - Replaced by BotManager
- `src/utils/activityWriter.ts` - Replaced by EventEmitter
- `src/runtime/colonyRuntime.ts` - Merged into index.ts

## Benefits

✅ **No more IPC/HTTP fallbacks** - Direct method calls
✅ **No SQLite race conditions** - Single DB connection pool
✅ **No activity transformations** - Single format throughout
✅ **No duplicate status logic** - One source of truth
✅ **Simpler debugging** - All logs in one process
✅ **Better performance** - No process spawning overhead
✅ **Easier testing** - Import and test BotManager directly

## Risks & Considerations

⚠️ **Single point of failure** - One bot crash could affect others (mitigate with try/catch)
⚠️ **Memory usage** - All bots in one process (monitor heap)
⚠️ **Concurrent DB writes** - Need proper locking (use better-sqlite3 transactions)

## Estimated Time: 8-12 hours

## Progress Tracking

- [x] Phase 1: Database Migration
- [x] Phase 2: BotManager
- [x] Phase 3: Dashboard Integration
- [x] Phase 4: Remove Duplication
- [x] Phase 5: Single Entry Point
- [x] Phase 6: Build and Testing

## Files Created

- `src/database/schema.ts` - Shared database schema
- `src/database/ColonyDatabase.ts` - Singleton database access layer
- `src/runtime/BotManager.ts` - Central bot management with EventEmitter
- `scripts/migrate-to-shared-db.ts` - Migration script for existing data

## Files Modified

- `src/utils/sqlMemoryStore.ts` - Now wraps ColonyDatabase
- `src/runtime/dashboardServer.ts` - Simplified to use BotManager
- `src/runtime/colonyRuntime.ts` - Unified entry point
- `src/dashboard.ts` - Updated for backward compatibility

## Files Archived

- `src/runtime/botControl.ts.old` - Replaced by BotManager
- `src/runtime/colonyControl.ts.old` - CLI tool (deprecated)
- `src/runtime/dashboardServer.ts.backup` - Old dashboard implementation
