#!/usr/bin/env bun
/**
 * Standalone CraftScript Test Runner
 *
 * Tests CraftScript code without requiring a real bot connection.
 * Creates a mock bot with configurable world state.
 *
 * Usage:
 *   bun src/craftscript/test-runner.ts <script-file>
 *   bun src/craftscript/test-runner.ts --inline "move ^f1; turn r90"
 */

import { Vec3 } from 'vec3';
import { parse } from './parser.js';
import { CraftscriptExecutor } from './executor.js';
import type { Bot } from 'mineflayer';

// Mock Bot Implementation
class MockBot {
  public entity: any;
  public inventory: any;
  public pathfinder: any;
  public world: Map<string, any>;
  public actionLog: Array<{ type: string; data: any }> = [];
  public username: string;
  public version: string;

  constructor(options: {
    position?: Vec3;
    yaw?: number;
    inventory?: Array<{ name: string; count: number }>;
    worldBlocks?: Array<{ pos: Vec3; name: string }>;
  } = {}) {
    this.username = 'test-bot';
    this.version = '1.20.1';

    // Setup entity position and orientation
    this.entity = {
      position: options.position || new Vec3(0, 64, 0),
      yaw: options.yaw || 0,
      pitch: 0,
    };

    // Setup inventory
    const items = (options.inventory || []).map((item, idx) => ({
      type: idx,
      name: item.name,
      count: item.count,
      slot: idx,
    }));
    this.inventory = {
      items: () => items,
    };

    // Setup world blocks
    this.world = new Map<string, any>();
    if (options.worldBlocks) {
      for (const block of options.worldBlocks) {
        const key = `${block.pos.x},${block.pos.y},${block.pos.z}`;
        this.world.set(key, { name: block.name, position: block.pos });
      }
    }

    // Setup pathfinder mock
    this.pathfinder = {
      goto: async (goal: any) => {
        this.actionLog.push({ type: 'pathfinder.goto', data: { goal } });
        // Simulate successful pathfinding
        await this.delay(10);
      },
      setMovements: (movements: any) => {
        this.actionLog.push({ type: 'pathfinder.setMovements', data: { movements } });
      },
      setGoal: (goal: any, dynamic?: boolean) => {
        this.actionLog.push({ type: 'pathfinder.setGoal', data: { goal, dynamic } });
      },
    };
  }

  blockAt(pos: Vec3): any | null {
    const key = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
    return this.world.get(key) || { name: 'air', position: pos };
  }

  async look(yaw: number, pitch: number, force?: boolean): Promise<void> {
    this.actionLog.push({ type: 'look', data: { yaw, pitch, force } });
    this.entity.yaw = yaw;
    this.entity.pitch = pitch;
    await this.delay(10);
  }

  async dig(block: any): Promise<void> {
    this.actionLog.push({ type: 'dig', data: { block: block.name, pos: block.position } });
    // Remove block from world
    const key = `${Math.floor(block.position.x)},${Math.floor(block.position.y)},${Math.floor(block.position.z)}`;
    this.world.set(key, { name: 'air', position: block.position });
    await this.delay(100);
  }

  async equip(item: any, destination: string): Promise<void> {
    this.actionLog.push({ type: 'equip', data: { item: item.name, destination } });
    await this.delay(10);
  }

  async placeBlock(referenceBlock: any, faceVector: Vec3): Promise<void> {
    this.actionLog.push({
      type: 'placeBlock',
      data: {
        reference: { name: referenceBlock.name, pos: referenceBlock.position },
        faceVector: { x: faceVector.x, y: faceVector.y, z: faceVector.z }
      }
    });
    // Add block to world
    const placePos = referenceBlock.position.plus(faceVector);
    const key = `${Math.floor(placePos.x)},${Math.floor(placePos.y)},${Math.floor(placePos.z)}`;
    this.world.set(key, { name: 'placed_block', position: placePos });
    await this.delay(100);
  }

  async toss(type: number, metadata: any, count: number): Promise<void> {
    this.actionLog.push({ type: 'toss', data: { type, metadata, count } });
    await this.delay(50);
  }

  async consume(): Promise<void> {
    this.actionLog.push({ type: 'consume', data: {} });
    await this.delay(100);
  }

  // Helper for simulated delays
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test helpers
  getActionLog(): Array<{ type: string; data: any }> {
    return this.actionLog;
  }

  clearActionLog(): void {
    this.actionLog = [];
  }

  setBlock(pos: Vec3, name: string): void {
    const key = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
    this.world.set(key, { name, position: pos });
  }
}

