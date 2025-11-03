import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';
import fs from 'fs/promises';
import path from 'path';
import { MinecraftBot } from '../bot/MinecraftBot.js';
import { logToolExecution } from '../logger.js';
import { findTrees } from '../tools/tree_felling/find_trees.js';
import { getTreeStructure } from '../tools/tree_felling/get_tree_structure.js';
import { checkReachable } from '../tools/tree_felling/check_reachable.js';
import { breakBlockAndWait } from '../tools/tree_felling/break_block_and_wait.js';
import { collectNearbyItems } from '../tools/tree_felling/collect_nearby_items.js';
import { waitForSaplings } from '../tools/tree_felling/wait_for_saplings.js';
import { findPlantableGround } from '../tools/tree_felling/find_plantable_ground.js';
import { placeSapling } from '../tools/tree_felling/place_sapling.js';
import { buildPillar, descendPillarSafely } from '../tools/tree_felling/build_pillar.js';
import { open_chest } from '../tools/inventory/open_chest.js';
import { deposit_items } from '../tools/inventory/deposit_items.js';
import { withdraw_items } from '../tools/inventory/withdraw_items.js';
import { findStone } from '../tools/mining/find_stone.js';
import { find_block } from '../tools/mining/find_block.js';
import { dig_block } from '../tools/mining/dig_block.js';
import { dig_upward } from '../tools/mining/dig_upward.js';
import { dig_straight_up } from '../tools/mining/dig_straight_up.js';
import { dig_staircase_step } from '../tools/mining/dig_staircase_step.js';
import { debug_dig } from '../tools/mining/debug_dig.js';
import { detectTimeOfDay } from '../tools/world/detect_time_of_day.js';
import { detect_biome, scan_biomes_in_area } from '../tools/world/detect_biome.js';
import { getNearbyBlocks } from '../tools/world/get_nearby_blocks.js';
import { analyze_surroundings } from '../tools/world/analyze_surroundings.js';
import { get_block_info } from '../tools/mining/get_block_info.js';
import { report_status } from '../tools/colony/report_status.js';
import { find_ores } from '../tools/exploration/find_ores.js';
import { find_water } from '../tools/exploration/find_water.js';
import { find_flat_area } from '../tools/exploration/find_flat_area.js';
import {
  set_waypoint,
  list_waypoints,
  delete_waypoint,
  get_waypoint,
  find_nearest_waypoint,
} from '../tools/navigation/waypoints.js';

/**
 * Create MCP server with all Minecraft tools for the Claude Agent SDK
 */
