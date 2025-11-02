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
      tool(
        'dig_block',
        'Mine/dig a block at specific coordinates',
        {
          x: z.number().describe('X coordinate of block'),
          y: z.number().describe('Y coordinate of block'),
          z: z.number().describe('Z coordinate of block'),
        },
        async (params) => {
          try {
            const { x, y, z } = params;
            const block = bot.blockAt(new Vec3(x, y, z));

            if (!block) {
              return {
                content: [{ type: 'text', text: `No block found at (${x}, ${y}, ${z})` }],
                isError: true,
              };
            }

            if (block.name === 'air') {
              return {
                content: [{ type: 'text', text: `Block at (${x}, ${y}, ${z}) is already air` }],
              };
            }

            await bot.dig(block);
            const result = `Successfully dug ${block.name} at (${x}, ${y}, ${z})`;
            logToolExecution('dig_block', params, result);
            return {
              content: [{ type: 'text', text: result }],
            };
          } catch (error: any) {
            logToolExecution('dig_block', params, undefined, error);
            return {
              content: [{ type: 'text', text: `Failed to dig block: ${error.message}` }],
              isError: true,
            };
          }
        }
      ),

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

      tool(
        'find_block',
        'Find the nearest block of a specific type',
        {
          block_type: z.string().describe('Type of block to find (e.g., "oak_log", "stone")'),
          max_distance: z.number().optional().describe('Maximum search distance (default: 16)'),
        },
        async (params) => {
          try {
            const { block_type, max_distance = 16 } = params;
            const mcData = minecraftData(bot.version);
            const blockType = mcData.blocksByName[block_type];

            if (!blockType) {
              return {
                content: [{ type: 'text', text: `Unknown block type: ${block_type}` }],
                isError: true,
              };
            }

            const block = bot.findBlock({
              matching: blockType.id,
              maxDistance: max_distance,
            });

            if (!block) {
              return {
                content: [{ type: 'text', text: `No ${block_type} found within ${max_distance} blocks` }],
              };
            }

            const distance = Math.floor(bot.entity.position.distanceTo(block.position));
            const result = `Found ${block_type} at (${block.position.x}, ${block.position.y}, ${block.position.z}) - ${distance} blocks away`;
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
            bot.chat(params.message);
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
    ],
  });
}