// Test Runner
async function runTest(scriptContent: string, testConfig: {
  botPosition?: Vec3;
  botYaw?: number;
  inventory?: Array<{ name: string; count: number }>;
  worldBlocks?: Array<{ pos: Vec3; name: string }>;
  opLimit?: number;
  verbose?: boolean;
} = {}) {
  console.log('🧪 CraftScript Test Runner\n');

  // Parse script
  console.log('📝 Parsing script...');
  let program;
  try {
    program = parse(scriptContent);
    console.log(`✅ Parsed successfully (${program.body.length} statements)\n`);
  } catch (e: any) {
    console.error('❌ Parse error:', e.message);
    process.exit(1);
  }

  // Create mock bot
  console.log('🤖 Creating mock bot...');
  const mockBot = new MockBot({
    position: testConfig.botPosition,
    yaw: testConfig.botYaw,
    inventory: testConfig.inventory,
    worldBlocks: testConfig.worldBlocks,
  });
  console.log(`   Position: (${mockBot.entity.position.x}, ${mockBot.entity.position.y}, ${mockBot.entity.position.z})`);
  console.log(`   Yaw: ${mockBot.entity.yaw.toFixed(2)}`);
  console.log(`   Inventory: ${mockBot.inventory.items().length} items`);
  console.log(`   World blocks: ${mockBot.world.size} loaded\n`);

  // Execute script
  console.log('⚡ Executing script...');
  const executor = new CraftscriptExecutor(mockBot as unknown as Bot, {
    opLimit: testConfig.opLimit || 1000,
    defaultScanRadius: 2,
    autoScanBeforeOps: false, // Disable auto-scan in tests
  });

  const startTime = Date.now();
  const result = await executor.run(program);
  const duration = Date.now() - startTime;

  console.log(`\n📊 Execution completed in ${duration}ms\n`);

  // Display results
  console.log('Results:');
  console.log(`   Status: ${result.ok ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`   Operations: ${result.results.length}`);

  if (testConfig.verbose) {
    console.log('\n📋 Detailed Results:');
    for (const [idx, res] of result.results.entries()) {
      if (res.ok) {
        console.log(`   ${idx + 1}. ✅ ${res.op} (${res.ms}ms)${res.notes ? ` - ${JSON.stringify(res.notes)}` : ''}`);
      } else {
        console.log(`   ${idx + 1}. ❌ ${res.error}: ${res.message}`);
        if (res.loc) console.log(`      Location: line ${res.loc.line}, column ${res.loc.column}`);
      }
    }
  }

  // Display action log
  console.log('\n🎬 Bot Actions:');
  const actions = mockBot.getActionLog();
  if (actions.length === 0) {
    console.log('   (no actions performed)');
  } else {
    for (const action of actions) {
      console.log(`   • ${action.type}: ${JSON.stringify(action.data, null, 0)}`);
    }
  }

  // Final bot state
  console.log('\n🔍 Final Bot State:');
  console.log(`   Position: (${mockBot.entity.position.x}, ${mockBot.entity.position.y}, ${mockBot.entity.position.z})`);
  console.log(`   Yaw: ${mockBot.entity.yaw.toFixed(2)} rad`);

  return { result, mockBot };
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  bun src/craftscript/test-runner.ts <script-file>');
    console.log('  bun src/craftscript/test-runner.ts --inline "move ^f1; turn r90"');
    console.log('\nOptions:');
    console.log('  --verbose    Show detailed results');
    process.exit(1);
  }

  let scriptContent: string;
  let verbose = false;

  if (args[0] === '--inline') {
    scriptContent = args[1];
    verbose = args.includes('--verbose');
  } else {
    const fs = await import('fs/promises');
    scriptContent = await fs.readFile(args[0], 'utf-8');
    verbose = args.includes('--verbose');
  }

  // Example test configuration - can be expanded to read from config file
  const testConfig = {
    botPosition: new Vec3(0, 64, 0),
    botYaw: Math.PI, // facing north
    inventory: [
      { name: 'stone', count: 64 },
      { name: 'dirt', count: 32 },
      { name: 'oak_log', count: 16 },
    ],
    worldBlocks: [
      // Ground below bot
      { pos: new Vec3(0, 63, 0), name: 'grass_block' },
      { pos: new Vec3(0, 63, 1), name: 'grass_block' },
      { pos: new Vec3(0, 63, -1), name: 'grass_block' },
      { pos: new Vec3(1, 63, 0), name: 'grass_block' },
      { pos: new Vec3(-1, 63, 0), name: 'grass_block' },
      // Some blocks to interact with
      { pos: new Vec3(0, 64, 1), name: 'dirt' },
      { pos: new Vec3(1, 64, 0), name: 'stone' },
    ],
    verbose,
  };

  await runTest(scriptContent, testConfig);
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

export { runTest, MockBot };
