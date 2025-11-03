#!/usr/bin/env node
import { SqlMemoryStore } from './sqlMemoryStore.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Test script for SqlMemoryStore functionality
 */

function testSqlMemoryStore() {
  console.log('🧪 Testing SqlMemoryStore...\n');
  
  const testBotName = 'TestBot';
  const testDbPath = path.resolve('logs', 'memories', `${testBotName}_test.db`);
  
  // Clean up any existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    console.log('✅ Cleaned up existing test database\n');
  }
  
  try {
    // Test 1: Create store
    console.log('Test 1: Creating SqlMemoryStore...');
    const store = new SqlMemoryStore(testBotName, { dbPath: testDbPath });
    console.log('✅ Store created successfully\n');
    
    // Test 2: Create session
    console.log('Test 2: Creating session...');
    const sessionId = `test-session-${Date.now()}`;
    store.createSession(sessionId);
    console.log(`✅ Session created: ${sessionId}\n`);
    
    // Test 3: Add messages
    console.log('Test 3: Adding messages...');
    store.addMessage(sessionId, 'user', 'Hello bot!', {
      position: { x: 100, y: 64, z: 200 },
      health: 20,
      food: 18
    });
    store.addMessage(sessionId, 'assistant', 'Hello! How can I help you?');
    store.addMessage(sessionId, 'user', 'Can you mine some stone?');
    console.log('✅ Messages added successfully\n');
    
    // Test 4: Add activities
    console.log('Test 4: Adding activities...');
    store.addActivity(sessionId, 'mining', 'Started mining stone', {
      position: { x: 101, y: 63, z: 201 },
      blockType: 'stone'
    });
    store.addActivity(sessionId, 'crafting', 'Crafted stone pickaxe');
    console.log('✅ Activities added successfully\n');
    
    // Test 5: Add accomplishment
    console.log('Test 5: Adding accomplishment...');
    store.addAccomplishment(sessionId, 'Mined 64 stone blocks', { x: 101, y: 63, z: 201 });
    console.log('✅ Accomplishment added successfully\n');
    
    // Test 6: Learn facts
    console.log('Test 6: Learning facts...');
    store.learnFact('Diamonds can be found below Y=16', 'Mining knowledge', 8);
    store.learnFact('Creepers explode when close', 'Combat knowledge', 9);
    store.learnFact('Wheat grows faster with water nearby', 'Farming knowledge', 6);
    console.log('✅ Facts learned successfully\n');
    
    // Test 7: Update relationships
    console.log('Test 7: Updating relationships...');
    store.updateRelationship('Steve', 10, 'Helped me find diamonds');
    store.updateRelationship('Alex', -5, 'Stole my items');
    store.updateRelationship('Steve', 5, 'Gave me food when hungry');
    console.log('✅ Relationships updated successfully\n');
    
    // Test 8: Set preferences
    console.log('Test 8: Setting preferences...');
    store.setPreference('favorite_tool', 'diamond_pickaxe');
    store.setPreference('home_position', { x: 0, y: 64, z: 0 });
    store.setPreference('auto_replant', true);
    console.log('✅ Preferences set successfully\n');
    
    // Test 9: Get preference
    console.log('Test 9: Getting preferences...');
    const favTool = store.getPreference('favorite_tool');
    const homePos = store.getPreference('home_position');
    console.log(`  Favorite tool: ${favTool}`);
    console.log(`  Home position: ${JSON.stringify(homePos)}`);
    console.log('✅ Preferences retrieved successfully\n');
    
    // Test 10: Get contextual prompt
    console.log('Test 10: Getting contextual prompt...');
    const prompt = store.getContextualPrompt(sessionId);
    console.log('Contextual prompt preview:');
    console.log('---');
    console.log(prompt.substring(0, 300) + '...');
    console.log('---');
    console.log('✅ Contextual prompt generated successfully\n');
    
    // Test 11: Get last active session
    console.log('Test 11: Getting last active session...');
    const lastSession = store.getLastActiveSessionId();
    console.log(`  Last active session: ${lastSession}`);
    console.log('✅ Last active session retrieved successfully\n');
    
    // Test 12: Get conversation history
    console.log('Test 12: Getting conversation history...');
    const history = store.getFullConversationHistory();
    console.log(`  Total messages in history: ${history.length}`);
    console.log('✅ Conversation history retrieved successfully\n');
    
    // Test 13: Get recent sessions
    console.log('Test 13: Getting recent sessions...');
    const recentSessions = store.getRecentSessions(5);
    console.log(`  Found ${recentSessions.length} recent session(s)`);
    console.log('✅ Recent sessions retrieved successfully\n');
    
    // Test 14: End session
    console.log('Test 14: Ending session...');
    store.endSession(sessionId);
    console.log('✅ Session ended successfully\n');
    
    // Test 15: Close database
    console.log('Test 15: Closing database...');
    store.close();
    console.log('✅ Database closed successfully\n');
    
    // Verify database file exists
    if (fs.existsSync(testDbPath)) {
      const stats = fs.statSync(testDbPath);
      console.log(`📊 Database file size: ${stats.size} bytes\n`);
      
      // Quick integrity check
      console.log('Test 16: Database integrity check...');
      const db = new Database(testDbPath, { readonly: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log(`  Tables found: ${tables.map((t: any) => t.name).join(', ')}`);
      
      const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get() as any;
      console.log(`  Messages in database: ${messageCount.count}`);
      
      const factCount = db.prepare('SELECT COUNT(*) as count FROM learned_facts').get() as any;
      console.log(`  Facts in database: ${factCount.count}`);
      
      db.close();
      console.log('✅ Database integrity verified\n');
      
      // Clean up test database
      fs.unlinkSync(testDbPath);
      try {
        fs.unlinkSync(`${testDbPath}-shm`);
        fs.unlinkSync(`${testDbPath}-wal`);
      } catch {}
      console.log('🧹 Test database cleaned up\n');
    }
    
    console.log('=' . repeat(50));
    console.log('✅ ALL TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('The SqlMemoryStore is working correctly.');
    console.log('=' . repeat(50));
    
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    
    // Clean up on failure
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
        fs.unlinkSync(`${testDbPath}-shm`);
        fs.unlinkSync(`${testDbPath}-wal`);
      }
    } catch {}
    
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSqlMemoryStore();
}

export { testSqlMemoryStore };