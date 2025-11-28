import * as vm from 'vm';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import pathfinderPkg from 'mineflayer-pathfinder';
import { loadBotFunctions, validateAndCoerceArgs, formatFunctionArgs, type CraftScriptFunction } from './functionLoader.js';
import { SimplePathfinder } from '../pathfinder/SimplePathfinder.js';

const { goals, Movements } = pathfinderPkg as any;

export interface ExecutionResult {
  ok: boolean;
  duration_ms: number;
  result?: any;
  error?: {
    type: string;
    message: string;
    line?: number;
    column?: number;
    stack?: string;
  };
}

export interface JSExecutorOptions {
  opLimit?: number;
  defaultScanRadius?: number;
  autoScanBeforeOps?: boolean;
  onStep?: (result: any) => void;
  onTrace?: (trace: any) => void;
  db?: any;
  botId?: number;
  jobId?: string;
  abortSignal?: AbortSignal;
}

export class ExecutionError extends Error {
  constructor(
    public type: string,
    message: string,
    public context?: any
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
}

export class JavaScriptExecutor {
  async initialize() {
    // No initialization needed for vm module
  }

  async execute(script: string, bot: Bot, options: JSExecutorOptions = {}): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Load custom functions from database
      let customFunctions: CraftScriptFunction[] = [];
      if (options.botId && options.db) {
        try {
          customFunctions = loadBotFunctions(options.botId, options.db);
          if (customFunctions.length > 0) {
            console.log(`[jsExecutor] Loaded ${customFunctions.length} custom function(s): ${customFunctions.map(f => f.name).join(', ')}`);
          }
        } catch (err) {
          console.error('[jsExecutor] Failed to load custom functions:', err);
        }
      }

      // Create sandbox with all the commands
      const commands = this.createCommands(bot, options);

      const sandbox: any = {
        // Commands
        ...commands,

        // Global objects (safe subset)
        console: {
          log: (...args: any[]) => {
            console.log(`[Script ${options.jobId || 'unknown'}]`, ...args);
            // Emit as console trace for unified console view
            options.onTrace?.({
              kind: 'console',
              level: 'info',
              message: args.map(String).join(' '),
              details: args.length > 1 ? { args } : undefined,
              ts: Date.now()
            });
          }
        },
        Math,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Date,
        Promise,
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,

        // Disable dangerous APIs
        eval: undefined,
        Function: undefined,
        require: undefined,
        process: undefined,
        global: undefined,
        globalThis: undefined,
        Buffer: undefined,
      };

      // Inject custom functions into sandbox
      for (const func of customFunctions) {
        sandbox[func.name] = this.wrapCustomFunction(func, bot, options, sandbox);
      }

      // Create VM context
      const context = vm.createContext(sandbox);

      // Wrap script in async function
      const wrappedScript = `(async () => {\n${script}\n})()`;

      // Execute with timeout
      // Use 5 minutes (300000ms) to match the max wait() duration
      // This allows for long pathfinding operations and complex tasks
      const timeout = 300000; // 5 minutes
      const result = await Promise.race([
        vm.runInContext(wrappedScript, context, {
          filename: 'script.js',
          timeout: timeout,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new ExecutionError('timeout', `Script execution timed out after ${timeout/1000} seconds`)), timeout + 1000)
        )
      ]);