export function createMinecraftMcpServer(minecraftBot: MinecraftBot) {
  const bot = minecraftBot.getBot();

  return createSdkMcpServer({
    name: 'minecraft',
    version: '1.0.0',
    tools: [
      // ====================
      // Planner/Queue Tools (MAS)
      // ====================
      tool(
        'enqueue_job',
        'Enqueue a new intent job for the MAS queue. Returns a job id. This is the primary way to initiate tasks.',
        {
          bot_id: z.string().optional().describe('Target bot id/name (default: current)'),
          priority: z.enum(['high', 'normal', 'low']).optional(),
          intent: z.object({
            type: z.string().describe('Intent type (e.g., NAVIGATE, HARVEST_TREE)'),
            args: z.record(z.any()).default({}),
            constraints: z.record(z.any()).optional(),
            target: z.any().optional(),
            stop_conditions: z.string().optional(),
          }),
        },
        async (params) => {
          try {
            const { enqueuePlannerJob } = await import('../mas/planner.js');
            const jobId = enqueuePlannerJob(params as any, bot.username);
            return { content: [{ type: 'text', text: jobId }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),

      tool(
        'get_job_status',
        'Get status of a MAS job by id.',
        { id: z.string().describe('Job id') },
        async ({ id }) => {
          try {
            const { MasDatabase } = await import('../mas/db.js');
            const { JobQueue } = await import('../mas/queue.js');
            const db = new MasDatabase();
            const queue = new JobQueue(db);
            const status = queue.getJobStatus(id);
            if (!status) return { content: [{ type: 'text', text: 'not_found' }], isError: true };
            return { content: [{ type: 'text', text: JSON.stringify(status) }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),

      tool(
        'pause_job',
        'Pause a MAS job by id.',
        { id: z.string() },
        async ({ id }) => {
          const { MasDatabase } = await import('../mas/db.js');
          const { JobQueue } = await import('../mas/queue.js');
          const db = new MasDatabase();
          const queue = new JobQueue(db);
          queue.pauseJob(id);
          return { content: [{ type: 'text', text: 'ok' }] };
        }
      ),

      tool(
        'resume_job',
        'Resume a paused MAS job by id.',
        { id: z.string() },
        async ({ id }) => {
          const { MasDatabase } = await import('../mas/db.js');
          const { JobQueue } = await import('../mas/queue.js');
          const db = new MasDatabase();
          const queue = new JobQueue(db);
          queue.resumeJob(id);
          return { content: [{ type: 'text', text: 'ok' }] };
        }
      ),

      tool(
        'cancel_job',
        'Cancel a MAS job by id.',
        { id: z.string() },
        async ({ id }) => {
          const { MasDatabase } = await import('../mas/db.js');
          const { JobQueue } = await import('../mas/queue.js');
          const db = new MasDatabase();
          const queue = new JobQueue(db);
          queue.cancelJob(id);
          return { content: [{ type: 'text', text: 'ok' }] };
        }
      ),

      // ====================
      // Position & Movement Tools
      // ====================
      tool(
        'get_position',
        'Get the current position of the bot in the world',
        {},
        async () => {
          try {
            if (!bot.entity) {
              return {
                content: [{ type: 'text', text: 'Bot has not spawned yet. Please wait.' }],
              };
            }
            const pos = bot.entity.position;
            const result = `Current position: (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`;
            logToolExecution('get_position', {}, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('get_position', {}, undefined, error);
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'move_to_position',
        'Move the bot to a specific coordinate position using pathfinding',
        {
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
          z: z.number().describe('Z coordinate'),
          range: z.number().optional().describe('How close to get to the target (default: 1)'),
        },
        async (params) => {
          try {
            const { x, y, z, range = 1 } = params;
            const goal = new goals.GoalNear(x, y, z, range);
            await bot.pathfinder.goto(goal);
            const result = `Successfully moved to position near (${x}, ${y}, ${z})`;
            logToolExecution('move_to_position', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('move_to_position', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Failed to move: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'look_at',
        'Make the bot look at a specific position',
        {
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
          z: z.number().describe('Z coordinate'),
        },
        async (params) => {
          try {
            const { x, y, z } = params;
            await bot.lookAt(new Vec3(x, y, z), true);
            const result = `Looking at (${x}, ${y}, ${z})`;
            logToolExecution('look_at', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('look_at', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Failed to look at position: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Navigation & Waypoint Tools
      // ====================
      tool(
        'set_waypoint',
        'Create or update a waypoint at specific coordinates. Waypoints persist between sessions and help with navigation and exploration.',
        {
          name: z.string().describe('Unique waypoint name (e.g., "home", "oak_forest_1")'),
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
          z: z.number().describe('Z coordinate'),
          description: z
            .string()
            .optional()
            .describe('Optional description (e.g., "Main base with crafting table")'),
        },
        async (params) => {
          try {
            const { name, x, y, z, description } = params;
            const result = await set_waypoint(bot, bot.username, name, x, y, z, description);
            logToolExecution('set_waypoint', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('set_waypoint', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error setting waypoint: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'list_waypoints',
        'List all saved waypoints with distances from current position. Shows waypoints grouped by dimension.',
        {},
        async () => {
          try {
            const result = await list_waypoints(bot, bot.username);
            logToolExecution('list_waypoints', {}, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('list_waypoints', {}, undefined, error);
            return {
              content: [{ type: 'text', text: `Error listing waypoints: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'delete_waypoint',
        'Delete a waypoint by name. Use this to remove outdated or temporary waypoints.',
        {
          name: z.string().describe('Name of waypoint to delete'),
        },
        async (params) => {
          try {
            const { name } = params;
            const result = await delete_waypoint(bot.username, name);
            logToolExecution('delete_waypoint', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('delete_waypoint', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error deleting waypoint: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'get_waypoint',
        'Get coordinates of a specific waypoint by name. Useful for navigation planning.',
        {
          name: z.string().describe('Name of waypoint to retrieve'),
        },
        async (params) => {
          try {
            const { name } = params;
            const waypoint = await get_waypoint(bot.username, name);

            if (!waypoint) {
              return {
                content: [{ type: 'text', text: `Waypoint "${name}" not found` }],
              };
            }

            const desc = waypoint.description ? ` - ${waypoint.description}` : '';
            const result = `Waypoint "${name}": (${waypoint.x}, ${waypoint.y}, ${waypoint.z})${desc}`;
            logToolExecution('get_waypoint', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('get_waypoint', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error getting waypoint: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'find_nearest_waypoint',
        'Find the nearest waypoint to current position in the current dimension.',
        {},
        async () => {
          try {
            const result = await find_nearest_waypoint(bot, bot.username);
            logToolExecution('find_nearest_waypoint', {}, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_nearest_waypoint', {}, undefined, error);
            return {
              content: [{ type: 'text', text: `Error finding nearest waypoint: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Inventory Tools
      // ====================
      tool(
        'list_inventory',
        'List all items currently in the bot inventory',
        {},
        async () => {
          try {
            const items = bot.inventory
              .items()
              .map((item) => `${item.name} x${item.count}`)
              .join(', ');

            const result = items || 'Inventory is empty';
            logToolExecution('list_inventory', {}, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('list_inventory', {}, undefined, error);
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'find_item',
        'Find if an item exists in the bot inventory',
        {
          name: z.string().describe('Name or partial name of the item to find'),
        },
        async (params) => {
          try {
            const item = bot.inventory.items().find((item) => item.name.includes(params.name));
            const result = item
              ? `Found ${item.name} x${item.count} in inventory`
              : `No item matching "${params.name}" found in inventory`;

            logToolExecution('find_item', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_item', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'drop_item',
        'Drop an item stack (or portion) from the inventory at the current position',
        {
          name: z.string().describe('Name or partial name of the item to drop'),
          count: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('How many items to drop (defaults to the full stack)'),
        },
        async (params) => {
          try {
            const inventoryItem = bot
              .inventory
              .items()
              .find((item) => item.name.includes(params.name));

            if (!inventoryItem) {
              return {
                content: [{ type: 'text', text: `No item matching "${params.name}" found in inventory` }],
                isError: true,
              };
            }

            const dropCount = params.count ?? inventoryItem.count;
            const safeCount = Math.min(dropCount, inventoryItem.count);

            if (safeCount <= 0) {
              return {
                content: [{ type: 'text', text: 'Nothing to drop (count was zero)' }],
                isError: true,
              };
            }

            if (safeCount === inventoryItem.count) {
              await bot.tossStack(inventoryItem);
            } else {
              await bot.toss(inventoryItem.type, inventoryItem.metadata, safeCount);
            }

            const result = `Dropped ${safeCount}x ${inventoryItem.name} at (${Math.floor(
              bot.entity.position.x
            )}, ${Math.floor(bot.entity.position.y)}, ${Math.floor(bot.entity.position.z)})`;
            logToolExecution('drop_item', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('drop_item', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Failed to drop item: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'equip_item',
        'Equip an item from inventory to hand or armor slot',
        {
          name: z.string().describe('Name of the item to equip'),
          destination: z
            .enum(['hand', 'head', 'torso', 'legs', 'feet'])
            .optional()
            .describe('Where to equip the item (default: hand)'),
        },
        async (params) => {
          try {
            const item = bot.inventory.items().find((item) => item.name.includes(params.name));
            if (!item) {
              return {
                content: [{ type: 'text', text: `No item matching "${params.name}" found in inventory` }],
                isError: true,
              };
            }

            await bot.equip(item, params.destination || 'hand');
            const result = `Equipped ${item.name} to ${params.destination || 'hand'}`;
            logToolExecution('equip_item', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('equip_item', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Failed to equip item: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Chest/Storage Tools
      // ====================
      tool(
        'open_chest',
        'Open a chest at specific coordinates and view its contents',
        {
          x: z.number().describe('X coordinate of chest'),
          y: z.number().describe('Y coordinate of chest'),
          z: z.number().describe('Z coordinate of chest'),
        },
        async (params) => {
          try {
            const result = await open_chest(bot, params);
            logToolExecution('open_chest', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('open_chest', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error opening chest: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'deposit_items',
        'Deposit items from bot inventory into a chest at specific coordinates',
        {
          x: z.number().describe('X coordinate of chest'),
          y: z.number().describe('Y coordinate of chest'),
          z: z.number().describe('Z coordinate of chest'),
          item_name: z.string().describe('Name of item to deposit (e.g., "oak_log", "cobblestone")'),
          count: z.number().optional().describe('Number of items to deposit (optional, defaults to all)'),
        },
        async (params) => {
          try {
            const result = await deposit_items(bot, params);
            logToolExecution('deposit_items', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('deposit_items', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error depositing items: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'withdraw_items',
        'Withdraw items from a chest at specific coordinates into bot inventory',
        {
          x: z.number().describe('X coordinate of chest'),
          y: z.number().describe('Y coordinate of chest'),
          z: z.number().describe('Z coordinate of chest'),
          item_name: z.string().describe('Name of item to withdraw (e.g., "oak_log", "cobblestone")'),
          count: z.number().optional().describe('Number of items to withdraw (optional, defaults to all)'),
        },
        async (params) => {
          try {
            const result = await withdraw_items(bot, params);
            logToolExecution('withdraw_items', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('withdraw_items', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error withdrawing items: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Crafting Tools
      // ====================
      tool(
        'craft_item',
        'Craft an item using available materials in inventory. Use a crafting table if needed.',
        {
          item_name: z.string().describe('Name of the item to craft (e.g., "wooden_pickaxe", "crafting_table", "stick")'),
          count: z.number().optional().describe('Number of items to craft (default: 1)'),
        },
        async (params) => {
          try {
            const { item_name, count = 1 } = params;
            const mcData = minecraftData(bot.version);
            const item = mcData.itemsByName[item_name];

            if (!item) {
              return {
                content: [{ type: 'text', text: `Unknown item: ${item_name}` }],
                isError: true,
              };
            }

            // Find crafting table if needed
            let craftingTable = bot.findBlock({
              matching: mcData.blocksByName.crafting_table?.id,
              maxDistance: 4,
            });

            // Get recipes for this item
            const recipes = bot.recipesFor(item.id, null, 1, craftingTable);

            if (recipes.length === 0) {
              return {
                content: [{ type: 'text', text: `No recipe found for ${item_name}. ${!craftingTable ? 'A crafting table may be required.' : ''}` }],
                isError: true,
              };
            }

            const recipe = recipes[0];

            // If recipe needs a crafting table but we don't have one nearby, report it
            if (recipe.requiresTable && !craftingTable) {
              return {
                content: [{ type: 'text', text: `Recipe for ${item_name} requires a crafting table, but none found within 4 blocks` }],
                isError: true,
              };
            }

            // Perform the craft
            await bot.craft(recipe, count, craftingTable || undefined);

            const result = `Successfully crafted ${count}x ${item_name}`;
            logToolExecution('craft_item', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('craft_item', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Failed to craft: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Block Interaction Tools
      // ====================
      // (dig_block moved to Mining Tools section below)

      tool(
        'place_block',
        'Place a block at specific coordinates',
        {
          blockName: z.string().describe('Name of the block to place (e.g., "oak_log", "dirt")'),
          x: z.number().describe('X coordinate where to place the block'),
          y: z.number().describe('Y coordinate where to place the block'),
          z: z.number().describe('Z coordinate where to place the block'),
          faceDirection: z
            .enum(['bottom', 'top', 'north', 'south', 'west', 'east'])
            .optional()
            .describe('Which face of the adjacent block to place against (default: bottom)'),
        },
        async (params) => {
          try {
            const { blockName, x, y, z, faceDirection = 'bottom' } = params;

            // Find the block in inventory
            const item = bot.inventory.items().find((item) => item.name === blockName);
            if (!item) {
              return {
                content: [{ type: 'text', text: `No ${blockName} found in inventory` }],
                isError: true,
              };
            }

            // Equip the block
            await bot.equip(item, 'hand');

            const targetPos = new Vec3(x, y, z);

            // Define face vectors
            const faceVectors = {
              bottom: new Vec3(0, -1, 0),
              top: new Vec3(0, 1, 0),
              north: new Vec3(0, 0, -1),
              south: new Vec3(0, 0, 1),
              west: new Vec3(-1, 0, 0),
              east: new Vec3(1, 0, 0),
            };

            const faceVec = faceVectors[faceDirection];
            const referencePos = targetPos.plus(faceVec);
            const referenceBlock = bot.blockAt(referencePos);

            if (!referenceBlock || referenceBlock.name === 'air') {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No reference block at (${referencePos.x}, ${referencePos.y}, ${referencePos.z}) to place against`,
                  },
                ],
                isError: true,
              };
            }

            // CRITICAL: Negate the face vector for placeBlock (learned from previous bug)
            const placeFaceVec = faceVec.scaled(-1);
            await bot.placeBlock(referenceBlock, placeFaceVec);

            const result = `Placed ${blockName} at (${x}, ${y}, ${z})`;
            logToolExecution('place_block', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('place_block', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Failed to place block: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // find_block tool is defined later in the mining section (line ~1015) using the imported function

      // ====================
      // Entity Interaction Tools
      // ====================
      tool(
        'find_entity',
        'Find nearby players or mobs',
        {
          type: z.enum(['player', 'mob', 'any']).optional().describe('Type of entity to find (default: player)'),
          max_distance: z.number().optional().describe('Maximum search distance (default: 16)'),
        },
        async (params) => {
          try {
            const { type = 'player', max_distance = 16 } = params;

            const entities = Object.values(bot.entities).filter((entity: any) => {
              if (entity === bot.entity) return false;

              const distance = entity.position.distanceTo(bot.entity.position);
              if (distance > max_distance) return false;

              if (type === 'player') return entity.type === 'player';
              if (type === 'mob') return entity.type === 'mob';
              return true;
            });

            if (entities.length === 0) {
              return {
                content: [{ type: 'text', text: `No ${type}s found within ${max_distance} blocks` }],
              };
            }

            const entityList = entities
              .map((entity: any) => {
                const pos = entity.position;
                const distance = Math.floor(entity.position.distanceTo(bot.entity.position));
                return `${entity.username || entity.name || entity.type} at (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}) - ${distance} blocks`;
              })
              .join('\n');

            const result = `Found ${entities.length} ${type}(s):\n${entityList}`;
            logToolExecution('find_entity', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_entity', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error finding entities: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Communication Tools
      // ====================
      tool(
        'send_chat',
        'Send a message to all players in the chat',
        {
          message: z.string().describe('The message to send'),
        },
        async (params) => {
          try {
            // Use wrapper for rate-limited chat
            minecraftBot.chat(params.message);
            const result = `Sent: ${params.message}`;
            logToolExecution('send_chat', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('send_chat', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Failed to send message: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'get_recent_chat',
        'Get recent chat messages from other players',
        {
          count: z.number().optional().describe('Number of recent messages to retrieve (default: 5)'),
        },
        async (params) => {
          try {
            const count = params.count || 5;
            const recentChat = minecraftBot.getChatHistory(count);

            if (recentChat.length === 0) {
              return {
                content: [{ type: 'text', text: 'No recent chat messages' }],
              };
            }

            const chatList = recentChat.map((msg) => `${msg.username}: ${msg.message}`).join('\n');
            const result = `Recent chat:\n${chatList}`;
            logToolExecution('get_recent_chat', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('get_recent_chat', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'read_diary_entries',
        'Read recent entries from the agent diary markdown (logs/diary.md)',
        {
          limit: z
            .number()
            .int()
            .min(1)
            .max(10)
            .optional()
            .describe('How many recent diary entries to return (default: 3, max: 10)'),
        },
        async (params) => {
          const diaryPath = path.resolve(process.cwd(), 'logs', 'diary.md');
          const limit = params.limit ?? 3;

          try {
            const file = await fs.readFile(diaryPath, 'utf-8');
            const entryMatches = file.match(/## [^\n]+\n[\s\S]*?(?=\n## |\s*$)/g) || [];

            if (entryMatches.length === 0) {
              const result = 'Diary exists but contains no entries yet.';
              logToolExecution('read_diary_entries', params, result);
              return {
                content: [{ type: 'text', text: result }],
              };
            }

            const selected = entryMatches.slice(-Math.min(limit, 10));
            const result = selected.join('\n\n').trim();
            logToolExecution('read_diary_entries', params, `Returned ${selected.length} entries`);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            if (error.code === 'ENOENT') {
              const result = 'Diary not found. No diary entries have been created yet.';
              logToolExecution('read_diary_entries', params, result);
              return {
                content: [{ type: 'text', text: result }],
              };
            }

            logToolExecution('read_diary_entries', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Failed to read diary: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Tree Felling Tools
      // ====================
      tool(
        'find_trees',
        'Find all trees near the bot, returning positions, heights, and tree types sorted by distance',
        {
          radius: z.number().optional().describe('Search radius in blocks (default: 50)'),
          types: z
            .array(z.string())
            .optional()
            .describe('Specific tree types to find (e.g., ["oak", "spruce"]). If not specified, finds all trees'),
        },
        async (params) => {
          try {
            const result = await findTrees(bot, params.radius, params.types || []);
            logToolExecution('find_trees', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_trees', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error finding trees: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'get_tree_structure',
        'Analyze a specific tree to understand its structure (1x1 vs 2x2, height, all log positions)',
        {
          x: z.number().describe('X coordinate of tree base'),
          y: z.number().describe('Y coordinate of tree base'),
          z: z.number().describe('Z coordinate of tree base'),
        },
        async (params) => {
          try {
            const result = await getTreeStructure(bot, params.x, params.y, params.z);
            logToolExecution('get_tree_structure', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('get_tree_structure', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error analyzing tree: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'check_reachable',
        'Check if a block position is reachable by the bot, or if scaffolding is needed',
        {
          x: z.number().describe('X coordinate of target block'),
          y: z.number().describe('Y coordinate of target block'),
          z: z.number().describe('Z coordinate of target block'),
        },
        async (params) => {
          try {
            const result = await checkReachable(bot, params.x, params.y, params.z);
            logToolExecution('check_reachable', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('check_reachable', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error checking reachability: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'break_block_and_wait',
        'Break a block at specific coordinates and wait for item drops to spawn. Use instead of dig_block when you need the drops.',
        {
          x: z.number().describe('X coordinate of the block to break'),
          y: z.number().describe('Y coordinate of the block to break'),
          z: z.number().describe('Z coordinate of the block to break'),
        },
        async (params) => {
          try {
            const result = await breakBlockAndWait(bot, params.x, params.y, params.z);
            logToolExecution('break_block_and_wait', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('break_block_and_wait', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error breaking block: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'collect_nearby_items',
        'Collect all nearby dropped items, with optional filters',
        {
          item_types: z.array(z.string()).optional().describe('Specific item types to collect (e.g., ["oak_log", "sapling"])'),
          radius: z.number().optional().describe('Search radius in blocks (default: 10)'),
        },
        async (params) => {
          try {
            const result = await collectNearbyItems(
              bot,
              params.item_types,
              params.radius
            );
            logToolExecution('collect_nearby_items', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('collect_nearby_items', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error collecting items: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'wait_for_saplings',
        'Wait for leaves to decay and saplings to drop at a specific location, tracking progress',
        {
          x: z.number().describe('X coordinate of tree location'),
          y: z.number().describe('Y coordinate of tree location'),
          z: z.number().describe('Z coordinate of tree location'),
          timeout: z.number().optional().describe('Maximum time to wait in seconds (default: 30)'),
        },
        async (params) => {
          try {
            const result = await waitForSaplings(
              bot,
              params.x,
              params.y,
              params.z,
              params.timeout
            );
            logToolExecution('wait_for_saplings', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('wait_for_saplings', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error waiting for saplings: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'find_plantable_ground',
        'Find suitable dirt or grass blocks nearby for planting saplings',
        {
          x: z.number().describe('X coordinate to search near'),
          y: z.number().describe('Y coordinate to search near'),
          z: z.number().describe('Z coordinate to search near'),
          radius: z.number().optional().describe('Search radius (default: 10)'),
        },
        async (params) => {
          try {
            const result = await findPlantableGround(bot, params.x, params.y, params.z, params.radius);
            logToolExecution('find_plantable_ground', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_plantable_ground', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error finding plantable ground: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'place_sapling',
        'Place a sapling at a specific position. Validates the location has suitable ground, light, and inventory.',
        {
          x: z.number().describe('X coordinate where the sapling should be placed'),
          y: z.number().describe('Y coordinate where the sapling should be placed'),
          z: z.number().describe('Z coordinate where the sapling should be placed'),
          sapling_type: z
            .enum(['oak_sapling', 'spruce_sapling', 'birch_sapling', 'jungle_sapling', 'acacia_sapling', 'dark_oak_sapling'])
            .describe('Type of sapling to place'),
        },
        async (params) => {
          try {
            const result = await placeSapling(bot, params.x, params.y, params.z, params.sapling_type);
            logToolExecution('place_sapling', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('place_sapling', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error placing sapling: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'build_pillar',
        'Jump and place blocks beneath to rise up (pillar jumping)',
        {
          height: z.number().describe('How many blocks to rise up'),
          descend_after: z.boolean().optional().describe('Whether to descend after building (default: false)'),
        },
        async (params) => {
          try {
            const result = await buildPillar(bot, params.height, params.descend_after);
            logToolExecution('build_pillar', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('build_pillar', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error building pillar: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'descend_pillar_safely',
        'Safely descend from a pillar by breaking blocks beneath',
        {},
        async () => {
          try {
            const result = await descendPillarSafely(bot);
            logToolExecution('descend_pillar_safely', {}, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('descend_pillar_safely', {}, undefined, error);
            return {
              content: [{ type: 'text', text: `Error descending pillar: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Mining Tools
      // ====================
      tool(
        'find_stone',
        'Find accessible stone deposits (surface, cliff, or cave) within search radius, sorted by distance',
        {
          radius: z.number().optional().describe('Search radius in blocks (default: 32)'),
          stone_types: z
            .array(z.string())
            .optional()
            .describe('Specific stone types to find (e.g., ["stone", "cobblestone", "granite"]). If not specified, finds all stone types'),
        },
        async (params) => {
          try {
            const result = await findStone(bot, params.radius, params.stone_types || []);
            logToolExecution('find_stone', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_stone', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error finding stone: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'find_block',
        'Find blocks of a specific type (stone, coal_ore, iron_ore, dirt, etc.) within radius, returns coordinates and distances',
        {
          blockType: z.string().describe('Block type to find (e.g., "stone", "coal_ore", "iron_ore", "dirt")'),
          maxDistance: z.number().optional().describe('Maximum search radius in blocks (default: 32)'),
          count: z.number().optional().describe('Maximum number of blocks to return (default: 10)'),
        },
        async (params) => {
          try {
            const result = await find_block(minecraftBot, params);
            logToolExecution('find_block', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_block', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error finding block: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'dig_block',
        'Mine/dig a single block at specific coordinates. Block must be within reach (~4.5 blocks)',
        {
          x: z.number().describe('X coordinate of block to mine'),
          y: z.number().describe('Y coordinate of block to mine'),
          z: z.number().describe('Z coordinate of block to mine'),
        },
        async (params) => {
          try {
            const result = await dig_block(minecraftBot, params);
            logToolExecution('dig_block', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('dig_block', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error digging block: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'dig_upward',
        'Dig upward to escape underground/caves and reach the surface. Creates safe staircase (default) or digs straight up. Detects light level to know when surface is reached.',
        {
          steps: z.number().optional().describe('Number of staircase steps to dig (default: 5)'),
          mode: z.enum(['staircase', 'straight']).optional().describe('Mode: staircase (safe, default) or straight (risky)'),
        },
        async (params) => {
          try {
            const result = await dig_upward(minecraftBot, params);
            logToolExecution('dig_upward', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('dig_upward', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error digging upward: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'dig_straight_up',
        'SIMPLER alternative to dig_upward. Digs straight up by breaking blocks 1-2 spaces above the bot. More reliable for escaping caves/underground. Detects light level to know when reaching surface.',
        {
          blocks: z.number().optional().describe('Number of blocks to dig upward (default: 10)'),
        },
        async (params) => {
          try {
            const result = await dig_straight_up(minecraftBot, params);
            logToolExecution('dig_straight_up', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('dig_straight_up', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error digging straight up: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'dig_staircase_step',
        'RECOMMENDED: Dig ONE step of an upward staircase following proper Minecraft player mechanics (2-block tall player, 3-block clearance). Digs forward, above-forward, and above-head, then moves up. Call repeatedly until reaching surface (light >= 10). Much more reliable than other dig tools!',
        {},
        async () => {
          try {
            const result = await dig_staircase_step(minecraftBot);
            logToolExecution('dig_staircase_step', {}, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('dig_staircase_step', {}, undefined, error);
            return {
              content: [{ type: 'text', text: `Error digging staircase step: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'debug_dig',
        'DEBUG TOOL: Attempt to dig a single block above and report detailed diagnostic information about why digging may not be working',
        {},
        async () => {
          try {
            const result = await debug_dig(minecraftBot);
            logToolExecution('debug_dig', {}, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('debug_dig', {}, undefined, error);
            return {
              content: [{ type: 'text', text: `Error in debug_dig: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'get_block_info',
        'Get detailed information about a block at specific coordinates (type, hardness, tool requirements, reachability)',
        {
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
          z: z.number().describe('Z coordinate'),
        },
        async (params) => {
          try {
            const result = await get_block_info(minecraftBot, params);
            logToolExecution('get_block_info', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('get_block_info', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error getting block info: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Exploration & Scouting Tools
      // ====================
      tool(
        'find_ores',
        'Find ore blocks (coal, iron, diamond, etc.) within radius. Returns exact coordinates and distances sorted by proximity. Use for locating mining resources.',
        {
          oreType: z.string().optional().describe('Specific ore type: "coal_ore", "iron_ore", "diamond_ore", etc. Omit to find all ores'),
          maxDistance: z.number().optional().describe('Maximum search radius in blocks (default: 32)'),
          count: z.number().optional().describe('Maximum number of results to return (default: 10)'),
        },
        async (params) => {
          try {
            const result = await find_ores(minecraftBot, params);
            logToolExecution('find_ores', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_ores', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error finding ores: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'find_water',
        'Find water sources within radius. Returns coordinates, distances, and water depth. Useful for fishing, farming, or boat navigation.',
        {
          maxDistance: z.number().optional().describe('Maximum search radius in blocks (default: 64)'),
          count: z.number().optional().describe('Maximum number of results to return (default: 5)'),
          minDepth: z.number().optional().describe('Minimum water depth required (default: 2, suitable for fishing/boats)'),
        },
        async (params) => {
          try {
            const result = await find_water(minecraftBot, params);
            logToolExecution('find_water', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_water', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error finding water: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'find_flat_area',
        'Find flat areas suitable for building structures. Returns coordinates, dimensions, and distances. Use before building bases or farms.',
        {
          minSize: z.number().optional().describe('Minimum flat area size in blocks (default: 5, creates 5x5 area)'),
          maxDistance: z.number().optional().describe('Maximum search radius in blocks (default: 32)'),
          count: z.number().optional().describe('Maximum number of results to return (default: 3)'),
        },
        async (params) => {
          try {
            const result = await find_flat_area(minecraftBot, params);
            logToolExecution('find_flat_area', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('find_flat_area', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error finding flat area: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // World Information Tools
      // ====================
      tool(
        'detect_time_of_day',
        'Get current Minecraft time, day/night status, and safety information for mob spawning. Critical for night safety protocols.',
        {},
        async () => {
          try {
            const result = await detectTimeOfDay(bot);
            logToolExecution('detect_time_of_day', {}, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('detect_time_of_day', {}, undefined, error);
            return {
              content: [{ type: 'text', text: `Error detecting time: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'detect_biome',
        'Detect the biome at current position or specified coordinates. Returns biome name, temperature, rainfall, and characteristics (surface blocks, trees, water).',
        {
          x: z.number().optional().describe('X coordinate (defaults to bot position)'),
          y: z.number().optional().describe('Y coordinate (defaults to bot position)'),
          z: z.number().optional().describe('Z coordinate (defaults to bot position)'),
        },
        async (params) => {
          try {
            const { x, y, z } = params;
            const result = await detect_biome(bot, x, y, z);
            logToolExecution('detect_biome', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('detect_biome', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error detecting biome: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'analyze_surroundings',
        'Analyze block density and composition around bot to understand environment (deep underground, cave, tunnel, open area). Provides directional density data and strategic recommendations for navigation.',
        {
          radius: z.number().optional().describe('Horizontal radius to scan (default: 8)'),
          verticalRange: z.number().optional().describe('Vertical range above/below (default: 2)'),
        },
        async (params) => {
          try {
            const result = await analyze_surroundings(minecraftBot, params);
            logToolExecution('analyze_surroundings', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('analyze_surroundings', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error analyzing surroundings: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'scan_biomes_in_area',
        'Scan a radius around current position to find all unique biomes nearby. Useful for exploration, finding biome boundaries, and locating specific biomes.',
        {
          centerX: z.number().optional().describe('Center X coordinate (defaults to bot position)'),
          centerZ: z.number().optional().describe('Center Z coordinate (defaults to bot position)'),
          radius: z.number().optional().default(50).describe('Scan radius in blocks (default: 50)'),
        },
        async (params) => {
          try {
            const { centerX, centerZ, radius = 50 } = params;
            const result = await scan_biomes_in_area(bot, centerX, centerZ, radius);
            logToolExecution('scan_biomes_in_area', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('scan_biomes_in_area', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error scanning biomes: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      tool(
        'get_nearby_blocks',
        'Get information about all blocks in a radius around the bot. Shows block distribution and interesting blocks with coordinates. Essential for understanding immediate surroundings.',
        {
          radius: z.number().optional().default(5).describe('Search radius in blocks (default: 5)'),
          includeAir: z.boolean().optional().default(false).describe('Include air blocks in results (default: false)'),
        },
        async (params) => {
          try {
            const { radius = 5, includeAir = false } = params;
            const result = await getNearbyBlocks(bot, radius, includeAir);
            logToolExecution('get_nearby_blocks', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('get_nearby_blocks', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error getting nearby blocks: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

      // ====================
      // Colony Coordination Tools
      // ====================
      tool(
        'report_status',
        'Generate comprehensive bot status report for colony coordination. Shows health, position, inventory, current task, and warnings. Can broadcast to other bots.',
        {
          include_inventory: z.boolean().optional().describe('Include detailed inventory summary (default: true)'),
          include_waypoints: z.boolean().optional().describe('Include waypoints in report (default: false)'),
          broadcast: z.boolean().optional().describe('Broadcast status summary to chat (default: false)'),
        },
        async (params) => {
          try {
            const result = await report_status(bot, params);
            logToolExecution('report_status', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('report_status', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Error generating status report: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),
    ],
  });
}

/**
 * Create a restricted MCP server for the Planner only (read-only + job controls + send_chat).
 */
export function createPlannerMcpServer(minecraftBot: MinecraftBot) {
  const bot = minecraftBot.getBot();

  const plannerToolNames = [
    'enqueue_job','get_job_status','pause_job','resume_job','cancel_job',
    'get_position','list_waypoints','get_waypoint',
    'detect_time_of_day','detect_biome','scan_biomes_in_area','get_nearby_blocks','analyze_surroundings',
    'send_chat'
  ];

  const server: any = createSdkMcpServer({
    name: 'minecraft',
    version: '1.0.0-planner',
    tools: [
      // Job controls
      tool(
        'enqueue_job',
        'Enqueue a new intent job for the MAS queue. Returns a job id.',
        {
          bot_id: z.string().optional(),
          priority: z.enum(['high', 'normal', 'low']).optional(),
          intent: z.object({
            type: z.string(),
            args: z.record(z.any()).default({}),
            constraints: z.record(z.any()).optional(),
            target: z.any().optional(),
            stop_conditions: z.string().optional(),
          }),
        },
        async (params) => {
          try {
            const { enqueuePlannerJob } = await import('../mas/planner.js');
            const jobId = enqueuePlannerJob(params as any, bot.username);
            return { content: [{ type: 'text', text: jobId }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),
      tool(
        'get_job_status',
        'Get status of a MAS job by id.',
        { id: z.string() },
        async ({ id }) => {
          try {
            const { MasDatabase } = await import('../mas/db.js');
            const { JobQueue } = await import('../mas/queue.js');
            const db = new MasDatabase();
            const queue = new JobQueue(db);
            const status = queue.getJobStatus(id);
            if (!status) return { content: [{ type: 'text', text: 'not_found' }], isError: true };
            return { content: [{ type: 'text', text: JSON.stringify(status) }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),
      tool(
        'pause_job',
        'Pause a MAS job by id.',
        { id: z.string() },
        async ({ id }) => {
          const { MasDatabase } = await import('../mas/db.js');
          const { JobQueue } = await import('../mas/queue.js');
          const db = new MasDatabase();
          const queue = new JobQueue(db);
          queue.pauseJob(id);
          return { content: [{ type: 'text', text: 'ok' }] };
        }
      ),
      tool(
        'resume_job',
        'Resume a paused MAS job by id.',
        { id: z.string() },
        async ({ id }) => {
          const { MasDatabase } = await import('../mas/db.js');
          const { JobQueue } = await import('../mas/queue.js');
          const db = new MasDatabase();
          const queue = new JobQueue(db);
          queue.resumeJob(id);
          return { content: [{ type: 'text', text: 'ok' }] };
        }
      ),
      tool(
        'cancel_job',
        'Cancel a MAS job by id.',
        { id: z.string() },
        async ({ id }) => {
          const { MasDatabase } = await import('../mas/db.js');
          const { JobQueue } = await import('../mas/queue.js');
          const db = new MasDatabase();
          const queue = new JobQueue(db);
          queue.cancelJob(id);
          return { content: [{ type: 'text', text: 'ok' }] };
        }
      ),

      // Read-only world/context
      tool(
        'get_position',
        'Get the current position of the bot in the world',
        {},
        async () => {
          try {
            if (!bot.entity) {
              return { content: [{ type: 'text', text: 'Bot has not spawned yet. Please wait.' }] };
            }
            const pos = bot.entity.position;
            const result = `Current position: (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`;
            return { content: [{ type: 'text', text: result }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),
      tool(
        'list_waypoints',
        'List all saved waypoints with distances from current position.',
        {},
        async () => {
          try {
            const { list_waypoints } = await import('../tools/navigation/waypoints.js');
            const result = await list_waypoints(bot, bot.username);
            return { content: [{ type: 'text', text: result }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error listing waypoints: ${error.message}` }], isError: true };
          }
        }
      ),
      tool(
        'get_waypoint',
        'Get coordinates of a specific waypoint by name.',
        { name: z.string() },
        async ({ name }) => {
          try {
            const { get_waypoint } = await import('../tools/navigation/waypoints.js');
            const wp = await get_waypoint(bot.username, name);
            if (!wp) return { content: [{ type: 'text', text: `Waypoint "${name}" not found` }] };
            const desc = wp.description ? ` - ${wp.description}` : '';
            const result = `Waypoint "${name}": (${wp.x}, ${wp.y}, ${wp.z})${desc}`;
            return { content: [{ type: 'text', text: result }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),
      tool(
        'detect_time_of_day',
        'Detects the current time of day in Minecraft',
        {},
        async () => {
          try {
            const res = await detectTimeOfDay(bot);
            return { content: [{ type: 'text', text: res }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),
      tool(
        'detect_biome',
        'Detects biome at current position',
        {},
        async () => {
          try {
            const res = await detect_biome(bot);
            return { content: [{ type: 'text', text: res }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),
      tool(
        'scan_biomes_in_area',
        'Scan nearby biomes within a radius',
        { radius: z.number().min(1).max(64) },
        async ({ radius }) => {
          try {
            const res = await scan_biomes_in_area(bot, radius);
            return { content: [{ type: 'text', text: res }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),
      tool(
        'get_nearby_blocks',
        'Get nearby blocks around the bot within a radius',
        { radius: z.number().min(1).max(16).optional() },
        async ({ radius = 6 }) => {
          try {
            const res = await getNearbyBlocks(bot, radius);
            return { content: [{ type: 'text', text: JSON.stringify(res) }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),
      tool(
        'analyze_surroundings',
        'Analyze surroundings and summarize nearby features',
        {},
        async () => {
          try {
            const res = await analyze_surroundings(minecraftBot);
            return { content: [{ type: 'text', text: res }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
          }
        }
      ),

      // Communication
      tool(
        'send_chat',
        'Send a message to all players in the chat',
        { message: z.string() },
        async ({ message }) => {
          try {
            minecraftBot.chat(message);
            return { content: [{ type: 'text', text: `Sent: ${message}` }] };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `Failed to send message: ${error.message}` }], isError: true };
          }
        }
      ),
    ],
  });

  // Ensure a manifest with tool names is present for allow-listing / inspection
  if (!server.manifest) {
    server.manifest = { name: 'minecraft', tools: plannerToolNames.map((n) => ({ name: n })) };
  }
  return server;
}
