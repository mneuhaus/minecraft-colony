#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { SqlMemoryStore } from '../src/utils/sqlMemoryStore.js';

/**
 * Migration script to convert JSON memory files to SQLite databases
 */

function migrateMemories() {
  const memoriesDir = path.resolve('logs', 'memories');
  
  // Check if memories directory exists
  if (!fs.existsSync(memoriesDir)) {
    console.log('No memories directory found. Nothing to migrate.');
    return;
  }
  
  // Find all JSON memory files
  const jsonFiles = fs.readdirSync(memoriesDir)
    .filter(file => file.endsWith('.json'));
  
  if (jsonFiles.length === 0) {
    console.log('No JSON memory files found to migrate.');
    return;
  }
  
  console.log(`Found ${jsonFiles.length} JSON memory file(s) to migrate.`);
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const jsonFile of jsonFiles) {
    const jsonPath = path.join(memoriesDir, jsonFile);
    const botName = path.basename(jsonFile, '.json');
    const dbPath = path.join(memoriesDir, `${botName}.db`);
    
    // Check if SQLite database already exists
    if (fs.existsSync(dbPath)) {
      console.log(`⚠️  SQLite database already exists for ${botName}. Skipping to avoid data loss.`);
      console.log(`   To force migration, manually delete ${dbPath} first.`);
      continue;
    }
    
    console.log(`\nMigrating ${botName}...`);
    
    try {
      // Read JSON file
      const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
      const jsonMemory = JSON.parse(jsonContent);
      
      // Validate JSON structure
      if (!jsonMemory.botName || !jsonMemory.sessions) {
        throw new Error('Invalid JSON memory structure');
      }
      
      // Create new SQLite store
      const sqlStore = new SqlMemoryStore(botName, { dbPath });
      
      // Import data from JSON
      sqlStore.importFromJson(jsonMemory);
      
      // Close the database connection
      sqlStore.close();
      
      // Rename original JSON file to .backup
      const backupPath = `${jsonPath}.backup`;
      fs.renameSync(jsonPath, backupPath);
      
      console.log(`✅ Successfully migrated ${botName}`);
      console.log(`   Original JSON backed up to: ${path.basename(backupPath)}`);
      successCount++;
      
    } catch (error: any) {
      console.error(`❌ Failed to migrate ${botName}: ${error.message}`);
      failureCount++;
      
      // Clean up failed migration attempt
      if (fs.existsSync(dbPath)) {
        try {
          fs.unlinkSync(dbPath);
          fs.unlinkSync(`${dbPath}-shm`);
          fs.unlinkSync(`${dbPath}-wal`);
        } catch {}
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Migration Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`⚠️  Skipped: ${jsonFiles.length - successCount - failureCount}`);
  
  if (successCount > 0) {
    console.log('\nNext steps:');
    console.log('1. Test the bots to ensure they work with SQLite');
    console.log('2. Once verified, you can delete the .backup files');
    console.log('3. The bots should now automatically use the SQLite databases');
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔄 Starting JSON to SQLite migration...');
  console.log('='.repeat(50));
  migrateMemories();
}

export { migrateMemories };