      return {
        ok: true,
        duration_ms: Date.now() - startTime,
        result
      };

    } catch (error: any) {
      return {
        ok: false,
        duration_ms: Date.now() - startTime,
        error: this.parseError(error)
      };
    }
  }

  private parseError(error: any) {
    const message = error?.message || String(error);

    // Parse JavaScript syntax errors
    const syntaxMatch = message.match(/SyntaxError: (.+)/);
    if (syntaxMatch) {
      return {
        type: 'compile_error',
        message: syntaxMatch[1],
      };
    }

    // Parse runtime errors from ExecutionError
    if (error instanceof ExecutionError) {
      return {
        type: error.type,
        message: error.message,
        ...error.context
      };
    }

    // Timeout
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        type: 'timeout',
        message: 'Script execution timed out'
      };
    }

    // Extract stack trace
    const stack = error?.stack;

    // Try to extract line number from stack
    const stackMatch = stack?.match(/at .+:(\d+):(\d+)/);
    const line = stackMatch ? parseInt(stackMatch[1]) - 1 : undefined; // -1 because we wrap in async function
    const column = stackMatch ? parseInt(stackMatch[2]) : undefined;

    // Generic error
    return {
      type: 'runtime_error',
      message,
      stack,
      line,
      column
    };
  }

  private wrapCustomFunction(
    func: CraftScriptFunction,
    bot: Bot,
    options: JSExecutorOptions,
    baseSandbox: any
  ): (...args: any[]) => Promise<any> {
    return async (...args: any[]) => {
      const t0 = Date.now();

      const trace = (kind: string, data: any) => {
        try { options.onTrace?.({ kind, ts: Date.now(), ...data }); } catch {}
      };

      const ok = (op: string, t0: number, notes?: any) => {
        const result = { ok: true, op, ms: Date.now() - t0, notes };
        try { options.onStep?.(result); } catch {}
        trace('ok', { op, notes });
        return result;
      };

      const consoleLog = (level: 'info' | 'warn' | 'error' | 'success', message: string, details?: any) => {
        trace('console', { level, message, details, position: bot.entity.position });
      };

      try {
        // Validate and coerce arguments
        const params = validateAndCoerceArgs(func.args, args);
        const formattedArgs = formatFunctionArgs(func.args, params);

        consoleLog('info', `📦 ${func.name}(${formattedArgs})`, {
          function: func.name,
          version: func.current_version,
          arguments: params
        });

        // Create function context with validated params as variables
        const funcContext: any = { ...baseSandbox };
        func.args.forEach((argDef, i) => {
          funcContext[argDef.name] = params[i];
        });

        // Execute function body in isolated context
        const wrappedBody = `(async () => { ${func.body} })()`;
        const context = vm.createContext(funcContext);
        const result = await vm.runInContext(wrappedBody, context, {
          filename: `function_${func.name}.js`,
          timeout: 30000 // 30 second timeout for individual functions
        });

        consoleLog('success', `✓ ${func.name} completed`, {
          function: func.name,
          result: result !== undefined ? result : '(no return value)',
          duration_ms: Date.now() - t0
        });

        ok(func.name, t0, { result });

        return result;
      } catch (err: any) {
        consoleLog('error', `✗ ${func.name} failed: ${err.message}`, {
          function: func.name,
          error: err.message,
          stack: err.stack,
          arguments: args
        });

        throw new ExecutionError('function_error', `Function ${func.name} failed: ${err.message}`, {
          function: func.name,
          original_error: err.message
        });
      }
    };
  }

  private createCommands(bot: Bot, options: JSExecutorOptions) {
    const trace = (kind: string, data: any) => {
      try { options.onTrace?.({ kind, ts: Date.now(), ...data }); } catch {}
    };

    const ok = (op: string, t0: number, notes?: any) => {
      const result = { ok: true, op, ms: Date.now() - t0, notes };
      try { options.onStep?.(result); } catch {}
      trace('ok', { op, notes });
      return result;
    };

    // Helper to create comprehensive console-style log entries
    const consoleLog = (level: 'info' | 'warn' | 'error' | 'success', message: string, details?: any) => {
      trace('console', { level, message, details, position: bot.entity.position });
    };

    // Helper to check if script has been aborted
    const checkAbort = () => {
      if (options.abortSignal?.aborted) {
        throw new ExecutionError('aborted', 'Script execution was canceled by user');
      }
    };

    // Helper to get current inventory snapshot
    const getInventorySnapshot = () => {
      const items = bot.inventory.items();
      return {
        total_slots: 36,
        used_slots: items.length,
        free_slots: 36 - items.length,
        items: items.map(i => ({ name: i.name, count: i.count, slot: i.slot }))
      };
    };

    // Helper to get nearby blocks snapshot
    const getNearbyBlocks = (center: Vec3, radius: number = 2) => {
      const blocks: any[] = [];
      for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
          for (let z = -radius; z <= radius; z++) {
            const pos = center.offset(x, y, z);
            const block = bot.blockAt(pos);
            if (block && block.name !== 'air') {
              blocks.push({
                name: block.name,
                position: { x: pos.x, y: pos.y, z: pos.z },
                distance: Math.sqrt(x*x + y*y + z*z)
              });
            }
          }
        }
      }
      return blocks.sort((a, b) => a.distance - b.distance);
    };

    return {
      // Movement
      goto: async (x: number, y: number, z: number, opts: any = {}) => {
        checkAbort();
        const t0 = Date.now();
        const tolerance = opts.tolerance ?? opts.tol ?? 0; // Default: exact position (no tolerance)
        const useSimple = opts.simple !== false; // Default to SimplePathfinder
        const from = { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z };
        const to = { x, y, z };
        const distance = bot.entity.position.distanceTo(new Vec3(x, y, z));

        consoleLog('info', `🚶 Moving from (${from.x.toFixed(1)}, ${from.y.toFixed(1)}, ${from.z.toFixed(1)}) to (${x}, ${y}, ${z})`, {
          distance: distance.toFixed(2),
          tolerance,
          from,
          to,
          pathfinder: useSimple ? 'SimplePathfinder' : 'mineflayer-pathfinder'
        });

        trace('movement', { cmd: 'goto', from, to, distance, tolerance });

        // Try SimplePathfinder first (better scaffolding support)
        if (useSimple) {
          try {
            const simplePathfinder = new SimplePathfinder(bot);
            const success = await simplePathfinder.goto(new Vec3(x, y, z), tolerance);
            checkAbort();

            if (success) {
              const actualDistance = bot.entity.position.distanceTo(new Vec3(x, y, z));
              consoleLog('success', `✓ Arrived at (${x}, ${y}, ${z}) via SimplePathfinder - ${actualDistance.toFixed(2)} blocks from target`, {
                final_position: { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z },
                distance_from_target: actualDistance.toFixed(2),
                pathfinder: 'SimplePathfinder'
              });
              ok('goto', t0, { world: [x, y, z], distance_traveled: distance.toFixed(2), pathfinder: 'simple' });
              return;
            }

            // SimplePathfinder couldn't find path, fall through to mineflayer
            consoleLog('warn', `⚠️ SimplePathfinder couldn't find path, trying mineflayer-pathfinder...`);
          } catch (simpleErr: any) {
            consoleLog('warn', `⚠️ SimplePathfinder error: ${simpleErr.message}, trying mineflayer-pathfinder...`);
          }
        }

        // Fallback to mineflayer-pathfinder
        const movements = new Movements(bot);
        movements.canDig = false;
        movements.allow1by1towers = false;
        bot.pathfinder.setMovements(movements);

        try {
          await bot.pathfinder.goto(new goals.GoalNear(x, y, z, tolerance));
          checkAbort();
          const actualDistance = bot.entity.position.distanceTo(new Vec3(x, y, z));
          consoleLog('success', `✓ Arrived at (${x}, ${y}, ${z}) via mineflayer-pathfinder - ${actualDistance.toFixed(2)} blocks from target`, {
            final_position: { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z },
            distance_from_target: actualDistance.toFixed(2),
            pathfinder: 'mineflayer-pathfinder'
          });
          ok('goto', t0, { world: [x, y, z], distance_traveled: distance.toFixed(2), pathfinder: 'mineflayer' });
        } catch (err: any) {
          consoleLog('error', `✗ Failed to reach (${x}, ${y}, ${z}): ${err.message}`, {
            from,
            to,
            attempted_distance: distance.toFixed(2),
            error: err.message
          });
          throw new ExecutionError('no_path', `Cannot reach ${x}, ${y}, ${z}: ${err.message}`);
        }
      },

      // Block interaction
      dig: async (x: number, y: number, z: number) => {
        checkAbort();
        const t0 = Date.now();
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);

        const targetPos = new Vec3(x, y, z);
        const distance = bot.entity.position.distanceTo(targetPos);
        const block = bot.blockAt(targetPos);

        consoleLog('info', `⛏️ Attempting to dig block at (${x}, ${y}, ${z})`, {
          block_type: block?.name || 'unknown',
          distance: distance.toFixed(2),
          position: { x, y, z },
          bot_position: { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z }
        });

        if (distance > 4.5) {
          consoleLog('error', `✗ Block too far away: ${distance.toFixed(2)} blocks (max 4.5)`, { distance: distance.toFixed(2) });
          throw new ExecutionError('out_of_reach',
            `Target at ${x},${y},${z} is ${distance.toFixed(1)} blocks away (max 4.5)`);
        }

        // Check gravity blocks overhead
        const above1 = bot.blockAt(targetPos.offset(0, 1, 0));
        const above2 = bot.blockAt(targetPos.offset(0, 2, 0));
        const isGravity = (b: any) => b && (b.name.includes('gravel') || b.name.includes('sand'));
        if (isGravity(above1) || isGravity(above2)) {
          consoleLog('warn', `⚠️ Gravity blocks detected above: ${above1?.name || 'none'}, ${above2?.name || 'none'}`, {
            above1: above1?.name,
            above2: above2?.name
          });
          throw new ExecutionError('unsafe_gravity',
            `Cannot break block because gravel/sand overhead would fall. Clear above first.`);
        }

        if (!block || block.name === 'air') {
          consoleLog('error', `✗ No block found at (${x}, ${y}, ${z})`, { nearby: getNearbyBlocks(targetPos, 1) });
          throw new ExecutionError('no_target', `No block at ${x},${y},${z}`);
        }

        // Equip best tool
        const harvest = block.harvestTools || (block as any)._properties?.harvestTools;
        let toolEquipped = null;
        if (harvest && Object.keys(harvest).length > 0) {
          const current = bot.heldItem;
          if (!current || !harvest[current.type]) {
            const tool = bot.inventory.items().find((item) => harvest[item.type]);
            if (tool) {
              await bot.equip(tool, 'hand');
              toolEquipped = tool.name;
              consoleLog('info', `🔧 Equipped ${tool.name} for mining ${block.name}`, { tool: tool.name });
            }
          } else {
            toolEquipped = current.name;
          }
        }

        const nearbyBefore = getNearbyBlocks(targetPos, 2);

        await bot.dig(block);
        checkAbort();

        const nearbyAfter = getNearbyBlocks(targetPos, 2);

        consoleLog('success', `✓ Mined ${block.name} at (${x}, ${y}, ${z})`, {
          block: block.name,
          position: { x, y, z },
          tool_used: toolEquipped || 'hand',
          duration_ms: Date.now() - t0,
          nearby_before: nearbyBefore.slice(0, 5),
          nearby_after: nearbyAfter.slice(0, 5),
          inventory: getInventorySnapshot()
        });

        // Log block change
        if (options.db && options.botId && options.jobId) {
          try {
            options.db.prepare(`
              INSERT INTO craftscript_block_changes (job_id, bot_id, timestamp, action, x, y, z, block_id, previous_block_id, command)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(options.jobId, options.botId, Math.floor(Date.now() / 1000), 'destroyed', x, y, z, block.name, null, 'dig');
          } catch {}
        }

        ok('dig', t0, { world: [x, y, z], id: block.name, tool: toolEquipped });
      },

      place: async (blockId: string, x: number, y: number, z: number) => {
        checkAbort();
        const t0 = Date.now();
        blockId = blockId.replace('minecraft:', '');
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);

        const targetPos = new Vec3(x, y, z);
        const item = bot.inventory.items().find((i) => i.name === blockId);

        consoleLog('info', `🧱 Attempting to place ${blockId} at (${x}, ${y}, ${z})`, {
          block: blockId,
          position: { x, y, z },
          inventory_count: item?.count || 0
        });

        if (!item) {
          consoleLog('error', `✗ ${blockId} not in inventory`, { inventory: getInventorySnapshot() });
          throw new ExecutionError('unavailable', `No ${blockId} in inventory`);
        }

        await bot.equip(item, 'hand');

        // Find reference block
        // For scaffolding, prioritize below/above (upward face placement)
        const isScaffolding = blockId === 'scaffolding';
        const candidates = isScaffolding
          ? [
              { dir: new Vec3(0, -1, 0), name: 'below' },  // Scaffolding: try below first
              { dir: new Vec3(0, 1, 0), name: 'above' },   // Then above
              { dir: new Vec3(1, 0, 0), name: 'east' },
              { dir: new Vec3(-1, 0, 0), name: 'west' },
              { dir: new Vec3(0, 0, 1), name: 'south' },
              { dir: new Vec3(0, 0, -1), name: 'north' }
            ]
          : [
              { dir: new Vec3(0, -1, 0), name: 'below' },
              { dir: new Vec3(0, 1, 0), name: 'above' },
              { dir: new Vec3(1, 0, 0), name: 'east' },
              { dir: new Vec3(-1, 0, 0), name: 'west' },
              { dir: new Vec3(0, 0, 1), name: 'south' },
              { dir: new Vec3(0, 0, -1), name: 'north' }
            ];

        let faceVector: Vec3 | null = null;
        let reference: any = null;
        let faceName = '';

        for (const {dir, name} of candidates) {
          const ref = bot.blockAt(targetPos.minus(dir));
          if (ref && ref.name !== 'air') {
            faceVector = dir;
            reference = ref;
            faceName = name;
            break;
          }
        }

        if (!reference || !faceVector) {
          const nearby = getNearbyBlocks(targetPos, 1);
          consoleLog('error', `✗ No reference block found adjacent to (${x}, ${y}, ${z})`, { nearby });
          throw new ExecutionError('unsupported_surface',
            `Cannot place at (${x},${y},${z}) - no solid reference block adjacent`);
        }

        consoleLog('info', `📍 Using ${reference.name} (${faceName}) as reference block`);

        const distance = bot.entity.position.distanceTo(targetPos);
        if (distance > 4.5) {
          consoleLog('error', `✗ Too far to place: ${distance.toFixed(2)} blocks (max 4.5)`, { distance: distance.toFixed(2) });
          throw new ExecutionError('out_of_reach',
            `Cannot place at (${x},${y},${z}) - target is ${distance.toFixed(1)} blocks away (max 4.5)`);
        }

        // Check if target is occupied
        const occupied = bot.blockAt(targetPos);
        const hasScaffolding = occupied && occupied.name === 'scaffolding';

        // Special case: scaffolding can be placed on scaffolding (stacks)
        if (occupied && occupied.name !== 'air' && occupied.name !== blockId) {
          // Allow scaffolding to stack on scaffolding
          if (!(isScaffolding && hasScaffolding)) {
            consoleLog('error', `✗ Position occupied by ${occupied.name}`, { occupied: occupied.name });
            throw new ExecutionError('occupied',
              `Target not empty: minecraft:${occupied.name}`);
          }
        }

        // Skip if block already present (but allow scaffolding on scaffolding)
        if (occupied && occupied.name === blockId && !(isScaffolding && hasScaffolding)) {
          consoleLog('info', `ℹ️ ${blockId} already present at (${x}, ${y}, ${z})`);
          ok('place', t0, { id: blockId, world: [x, y, z], already_present: true });
          return;
        }

        // Look at target (scaffolding: aim slightly lower to target upward face)
        const aim = isScaffolding && faceName === 'below'
          ? new Vec3(x + 0.5, y - 0.5 + 0.99, z + 0.5)  // Aim at top of block below
          : new Vec3(x + 0.5, y + 0.5, z + 0.5);
        await bot.lookAt(aim, true);

        const nearbyBefore = getNearbyBlocks(targetPos, 2);
        await bot.placeBlock(reference, faceVector);
        checkAbort();
        const nearbyAfter = getNearbyBlocks(targetPos, 2);

        consoleLog('success', `✓ Placed ${blockId} at (${x}, ${y}, ${z})`, {
          block: blockId,
          position: { x, y, z },
          reference_block: reference.name,
          reference_face: faceName,
          remaining_count: (item.count - 1),
          duration_ms: Date.now() - t0,
          nearby_before: nearbyBefore.slice(0, 5),
          nearby_after: nearbyAfter.slice(0, 5),
          inventory: getInventorySnapshot()
        });

        // Log block change
        if (options.db && options.botId && options.jobId) {
          try {
            const placedBlock = bot.blockAt(targetPos);
            if (placedBlock) {
              options.db.prepare(`
                INSERT INTO craftscript_block_changes (job_id, bot_id, timestamp, action, x, y, z, block_id, previous_block_id, command)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(options.jobId, options.botId, Math.floor(Date.now() / 1000), 'placed', x, y, z, placedBlock.name, occupied?.name || 'air', 'place');
            }
          } catch {}
        }

        ok('place', t0, { id: blockId, world: [x, y, z], reference: reference.name, face: faceName });
      },

      build_up: async (blockId: string) => {
        checkAbort();
        const t0 = Date.now();
        blockId = blockId.replace('minecraft:', '');

        const item = bot.inventory.items().find((i) => i.name === blockId);
        const startPos = { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z };

        consoleLog('info', `⬆️ Building up one block with ${blockId}`, {
          block: blockId,
          start_position: startPos,
          available: item?.count || 0
        });

        if (!item) {
          consoleLog('error', `✗ ${blockId} not in inventory`, { inventory: getInventorySnapshot() });
          throw new ExecutionError('unavailable', `No ${blockId} in inventory`);
        }

        await bot.equip(item, 'hand');

        // Get reference block (block we're standing on)
        const referencePos = new Vec3(
          Math.floor(bot.entity.position.x),
          Math.floor(bot.entity.position.y) - 1,
          Math.floor(bot.entity.position.z)
        );
        const referenceBlock = bot.blockAt(referencePos);

        if (!referenceBlock || referenceBlock.name === 'air') {
          consoleLog('error', `✗ No block to build on (floating in air)`, {
            reference_position: { x: referencePos.x, y: referencePos.y, z: referencePos.z }
          });
          throw new ExecutionError('no_reference', 'No block below to build on');
        }

        consoleLog('info', `🦶 Standing on ${referenceBlock.name} at (${referencePos.x}, ${referencePos.y}, ${referencePos.z})`);

        const jumpY = Math.floor(bot.entity.position.y) + 1.0;
        let placed = false;
        let tryCount = 0;
        const maxTries = 20;

        // Start jumping
        bot.setControlState('jump', true);

        const placeAttempt = async () => {
          checkAbort();

          // Check if we're high enough
          if (bot.entity.position.y > jumpY && !placed) {
            try {
              // Place block below us
              await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
              placed = true;
              bot.setControlState('jump', false);

              const finalPos = { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z };
              consoleLog('success', `✓ Built up successfully with ${blockId}`, {
                block: blockId,
                start_position: startPos,
                final_position: finalPos,
                height_gained: (finalPos.y - startPos.y).toFixed(2),
                duration_ms: Date.now() - t0
              });

              ok('build_up', t0, { block: blockId, height_gained: finalPos.y - startPos.y });
            } catch (err: any) {
              tryCount++;
              if (tryCount >= maxTries) {
                bot.setControlState('jump', false);
                consoleLog('error', `✗ Failed to build up after ${maxTries} tries: ${err.message}`, {
                  error: err.message,
                  tries: tryCount
                });
                throw new ExecutionError('build_up_failed', `Failed to place block below after ${maxTries} tries: ${err.message}`);
              }
            }
          }
        };

        // Poll position every 50ms while jumping
        return new Promise<void>((resolve, reject) => {
          const interval = setInterval(async () => {
            try {
              if (placed) {
                clearInterval(interval);
                resolve();
                return;
              }

              if (tryCount >= maxTries) {
                clearInterval(interval);
                bot.setControlState('jump', false);
                reject(new ExecutionError('build_up_failed', `Failed to build up after ${maxTries} tries`));
                return;
              }

              await placeAttempt();
            } catch (err) {
              clearInterval(interval);
              bot.setControlState('jump', false);
              reject(err);
            }
          }, 50);

          // Timeout after 5 seconds
          setTimeout(() => {
            if (!placed) {
              clearInterval(interval);
              bot.setControlState('jump', false);
              reject(new ExecutionError('build_up_timeout', 'Build up timed out after 5 seconds'));
            }
          }, 5000);
        });
      },

      build_scaffolding: async (x: number, y: number, z: number, height: number) => {
        checkAbort();
        const t0 = Date.now();
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);

        const blockId = 'scaffolding';
        const item = bot.inventory.items().find((i) => i.name === blockId);

        consoleLog('info', `🏗️ Building scaffolding tower at (${x}, ${y}, ${z}), height: ${height}`, {
          position: { x, y, z },
          height,
          inventory_count: item?.count || 0
        });

        if (!item) {
          consoleLog('error', `✗ No scaffolding in inventory`, { inventory: getInventorySnapshot() });
          throw new ExecutionError('unavailable', `No scaffolding in inventory`);
        }

        if (item.count < height) {
          consoleLog('warn', `⚠️ Only ${item.count} scaffolding available, need ${height}`, {
            available: item.count,
            needed: height
          });
        }

        await bot.equip(item, 'hand');

        // Check if we're close enough
        const targetPos = new Vec3(x + 0.5, y, z + 0.5);
        const distance = bot.entity.position.distanceTo(targetPos);
        if (distance > 4.5) {
          consoleLog('error', `✗ Too far: ${distance.toFixed(2)} blocks (max 4.5)`, { distance });
          throw new ExecutionError('out_of_reach', `Too far to place scaffolding (${distance.toFixed(1)} blocks away)`);
        }

        // Step 1: Place the first scaffolding block on the ground
        const basePos = new Vec3(x, y - 1, z);
        const baseBlock = bot.blockAt(basePos);

        if (!baseBlock || baseBlock.name === 'air') {
          consoleLog('error', `✗ No ground block at (${x}, ${y - 1}, ${z})`, {
            base_position: { x, y: y - 1, z }
          });
          throw new ExecutionError('no_ground', 'Need solid block to place scaffolding on');
        }

        consoleLog('info', `📍 Base block: ${baseBlock.name} at (${x}, ${y - 1}, ${z})`);

        // Place first scaffolding on top of base block
        const firstScaffoldPos = new Vec3(x, y, z);
        const existingBlock = bot.blockAt(firstScaffoldPos);

        let placed = 0;

        if (!existingBlock || existingBlock.name !== 'scaffolding') {
          try {
            // Look at the TOP face of the base block
            const aimPos = new Vec3(x + 0.5, y - 0.5 + 0.99, z + 0.5);
            await bot.lookAt(aimPos, true);
            await bot.placeBlock(baseBlock, new Vec3(0, 1, 0));
            placed++;
            consoleLog('success', `✓ Placed base scaffolding at (${x}, ${y}, ${z})`);
            await new Promise(resolve => setTimeout(resolve, 150));
            checkAbort();
          } catch (err: any) {
            consoleLog('error', `✗ Failed to place base scaffolding: ${err.message}`, { error: err.message });
            throw new ExecutionError('place_failed', `Failed to place base scaffolding: ${err.message}`);
          }
        } else {
          consoleLog('info', `ℹ️ Base scaffolding already exists at (${x}, ${y}, ${z})`);
          placed++;
        }

        // Step 2: CRITICAL - Bot must stand BESIDE the scaffolding, not on top!
        // Check bot position and reposition if needed
        const botX = Math.floor(bot.entity.position.x);
        const botZ = Math.floor(bot.entity.position.z);

        if (botX === x && botZ === z) {
          consoleLog('warn', `⚠️ Bot standing on target - this causes horizontal placement!`);
          // This will cause horizontal building - we need manual placement instead
          for (let i = placed; i < height; i++) {
            checkAbort();
            const currentY = y + i;
            const blockBelow = bot.blockAt(new Vec3(x, currentY - 1, z));

            if (!blockBelow || (blockBelow.name !== 'scaffolding' && i > 0)) {
              throw new ExecutionError('no_support', `No scaffolding below at y=${currentY - 1}`);
            }

            try {
              const aimPos = new Vec3(x + 0.5, currentY - 0.5 + 0.99, z + 0.5);
              await bot.lookAt(aimPos, true);
              await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
              placed++;
              consoleLog('success', `✓ Placed scaffolding ${placed}/${height} (manual - bot on top)`);
              await new Promise(resolve => setTimeout(resolve, 150));
            } catch (err: any) {
              consoleLog('error', `✗ Failed at layer ${i + 1}: ${err.message}`);
              throw new ExecutionError('place_failed', `Failed at layer ${i + 1}`);
            }
          }
        } else {
          // Bot is BESIDE the scaffolding - use auto-stacking with activateBlock
          consoleLog('info', `✓ Bot positioned beside scaffolding - using auto-stack mode`);

          for (let i = placed; i < height; i++) {
            checkAbort();

            try {
              const scaffoldBase = bot.blockAt(firstScaffoldPos);

              if (!scaffoldBase || scaffoldBase.name !== 'scaffolding') {
                throw new ExecutionError('no_scaffolding', `No scaffolding at base`);
              }

              // CRITICAL: Look at the SIDE (center Y) of the scaffolding, NOT the top!
              // This makes it build UPWARD instead of horizontal
              const lookPos = new Vec3(x + 0.5, y + 0.5, z + 0.5);
              await bot.lookAt(lookPos, true);

              // Activate - places new scaffolding ABOVE when looking at side
              await bot.activateBlock(scaffoldBase);

              placed++;
              consoleLog('success', `✓ Placed scaffolding ${placed}/${height} (auto-stack)`);
              await new Promise(resolve => setTimeout(resolve, 200));

            } catch (err: any) {
              consoleLog('error', `✗ Auto-stack failed at ${i + 1}: ${err.message}`);

              // Fallback to manual placement
              try {
                const currentY = y + i;
                const blockBelow = bot.blockAt(new Vec3(x, currentY - 1, z));

                if (blockBelow && blockBelow.name === 'scaffolding') {
                  const aimPos = new Vec3(x + 0.5, currentY - 0.5 + 0.99, z + 0.5);
                  await bot.lookAt(aimPos, true);
                  await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
                  placed++;
                  consoleLog('success', `✓ Placed scaffolding ${placed}/${height} (fallback)`);
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              } catch (fallbackErr: any) {
                consoleLog('error', `✗ Fallback failed: ${fallbackErr.message}`);
                throw new ExecutionError('place_failed', `Failed at layer ${i + 1}`);
              }
            }
          }
        }

        consoleLog('success', `✓ Scaffolding tower complete: ${placed}/${height} blocks`, {
          position: { x, y, z },
          placed,
          height,
          duration_ms: Date.now() - t0
        });

        ok('build_scaffolding', t0, { world: [x, y, z], height, placed });
      },

      // Inventory
      equip: async (itemId: string) => {
        checkAbort();
        const t0 = Date.now();
        itemId = itemId.replace('minecraft:', '');
        const previousItem = bot.heldItem?.name || 'none';
        const item = bot.inventory.items().find((i) => i.name === itemId);

        consoleLog('info', `🔧 Equippping ${itemId}`, { previous: previousItem, target: itemId });

        if (!item) {
          consoleLog('error', `✗ ${itemId} not in inventory`, { inventory: getInventorySnapshot() });
          throw new ExecutionError('unavailable', `No ${itemId} in inventory`);
        }

        await bot.equip(item, 'hand');
        checkAbort();

        consoleLog('success', `✓ Equipped ${itemId}`, {
          equipped: itemId,
          previous: previousItem,
          slot: item.slot
        });

        ok('equip', t0, { id: itemId, previous: previousItem });
      },

      wait: async (ms: number) => {
        checkAbort();
        const t0 = Date.now();
        if (ms < 0 || ms > 300000) {
          throw new ExecutionError('invalid_arg', 'wait time must be between 0 and 300000ms (5 minutes)');
        }

        consoleLog('info', `⏱️ Waiting ${ms}ms`, { duration_ms: ms });

        // Wait with periodic abort checking every 100ms
        const checkInterval = 100;
        let elapsed = 0;
        while (elapsed < ms) {
          checkAbort();
          const remaining = ms - elapsed;
          const sleepTime = Math.min(checkInterval, remaining);
          await new Promise(resolve => setTimeout(resolve, sleepTime));
          elapsed += sleepTime;
        }

        consoleLog('success', `✓ Wait complete`, { waited_ms: ms });

        ok('wait', t0, { ms });
      },

      pickup_blocks: async (radius: number = 8) => {
        checkAbort();
        const t0 = Date.now();
        if (radius < 0 || radius > 32) {
          throw new ExecutionError('invalid_arg', 'pickup radius must be between 0 and 32 blocks');
        }

        const invBefore = getInventorySnapshot();

        // Find nearby dropped items
        const items = Object.values(bot.entities)
          .filter((entity: any) => {
            if (entity.name !== 'item') return false;
            const dist = bot.entity.position.distanceTo(entity.position);
            return dist <= radius;
          });

        consoleLog('info', `📦 Searching for dropped items within ${radius} blocks`, {
          radius,
          found: items.length,
          inventory_before: `${invBefore.used_slots}/${invBefore.total_slots} slots`
        });

        if (items.length === 0) {
          consoleLog('info', `ℹ️ No items found within ${radius} blocks`);
          ok('pickup_blocks', t0, { radius, count: 0, total_found: 0 });
          return;
        }

        let pickedUp = 0;
        let failed = 0;

        // Ensure pathfinder won't break blocks during item collection
        const movements = new Movements(bot);
        movements.canDig = false;
        movements.allow1by1towers = false;
        bot.pathfinder.setMovements(movements);

        for (const item of items) {
          checkAbort();
          try {
            // Move close enough to pick up
            const dist = bot.entity.position.distanceTo(item.position);
            if (dist > 1) {
              await bot.pathfinder.goto(new goals.GoalNear(
                Math.floor(item.position.x),
                Math.floor(item.position.y),
                Math.floor(item.position.z),
                1
              ));
            }
            // Wait a bit for auto-pickup
            await new Promise(resolve => setTimeout(resolve, 500));
            checkAbort();
            pickedUp++;
          } catch (err: any) {
            failed++;
            consoleLog('warn', `⚠️ Failed to pick up item at (${item.position.x.toFixed(1)}, ${item.position.y.toFixed(1)}, ${item.position.z.toFixed(1)})`, {
              reason: err.message
            });
          }
        }

        const invAfter = getInventorySnapshot();

        consoleLog('success', `✓ Picked up ${pickedUp}/${items.length} items`, {
          picked_up: pickedUp,
          failed,
          total_found: items.length,
          inventory_before: `${invBefore.used_slots}/${invBefore.total_slots}`,
          inventory_after: `${invAfter.used_slots}/${invAfter.total_slots}`,
          new_items: invAfter.used_slots - invBefore.used_slots
        });

        ok('pickup_blocks', t0, { radius, count: pickedUp, total_found: items.length, failed });
      },

      // Inventory management
      toss: async (itemId: string, count?: number) => {
        checkAbort();
        const t0 = Date.now();
        itemId = itemId.replace('minecraft:', '');

        const item = bot.inventory.items().find((i) => i.name === itemId);

        // Debug logging for item search
        const allItemNames = bot.inventory.items().map(i => i.name);
        consoleLog('info', `🗑️ Attempting to toss ${itemId}`, {
          item: itemId,
          requested_count: count,
          available: item?.count || 0,
          item_found: !!item,
          all_inventory_items: allItemNames,
          exact_match: allItemNames.includes(itemId)
        });

        if (!item) {
          consoleLog('error', `✗ ${itemId} not in inventory`, {
            inventory: getInventorySnapshot(),
            searched_for: itemId,
            available_items: allItemNames,
            similar_items: allItemNames.filter((n: string) => n.includes('terracotta') || n.includes('brown'))
          });
          throw new ExecutionError('unavailable', `No ${itemId} in inventory`);
        }

        const tossCount = count !== undefined ? Math.min(count, item.count) : item.count;
        const invBefore = getInventorySnapshot();

        try {
          await bot.toss(item.type, null, tossCount);
          // Wait a bit for the server to process the transaction
          await new Promise(resolve => setTimeout(resolve, 100));
          checkAbort();
          const invAfter = getInventorySnapshot();

          consoleLog('success', `✓ Tossed ${tossCount} ${itemId}`, {
            item: itemId,
            count: tossCount,
            drop_position: { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z },
            remaining_count: (item.count - tossCount),
            inventory_before: `${invBefore.used_slots}/${invBefore.total_slots}`,
            inventory_after: `${invAfter.used_slots}/${invAfter.total_slots}`
          });

          ok('toss', t0, { item: itemId, count: tossCount, remaining: item.count - tossCount });
        } catch (err: any) {
          consoleLog('error', `✗ Failed to toss ${itemId}: ${err.message}`);
          throw new ExecutionError('toss_failed', `Failed to toss ${itemId}: ${err.message}`);
        }
      },

      open_container: async (x: number, y: number, z: number) => {
        checkAbort();
        const t0 = Date.now();
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);

        const targetPos = new Vec3(x, y, z);
        const block = bot.blockAt(targetPos);
        const distance = bot.entity.position.distanceTo(targetPos);

        consoleLog('info', `📦 Opening container at (${x}, ${y}, ${z})`, {
          position: { x, y, z },
          block_type: block?.name || 'unknown',
          distance: distance.toFixed(2)
        });

        if (!block) {
          consoleLog('error', `✗ No block at (${x}, ${y}, ${z})`, { nearby: getNearbyBlocks(targetPos, 1) });
          throw new ExecutionError('no_target', `No block at ${x},${y},${z}`);
        }

        // Check if it's a container
        const containerTypes = ['chest', 'barrel', 'shulker_box', 'hopper', 'dropper', 'dispenser', 'furnace', 'blast_furnace', 'smoker'];
        const isContainer = containerTypes.some(type => block.name.includes(type));

        if (!isContainer) {
          consoleLog('error', `✗ ${block.name} is not a container`, { block: block.name, expected: containerTypes });
          throw new ExecutionError('not_container', `Block at ${x},${y},${z} is ${block.name}, not a container`);
        }

        if (distance > 4.5) {
          consoleLog('error', `✗ Container too far: ${distance.toFixed(2)} blocks (max 4.5)`, { distance: distance.toFixed(2) });
          throw new ExecutionError('out_of_reach', `Container at ${x},${y},${z} is ${distance.toFixed(1)} blocks away (max 4.5)`);
        }

        try {
          const container = await bot.openContainer(block);
          checkAbort();
          // Store container reference for deposit/withdraw
          (bot as any)._currentContainer = container;
          (bot as any)._currentContainerPos = { x, y, z };
          (bot as any)._currentContainerType = block.name;

          const containerItems = container.slots.filter((slot: any) => slot).map((slot: any) => ({
            name: slot.name,
            count: slot.count,
            slot: slot.slot
          }));

          consoleLog('success', `✓ Opened ${block.name} with ${container.slots.length} slots`, {
            container_type: block.name,
            position: { x, y, z },
            total_slots: container.slots.length,
            used_slots: containerItems.length,
            items: containerItems
          });

          ok('open_container', t0, { block: block.name, world: [x, y, z], slots: container.slots.length, used: containerItems.length });
        } catch (err: any) {
          consoleLog('error', `✗ Failed to open ${block.name}: ${err.message}`);
          throw new ExecutionError('open_failed', `Failed to open container: ${err.message}`);
        }
      },

      deposit: async (itemId: string, count?: number) => {
        checkAbort();
        const t0 = Date.now();
        itemId = itemId.replace('minecraft:', '');

        const container = (bot as any)._currentContainer;
        const containerType = (bot as any)._currentContainerType || 'container';
        const containerPos = (bot as any)._currentContainerPos || {};

        if (!container) {
          consoleLog('error', `✗ No container is open`);
          throw new ExecutionError('no_container', 'No container is open. Use open_container first.');
        }

        const item = bot.inventory.items().find((i) => i.name === itemId);
        const invBefore = getInventorySnapshot();

        // Debug logging for item search
        const allItemNames = bot.inventory.items().map(i => i.name);
        consoleLog('info', `💼 Depositing ${itemId} into ${containerType}`, {
          item: itemId,
          requested_count: count,
          available: item?.count || 0,
          container: containerType,
          item_found: !!item,
          all_inventory_items: allItemNames,
          exact_match: allItemNames.includes(itemId)
        });

        if (!item) {
          consoleLog('error', `✗ ${itemId} not in inventory`, {
            inventory: invBefore,
            searched_for: itemId,
            available_items: allItemNames,
            similar_items: allItemNames.filter((n: string) => n.includes('terracotta') || n.includes('brown'))
          });
          throw new ExecutionError('unavailable', `No ${itemId} in inventory`);
        }

        const depositCount = count !== undefined ? Math.min(count, item.count) : item.count;

        try {
          await container.deposit(item.type, null, depositCount);
          // Wait a bit for the server to process the transaction
          await new Promise(resolve => setTimeout(resolve, 100));
          checkAbort();
          const invAfter = getInventorySnapshot();

          consoleLog('success', `✓ Deposited ${depositCount} ${itemId} into ${containerType}`, {
            item: itemId,
            count: depositCount,
            container: containerType,
            container_position: containerPos,
            remaining_in_inventory: (item.count - depositCount),
            inventory_before: `${invBefore.used_slots}/${invBefore.total_slots}`,
            inventory_after: `${invAfter.used_slots}/${invAfter.total_slots}`
          });

          ok('deposit', t0, { item: itemId, count: depositCount, remaining: item.count - depositCount });
        } catch (err: any) {
          consoleLog('error', `✗ Failed to deposit ${itemId}: ${err.message}`);
          throw new ExecutionError('deposit_failed', `Failed to deposit ${itemId}: ${err.message}`);
        }
      },

      withdraw: async (itemId: string, count?: number) => {
        checkAbort();
        const t0 = Date.now();
        itemId = itemId.replace('minecraft:', '');

        const container = (bot as any)._currentContainer;
        const containerType = (bot as any)._currentContainerType || 'container';
        const containerPos = (bot as any)._currentContainerPos || {};

        if (!container) {
          consoleLog('error', `✗ No container is open`);
          throw new ExecutionError('no_container', 'No container is open. Use open_container first.');
        }

        // Find item in container
        const containerItem = container.slots.find((slot: any) => slot && slot.name === itemId);
        const invBefore = getInventorySnapshot();

        // Debug logging for container search
        const containerContents = container.slots.filter((s: any) => s).map((s: any) => ({name: s.name, count: s.count}));
        const allContainerNames = containerContents.map((c: any) => c.name);
        consoleLog('info', `💰 Withdrawing ${itemId} from ${containerType}`, {
          item: itemId,
          requested_count: count,
          available: containerItem?.count || 0,
          container: containerType,
          item_found: !!containerItem,
          all_container_items: allContainerNames,
          exact_match: allContainerNames.includes(itemId)
        });

        if (!containerItem) {
          consoleLog('error', `✗ ${itemId} not in ${containerType}`, {
            container_contents: containerContents,
            searched_for: itemId,
            available_items: allContainerNames,
            similar_items: allContainerNames.filter((n: string) => n.includes('terracotta') || n.includes('brown'))
          });
          throw new ExecutionError('unavailable', `No ${itemId} in container`);
        }

        const withdrawCount = count !== undefined ? Math.min(count, containerItem.count) : containerItem.count;

        try {
          await container.withdraw(containerItem.type, null, withdrawCount);
          // Wait a bit for the server to process the transaction
          await new Promise(resolve => setTimeout(resolve, 100));
          checkAbort();
          const invAfter = getInventorySnapshot();

          consoleLog('success', `✓ Withdrew ${withdrawCount} ${itemId} from ${containerType}`, {
            item: itemId,
            count: withdrawCount,
            container: containerType,
            container_position: containerPos,
            remaining_in_container: (containerItem.count - withdrawCount),
            inventory_before: `${invBefore.used_slots}/${invBefore.total_slots}`,
            inventory_after: `${invAfter.used_slots}/${invAfter.total_slots}`
          });

          ok('withdraw', t0, { item: itemId, count: withdrawCount, remaining: containerItem.count - withdrawCount });
        } catch (err: any) {
          consoleLog('error', `✗ Failed to withdraw ${itemId}: ${err.message}`);
          throw new ExecutionError('withdraw_failed', `Failed to withdraw ${itemId}: ${err.message}`);
        }
      },

      close_container: async () => {
        checkAbort();
        const t0 = Date.now();

        const container = (bot as any)._currentContainer;
        const containerType = (bot as any)._currentContainerType || 'container';
        const containerPos = (bot as any)._currentContainerPos || {};

        if (!container) {
          consoleLog('error', `✗ No container is open`);
          throw new ExecutionError('no_container', 'No container is open');
        }

        consoleLog('info', `🔒 Closing ${containerType}`, { container: containerType, position: containerPos });

        try {
          await container.close();
          (bot as any)._currentContainer = null;
          (bot as any)._currentContainerType = null;
          (bot as any)._currentContainerPos = null;

          consoleLog('success', `✓ Closed ${containerType}`);

          ok('close_container', t0, { container: containerType });
        } catch (err: any) {
          consoleLog('error', `✗ Failed to close container: ${err.message}`);
          throw new ExecutionError('close_failed', `Failed to close container: ${err.message}`);
        }
      },

      // Look Control
      look_at: async (x: number, y: number, z: number) => {
        checkAbort();
        const t0 = Date.now();
        const target = new Vec3(x, y, z);
        const distance = bot.entity.position.distanceTo(target);

        consoleLog('info', `👁️ Looking at (${x}, ${y}, ${z})`, {
          target: { x, y, z },
          distance: distance.toFixed(2),
          current_position: { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z }
        });

        try {
          await bot.lookAt(target);
          checkAbort();

          consoleLog('success', `✓ Now looking at (${x}, ${y}, ${z})`, {
            duration_ms: Date.now() - t0
          });

          ok('look_at', t0, { target: { x, y, z } });
        } catch (err: any) {
          consoleLog('error', `✗ Failed to look at (${x}, ${y}, ${z}): ${err.message}`, {
            error: err.message,
            target: { x, y, z }
          });
          throw new ExecutionError('look_failed', err.message);
        }
      },

      // Crafting
      craft: async (itemId: string, count: number = 1, useCraftingTable: boolean = false) => {
        checkAbort();
        const t0 = Date.now();
        itemId = itemId.replace('minecraft:', '');

        const invBefore = getInventorySnapshot();

        consoleLog('info', `🔨 Attempting to craft ${count}x ${itemId}`, {
          item: itemId,
          count,
          requires_table: useCraftingTable,
          inventory_before: `${invBefore.used_slots}/${invBefore.total_slots}`
        });

        // Find item in registry
        const item = bot.registry.itemsByName[itemId];
        if (!item) {
          consoleLog('error', `✗ Unknown item: ${itemId}`, {
            item: itemId,
            available_items: Object.keys(bot.registry.itemsByName).filter(n => n.includes(itemId)).slice(0, 10)
          });
          throw new ExecutionError('unknown_item', `Unknown item: ${itemId}`);
        }

        // Find crafting table if required
        let craftingTable: any = null;
        if (useCraftingTable) {
          const tables = bot.findBlocks({
            matching: (block: any) => block?.name === 'crafting_table',
            maxDistance: 32,
            count: 1
          });

          if (tables.length === 0) {
            consoleLog('error', `✗ No crafting table found within 32 blocks`, {
              item: itemId,
              requires_table: true
            });
            throw new ExecutionError('no_crafting_table', 'No crafting table found nearby');
          }

          craftingTable = bot.blockAt(tables[0]);
          consoleLog('info', `🪵 Using crafting table at (${craftingTable.position.x}, ${craftingTable.position.y}, ${craftingTable.position.z})`, {
            distance: bot.entity.position.distanceTo(craftingTable.position).toFixed(2)
          });
        }

        // Get recipes
        const recipes = bot.recipesFor(item.id, null, count, craftingTable);
        if (recipes.length === 0) {
          consoleLog('error', `✗ No recipe found for ${itemId}`, {
            item: itemId,
            count,
            has_crafting_table: !!craftingTable,
            inventory: invBefore.items
          });
          throw new ExecutionError('no_recipe', `No recipe available for ${itemId}`);
        }

        const recipe = recipes[0];

        try {
          await bot.craft(recipe, count, craftingTable);
          checkAbort();

          const invAfter = getInventorySnapshot();

          consoleLog('success', `✓ Crafted ${count}x ${itemId}`, {
            item: itemId,
            count,
            duration_ms: Date.now() - t0,
            inventory_before: `${invBefore.used_slots}/${invBefore.total_slots}`,
            inventory_after: `${invAfter.used_slots}/${invAfter.total_slots}`,
            ingredients_used: recipe.ingredients || recipe.inShape
          });

          ok('craft', t0, { item: itemId, count });
        } catch (err: any) {
          const invAfter = getInventorySnapshot();

          consoleLog('error', `✗ Crafting failed: ${err.message}`, {
            error: err.message,
            item: itemId,
            count,
            recipe: recipe,
            inventory_before: invBefore.items,
            inventory_after: invAfter.items
          });

          throw new ExecutionError('craft_failed', err.message);
        }
      },

      log: (...args: any[]) => {
        console.log(`[Script ${options.jobId || 'unknown'}]`, ...args);
        trace('log', { messages: args });
      },

      // Predicates
      has_item: (itemId: string) => {
        itemId = itemId.replace('minecraft:', '');
        return bot.inventory.items().some(i => i.name === itemId);
      },

      is_air: (x: number, y: number, z: number) => {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        const block = bot.blockAt(new Vec3(x, y, z));
        return !block || block.name === 'air';
      },

      block_is: (x: number, y: number, z: number, id: string) => {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        id = id.replace('minecraft:', '');
        const block = bot.blockAt(new Vec3(x, y, z));
        return block?.name === id;
      },

      // Block Querying (read-only, safe)
      get_block: (x: number, y: number, z: number) => {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        const block = bot.blockAt(new Vec3(x, y, z));
        if (!block) return null;
        return {
          name: block.name,
          displayName: block.displayName,
          position: { x: block.position.x, y: block.position.y, z: block.position.z },
          hardness: block.hardness,
          type: block.type,
        };
      },

      find_blocks: (blockId: string, maxDistance: number = 32, count: number = 1) => {
        blockId = blockId.replace('minecraft:', '');
        // bot.findBlocks only finds solid blocks, so we need to manually scan for non-solid blocks like scaffolding
        const maxDist = Math.min(maxDistance, 128);
        const maxCount = Math.min(count, 1000);
        const botPos = bot.entity.position.floored();
        const found: Array<{ x: number; y: number; z: number }> = [];

        // Scan a cube around the bot
        for (let y = botPos.y - maxDist; y <= botPos.y + maxDist && found.length < maxCount; y++) {
          for (let x = botPos.x - maxDist; x <= botPos.x + maxDist && found.length < maxCount; x++) {
            for (let z = botPos.z - maxDist; z <= botPos.z + maxDist && found.length < maxCount; z++) {
              const pos = new Vec3(x, y, z);
              const dist = botPos.distanceTo(pos);
              if (dist > maxDist) continue;

              const block = bot.blockAt(pos);
              if (block && block.name === blockId) {
                found.push({ x, y, z });
              }
            }
          }
        }

        // Sort by distance
        return found.sort((a, b) => {
          const distA = botPos.distanceTo(new Vec3(a.x, a.y, a.z));
          const distB = botPos.distanceTo(new Vec3(b.x, b.y, b.z));
          return distA - distB;
        });
      },

      can_see_block: (x: number, y: number, z: number) => {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        const block = bot.blockAt(new Vec3(x, y, z));
        if (!block) return false;
        return bot.canSeeBlock(block);
      },

      // Entity Querying (read-only, safe)
      get_nearest_entity: (type?: string) => {
        let match: any;
        if (type) {
          type = type.replace('minecraft:', '');
          match = (entity: any) => entity.name === type || entity.type === type;
        }
        const entity = bot.nearestEntity(match);
        if (!entity) return null;
        return {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          position: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
          distance: bot.entity.position.distanceTo(entity.position),
        };
      },

      get_entities: (type?: string, maxDistance: number = 32) => {
        const entities = Object.values(bot.entities);
        let filtered = entities;

        if (type) {
          type = type.replace('minecraft:', '');
          filtered = entities.filter((e: any) => e.name === type || e.type === type);
        }

        return filtered
          .filter((e: any) => {
            const dist = bot.entity.position.distanceTo(e.position);
            return dist <= maxDistance && e.id !== bot.entity.id;
          })
          .map((e: any) => ({
            id: e.id,
            name: e.name,
            type: e.type,
            position: { x: e.position.x, y: e.position.y, z: e.position.z },
            distance: bot.entity.position.distanceTo(e.position),
          }))
          .sort((a: any, b: any) => a.distance - b.distance);
      },

      get_players: () => {
        const players = Object.values(bot.entities)
          .filter((e: any) => e.type === 'player' && e.username && e.id !== bot.entity.id);

        return players.map((p: any) => ({
          id: p.id,
          username: p.username,
          position: { x: p.position.x, y: p.position.y, z: p.position.z },
          distance: bot.entity.position.distanceTo(p.position),
        }))
        .sort((a: any, b: any) => a.distance - b.distance);
      },

      // Recipe Querying (read-only, safe)
      get_recipes: (itemId: string) => {
        itemId = itemId.replace('minecraft:', '');
        const item = bot.registry.itemsByName[itemId];
        if (!item) return [];

        const recipes = bot.recipesAll(item.id, null, null);
        return recipes.map((recipe: any) => ({
          ingredients: recipe.ingredients || recipe.inShape || recipe.ingredients,
          result: { name: recipe.result.name, count: recipe.result.count },
          requiresTable: recipe.requiresTable || false,
        }));
      },

      can_craft: (itemId: string, count: number = 1) => {
        itemId = itemId.replace('minecraft:', '');
        const item = bot.registry.itemsByName[itemId];
        if (!item) return false;

        const recipes = bot.recipesFor(item.id, null, count, null);
        return recipes.length > 0;
      },
    };
  }
}
