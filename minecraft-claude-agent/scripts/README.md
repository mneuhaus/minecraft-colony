# Utility Scripts

This directory hosts maintenance scripts that are not part of the runtime build. Run them with Bun directly (they are plain TypeScript files).

## Available Scripts

### migrateMemories.ts
* **Purpose:** Copy legacy per-bot JSON memories into the shared SqlMemoryStore so the Agent SDK can use a single database.
* **Usage:**
  ```bash
  bun scripts/migrateMemories.ts
  ```
* **Notes:**
  - Safe to run multiple times; rows already present are skipped.
  - Requires access to `logs/` where the legacy JSON files live.

Add new scripts here and document them following the same pattern.
