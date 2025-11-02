import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';
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
import { send_bot_message } from '../tools/messaging/send_bot_message.js';
import { read_bot_messages } from '../tools/messaging/read_bot_messages.js';
import { get_health } from '../tools/combat/get_health.js';
import { eat_food } from '../tools/combat/eat_food.js';
import { attack_entity } from '../tools/combat/attack_entity.js';
import { till_soil } from '../tools/farming/till_soil.js';
import { feed_entity } from '../tools/farming/feed_entity.js';
import { shear_sheep } from '../tools/farming/shear_sheep.js';
import { milk_cow } from '../tools/farming/milk_cow.js';
import { use_bone_meal } from '../tools/farming/use_bone_meal.js';
import { set_waypoint } from '../tools/navigation/set_waypoint.js';
import { list_waypoints } from '../tools/navigation/list_waypoints.js';
import { delete_waypoint } from '../tools/navigation/delete_waypoint.js';
import { craft_item } from '../tools/crafting/craft_item.js';
import { smelt_item } from '../tools/crafting/smelt_item.js';
import { equip_item } from '../tools/inventory/equip_item.js';
import { drop_item } from '../tools/inventory/drop_item.js';
import { collect_items } from '../tools/inventory/collect_items.js';
import { open_chest } from '../tools/inventory/open_chest.js';
import { deposit_items } from '../tools/inventory/deposit_items.js';
import { withdraw_items } from '../tools/inventory/withdraw_items.js';
import { findStone } from '../tools/mining/find_stone.js';
import { get_block_info } from '../tools/mining/get_block_info.js';
import { report_status } from '../tools/colony/report_status.js';
import { detectTimeOfDay } from '../tools/world/detect_time_of_day.js';
import { detect_biome, scan_biomes_in_area } from '../tools/world/detect_biome.js';
import { getNearbyBlocks } from '../tools/world/get_nearby_blocks.js';
import { find_ores } from '../tools/exploration/find_ores.js';
import { find_water } from '../tools/exploration/find_water.js';
import { find_flat_area } from '../tools/exploration/find_flat_area.js';

/**
 * Tool definitions for Claude Agent SDK
 * These tools give Claude the ability to interact with the Minecraft world
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: any) => Promise<string>;
}

export function createTools(minecraftBot: MinecraftBot): ToolDefinition[] {
  const bot = minecraftBot.getBot();

  return [
    // Position and Movement Tools
    {
      name: 'get_position',
      description: 'Get the current position of the bot in the world',
      input_schema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        try {
          if (!bot.entity) {
            return 'Bot has not spawned yet. Please wait.';
          }
          const pos = bot.entity.position;
          const result = `Current position: (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`;
          logToolExecution('get_position', {}, result);
          return result;
        } catch (error: any) {
          logToolExecution('get_position', {}, undefined, error);
          throw error;
        }
      },
    },
    {
      name: 'move_to_position',
      description: 'Move the bot to a specific coordinate position using pathfinding',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          z: { type: 'number', description: 'Z coordinate' },
          range: { type: 'number', description: 'How close to get to the target (default: 1)' },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number; range?: number }) => {
        try {
          const { x, y, z, range = 1 } = params;
          const goal = new goals.GoalNear(x, y, z, range);
          await bot.pathfinder.goto(goal);
          const result = `Successfully moved to position near (${x}, ${y}, ${z})`;
          logToolExecution('move_to_position', params, result);
          return result;
        } catch (error: any) {
          logToolExecution('move_to_position', params, undefined, error);
          return `Failed to move: ${error.message}`;
        }
      },
    },
    {
      name: 'look_at',
      description: 'Make the bot look at a specific position',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          z: { type: 'number', description: 'Z coordinate' },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number }) => {
        try {
          const { x, y, z } = params;
          await bot.lookAt(new Vec3(x, y, z), true);
          const result = `Looking at position (${x}, ${y}, ${z})`;
          logToolExecution('look_at', params, result);
          return result;
        } catch (error: any) {
          logToolExecution('look_at', params, undefined, error);
          return `Failed to look: ${error.message}`;
        }
      },
    },

    // Inventory Tools
    {
      name: 'list_inventory',
      description: 'List all items currently in the bot\'s inventory',
      input_schema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        try {
          const items = bot.inventory.items();
          if (items.length === 0) {
            return 'Inventory is empty';
          }
          const itemList = items
            .map((item) => `- ${item.name} (x${item.count})`)
            .join('\n');
          const result = `Found ${items.length} items in inventory:\n${itemList}`;
          logToolExecution('list_inventory', {}, result);
          return result;
        } catch (error: any) {
          logToolExecution('list_inventory', {}, undefined, error);
          throw error;
        }
      },
    },
    {
      name: 'find_item',
      description: 'Find a specific item in the bot\'s inventory by name',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name or partial name of the item to find' },
        },
        required: ['name'],
      },
      execute: async (params: { name: string }) => {
        try {
          const items = bot.inventory.items();
          const item = items.find((item) => item.name.includes(params.name.toLowerCase()));
          if (item) {
            const result = `Found ${item.count}x ${item.name} in inventory`;
            logToolExecution('find_item', params, result);
            return result;
          } else {
            const result = `Couldn't find any item matching '${params.name}' in inventory`;
            logToolExecution('find_item', params, result);
            return result;
          }
        } catch (error: any) {
          logToolExecution('find_item', params, undefined, error);
          throw error;
        }
      },
    },
    {
      name: 'drop_item',
      description: 'Drop an item (or partial stack) from inventory at the bot\'s current position',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name or partial name of the item to drop' },
          count: {
            type: 'number',
            description: 'How many items to drop (defaults to the full stack)',
          },
        },
        required: ['name'],
      },
      execute: async (params: { name: string; count?: number }) => {
        try {
          const inventoryItem = bot
            .inventory
            .items()
            .find((item) => item.name.includes(params.name.toLowerCase()));

          if (!inventoryItem) {
            const result = `No item matching '${params.name}' found in inventory`;
            logToolExecution('drop_item', params, result);
            return result;
          }

          const requested = params.count ?? inventoryItem.count;
          const dropCount = Math.min(requested, inventoryItem.count);

          if (dropCount <= 0) {
            const result = `Invalid drop count (${params.count ?? 0})`;
            logToolExecution('drop_item', params, result);
            return result;
          }

          if (dropCount === inventoryItem.count) {
            await bot.tossStack(inventoryItem);
          } else {
            await bot.toss(inventoryItem.type, inventoryItem.metadata, dropCount);
          }

          const position = bot.entity.position;
          const result = `Dropped ${dropCount}x ${inventoryItem.name} at (${Math.floor(
            position.x
          )}, ${Math.floor(position.y)}, ${Math.floor(position.z)})`;
          logToolExecution('drop_item', params, result);
          return result;
        } catch (error: any) {
          const result = `Failed to drop item: ${error.message}`;
          logToolExecution('drop_item', params, undefined, error);
          return result;
        }
      },
    },
    {
      name: 'equip_item',
      description: 'Equip a specific item to hand or armor slot',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the item to equip' },
          destination: { type: 'string', description: 'Where to equip: hand, head, torso, legs, feet (default: hand)' },
        },
        required: ['name'],
      },
      execute: async (params: { name: string; destination?: string }) => {
        try {
          const items = bot.inventory.items();
          const item = items.find((item) => item.name.includes(params.name.toLowerCase()));
          if (!item) {
            return `Couldn't find any item matching '${params.name}' in inventory`;
          }
          await bot.equip(item, (params.destination || 'hand') as any);
          const result = `Equipped ${item.name} to ${params.destination || 'hand'}`;
          logToolExecution('equip_item', params, result);
          return result;
        } catch (error: any) {
          logToolExecution('equip_item', params, undefined, error);
          return `Failed to equip: ${error.message}`;
        }
      },
    },

    // Block Interaction Tools
    {
      name: 'dig_block',
      description: 'Dig/mine a block at a specific position',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          z: { type: 'number', description: 'Z coordinate' },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number }) => {
        try {
          const { x, y, z } = params;
          const blockPos = new Vec3(x, y, z);
          const block = bot.blockAt(blockPos);

          if (!block || block.name === 'air') {
            return `No block found at position (${x}, ${y}, ${z})`;
          }

          if (!bot.canDigBlock(block) || !bot.canSeeBlock(block)) {
            // Try to move closer
            const goal = new goals.GoalNear(x, y, z, 2);
            await bot.pathfinder.goto(goal);
          }

          await bot.dig(block);
          const result = `Dug ${block.name} at (${x}, ${y}, ${z})`;
          logToolExecution('dig_block', params, result);
          return result;
        } catch (error: any) {
          logToolExecution('dig_block', params, undefined, error);
          return `Failed to dig: ${error.message}`;
        }
      },
    },
    {
      name: 'place_block',
      description:
        'Place a block at a specific position. The block will be placed from your inventory.',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate where to place the block' },
          y: { type: 'number', description: 'Y coordinate where to place the block' },
          z: { type: 'number', description: 'Z coordinate where to place the block' },
          blockName: {
            type: 'string',
            description:
              'Name of the block to place (e.g., "oak_log", "oak_planks", "cobblestone")',
          },
          faceDirection: {
            type: 'string',
            description:
              'Direction to place against: "bottom", "top", "north", "south", "east", "west" (default: "bottom")',
          },
        },
        required: ['x', 'y', 'z', 'blockName'],
      },
      execute: async (params: {
        x: number;
        y: number;
        z: number;
        blockName: string;
        faceDirection?: string;
      }) => {
        try {
          const { x, y, z, blockName, faceDirection = 'bottom' } = params;

          // Find the item in inventory
          const item = bot.inventory.items().find((i) => i.name === blockName);
          if (!item) {
            return `Cannot place block: ${blockName} not found in inventory`;
          }

          // Equip the item
          await bot.equip(item, 'hand');

          // The reference block is the block we're placing against
          const faceVectorMap: Record<string, Vec3> = {
            bottom: new Vec3(0, -1, 0),
            top: new Vec3(0, 1, 0),
            north: new Vec3(0, 0, -1),
            south: new Vec3(0, 0, 1),
            east: new Vec3(1, 0, 0),
            west: new Vec3(-1, 0, 0),
          };

          const faceVec = faceVectorMap[faceDirection] || faceVectorMap['bottom'];
          const targetPos = new Vec3(x, y, z);
          const referencePos = targetPos.plus(faceVec);
          const referenceBlock = bot.blockAt(referencePos);

          if (!referenceBlock || referenceBlock.name === 'air') {
            return `Cannot place block at (${x}, ${y}, ${z}): no reference block at (${referencePos.x}, ${referencePos.y}, ${referencePos.z}) to place against`;
          }

          // Check if target position is within reach
          const distance = bot.entity.position.distanceTo(targetPos);
          if (distance > 4.5) {
            return `Cannot place block: position (${x}, ${y}, ${z}) is too far away (${distance.toFixed(1)} blocks). Move closer first.`;
          }

          // Place the block with timeout to avoid hanging
          // IMPORTANT: placeBlock expects faceVector to point FROM reference block TO target
          // So we need to negate our faceVec which points FROM target TO reference
          const placeFaceVec = faceVec.scaled(-1);

          try {
            await Promise.race([
              bot.placeBlock(referenceBlock, placeFaceVec),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 2000)
              ),
            ]);
          } catch (err: any) {
            // If timeout or error, verify if block was actually placed
            await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay for server update
            const placedBlock = bot.blockAt(targetPos);
            if (placedBlock && placedBlock.name !== 'air') {
              // Block was placed successfully despite timeout
              const result = `Placed ${blockName} at (${x}, ${y}, ${z})`;
              logToolExecution('place_block', params, result);
              return result;
            }
            throw err; // Block wasn't placed, rethrow error
          }

          const result = `Placed ${blockName} at (${x}, ${y}, ${z})`;
          logToolExecution('place_block', params, result);
          return result;
        } catch (error: any) {
          logToolExecution('place_block', params, undefined, error);
          return `Failed to place block: ${error.message}`;
        }
      },
    },
    {
      name: 'find_block',
      description: 'Find the nearest block of a specific type within a given distance',
      input_schema: {
        type: 'object',
        properties: {
          block_type: { type: 'string', description: 'Type of block to find (e.g., "oak_log", "stone")' },
          max_distance: { type: 'number', description: 'Maximum search distance (default: 16)' },
        },
        required: ['block_type'],
      },
      execute: async (params: { block_type: string; max_distance?: number }) => {
        try {
          const mcData = minecraftData(bot.version);
          const blocksByName = mcData.blocksByName;

          if (!blocksByName[params.block_type]) {
            return `Unknown block type: ${params.block_type}`;
          }

          const blockId = blocksByName[params.block_type].id;
          const block = bot.findBlock({
            matching: blockId,
            maxDistance: params.max_distance || 16,
          });

          if (!block) {
            return `No ${params.block_type} found within ${params.max_distance || 16} blocks`;
          }

          const result = `Found ${params.block_type} at position (${block.position.x}, ${block.position.y}, ${block.position.z})`;
          logToolExecution('find_block', params, result);
          return result;
        } catch (error: any) {
          logToolExecution('find_block', params, undefined, error);
          throw error;
        }
      },
    },

    // Entity Tools
    {
      name: 'find_entity',
      description: 'Find the nearest entity (player, mob, or any entity) within a given distance',
      input_schema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Type of entity: player, mob, or empty for any entity' },
          max_distance: { type: 'number', description: 'Maximum search distance (default: 16)' },
        },
      },
      execute: async (params: { type?: string; max_distance?: number }) => {
        try {
          const entityFilter = (entity: any) => {
            if (!params.type) return true;
            if (params.type === 'player') return entity.type === 'player';
            if (params.type === 'mob') return entity.type === 'mob';
            return entity.name && entity.name.includes(params.type.toLowerCase());
          };

          const entity = bot.nearestEntity(entityFilter);
          const maxDistance = params.max_distance || 16;

          if (!entity || bot.entity.position.distanceTo(entity.position) > maxDistance) {
            return `No ${params.type || 'entity'} found within ${maxDistance} blocks`;
          }

          const result = `Found ${entity.name || (entity as any).username || entity.type} at position (${Math.floor(entity.position.x)}, ${Math.floor(entity.position.y)}, ${Math.floor(entity.position.z)})`;
          logToolExecution('find_entity', params, result);
          return result;
        } catch (error: any) {
          logToolExecution('find_entity', params, undefined, error);
          throw error;
        }
      },
    },

    // Chat Tools
    {
      name: 'send_chat',
      description: 'Send a chat message to all players on the server',
      input_schema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The message to send' },
        },
        required: ['message'],
      },
      execute: async (params: { message: string }) => {
        try {
          bot.chat(params.message);
          const result = `Sent message: "${params.message}"`;
          logToolExecution('send_chat', params, result);
          return result;
        } catch (error: any) {
          logToolExecution('send_chat', params, undefined, error);
          throw error;
        }
      },
    },
    {
      name: 'get_recent_chat',
      description: 'Get recent chat messages from the chat history',
      input_schema: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Number of recent messages to retrieve (default: 10)' },
        },
      },
      execute: async (params: { count?: number }) => {
        try {
          const messages = minecraftBot.getChatHistory(params.count || 10);
          if (messages.length === 0) {
            return 'No recent chat messages';
          }
          const chatText = messages
            .map((msg) => `[${new Date(msg.timestamp).toISOString()}] ${msg.username}: ${msg.message}`)
            .join('\n');
          const result = `Recent chat messages:\n${chatText}`;
          logToolExecution('get_recent_chat', params, result);
          return result;
        } catch (error: any) {
          logToolExecution('get_recent_chat', params, undefined, error);
          throw error;
        }
      },
    },

    // TREE FELLING - ATOMIC TOOLS
    {
      name: 'find_trees',
      description: 'Find all trees within radius, sorted by distance. Returns position, type, height, whether it\'s a mega tree (2x2), and wood yield estimate for each tree.',
      input_schema: {
        type: 'object',
        properties: {
          radius: { type: 'number', description: 'Search radius in blocks (default: 50)' },
          types: { type: 'array', items: { type: 'string' }, description: 'Filter by tree types (e.g., ["oak", "spruce"]). Empty = all types.' },
        },
        required: [],
      },
      execute: async (params: { radius?: number; types?: string[] }) => {
        try {
          const result = await findTrees(bot, params.radius, params.types || []);
          logToolExecution('find_trees', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to find trees: ${error.message}`;
          logToolExecution('find_trees', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'get_tree_structure',
      description: 'Analyze a specific tree in detail. Returns base blocks, all log positions, height, highest log position, leaf count, and whether it\'s a mega tree.',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate of tree base' },
          y: { type: 'number', description: 'Y coordinate of tree base' },
          z: { type: 'number', description: 'Z coordinate of tree base' },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number }) => {
        try {
          const result = await getTreeStructure(bot, params.x, params.y, params.z);
          logToolExecution('get_tree_structure', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to analyze tree: ${error.message}`;
          logToolExecution('get_tree_structure', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'check_reachable',
      description: 'Check if a block position is reachable. Returns distance, whether scaffolding is needed, and recommendations for how to reach it.',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate of block' },
          y: { type: 'number', description: 'Y coordinate of block' },
          z: { type: 'number', description: 'Z coordinate of block' },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number }) => {
        try {
          const result = await checkReachable(bot, params.x, params.y, params.z);
          logToolExecution('check_reachable', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to check reachability: ${error.message}`;
          logToolExecution('check_reachable', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'break_block_and_wait',
      description: 'Break a block and wait for item drops to spawn. More reliable than dig_block for collecting resources like tree logs.',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate of block to break' },
          y: { type: 'number', description: 'Y coordinate of block to break' },
          z: { type: 'number', description: 'Z coordinate of block to break' },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number }) => {
        try {
          const result = await breakBlockAndWait(bot, params.x, params.y, params.z);
          logToolExecution('break_block_and_wait', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to break block: ${error.message}`;
          logToolExecution('break_block_and_wait', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'collect_nearby_items',
      description: 'Collect nearby item entities. Returns what was collected and what was missed (with reasons).',
      input_schema: {
        type: 'object',
        properties: {
          item_types: { type: 'array', items: { type: 'string' }, description: 'Filter by item types (e.g., ["oak_log", "oak_sapling"]). Empty = collect all.' },
          radius: { type: 'number', description: 'Search radius in blocks (default: 10)' },
        },
        required: [],
      },
      execute: async (params: { item_types?: string[]; radius?: number }) => {
        try {
          const result = await collectNearbyItems(bot, params.item_types || [], params.radius);
          logToolExecution('collect_nearby_items', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to collect items: ${error.message}`;
          logToolExecution('collect_nearby_items', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'wait_for_saplings',
      description: 'Wait near a tree position for leaves to decay and saplings to drop. Returns sapling count, leaf decay status, and whether it timed out.',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate of tree base' },
          y: { type: 'number', description: 'Y coordinate of tree base' },
          z: { type: 'number', description: 'Z coordinate of tree base' },
          timeout: { type: 'number', description: 'Max seconds to wait (default: 30)' },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number; timeout?: number }) => {
        try {
          const result = await waitForSaplings(bot, params.x, params.y, params.z, params.timeout);
          logToolExecution('wait_for_saplings', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to wait for saplings: ${error.message}`;
          logToolExecution('wait_for_saplings', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'find_plantable_ground',
      description: 'Find suitable dirt/grass blocks for planting saplings near a position. Returns positions sorted by distance with light level and space above.',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate to search near' },
          y: { type: 'number', description: 'Y coordinate to search near' },
          z: { type: 'number', description: 'Z coordinate to search near' },
          radius: { type: 'number', description: 'Search radius (default: 10)' },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number; radius?: number }) => {
        try {
          const result = await findPlantableGround(bot, params.x, params.y, params.z, params.radius);
          logToolExecution('find_plantable_ground', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to find plantable ground: ${error.message}`;
          logToolExecution('find_plantable_ground', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'place_sapling',
      description: 'Place a sapling at a specific position. Validates the location is suitable (dirt/grass below, air above, proper light).',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate where to place sapling' },
          y: { type: 'number', description: 'Y coordinate where to place sapling' },
          z: { type: 'number', description: 'Z coordinate where to place sapling' },
          sapling_type: { type: 'string', description: 'Type of sapling: oak_sapling, spruce_sapling, birch_sapling, jungle_sapling, acacia_sapling, dark_oak_sapling' },
        },
        required: ['x', 'y', 'z', 'sapling_type'],
      },
      execute: async (params: { x: number; y: number; z: number; sapling_type: string }) => {
        try {
          const result = await placeSapling(bot, params.x, params.y, params.z, params.sapling_type);
          logToolExecution('place_sapling', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to place sapling: ${error.message}`;
          logToolExecution('place_sapling', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'build_pillar',
      description: 'Build a pillar by jumping and placing blocks beneath. Used to reach high tree blocks. Returns final height and blocks used.',
      input_schema: {
        type: 'object',
        properties: {
          height: { type: 'number', description: 'How many blocks to rise' },
          descend_after: { type: 'boolean', description: 'Automatically descend after building (default: false)' },
        },
        required: ['height'],
      },
      execute: async (params: { height: number; descend_after?: boolean }) => {
        try {
          const result = await buildPillar(bot, params.height, params.descend_after);
          logToolExecution('build_pillar', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to build pillar: ${error.message}`;
          logToolExecution('build_pillar', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'descend_pillar_safely',
      description: 'Descend a pillar safely by breaking blocks beneath. Returns final position and blocks broken.',
      input_schema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        try {
          const result = await descendPillarSafely(bot);
          logToolExecution('descend_pillar_safely', {}, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to descend pillar: ${error.message}`;
          logToolExecution('descend_pillar_safely', {}, undefined, error);
          return errorMsg;
        }
      },
    },

    // Inter-bot Communication Tools
    {
      name: 'send_bot_message',
      description: 'Send a message to another bot. The recipient will see it when they check their messages. Use this to notify other bots about tasks, items, or coordination needs.',
      input_schema: {
        type: 'object',
        properties: {
          recipient: {
            type: 'string',
            description: 'Name of the bot to send the message to (e.g., "HandelBot", "SammelBot")',
          },
          message: {
            type: 'string',
            description: 'The message content to send',
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high'],
            description: 'Message priority (default: normal)',
          },
        },
        required: ['recipient', 'message'],
      },
      execute: async (params: { recipient: string; message: string; priority?: 'low' | 'normal' | 'high' }) => {
        try {
          const result = await send_bot_message(params);
          logToolExecution('send_bot_message', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to send bot message: ${error.message}`;
          logToolExecution('send_bot_message', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'read_bot_messages',
      description: 'Check messages sent to you by other bots. Returns unread messages by default. Use this periodically to see if other bots need something from you.',
      input_schema: {
        type: 'object',
        properties: {
          mark_as_read: {
            type: 'boolean',
            description: 'Mark retrieved messages as read (default: true)',
          },
          only_unread: {
            type: 'boolean',
            description: 'Only return unread messages (default: true)',
          },
        },
      },
      execute: async (params: { mark_as_read?: boolean; only_unread?: boolean } = {}) => {
        try {
          const result = await read_bot_messages(params);
          logToolExecution('read_bot_messages', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to read bot messages: ${error.message}`;
          logToolExecution('read_bot_messages', params, undefined, error);
          return errorMsg;
        }
      },
    },

    // Combat and Survival Tools
    {
      name: 'get_health',
      description: 'Check current health, hunger, and saturation status. Essential for survival decision-making.',
      input_schema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        try {
          const result = await get_health(bot);
          logToolExecution('get_health', {}, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to get health: ${error.message}`;
          logToolExecution('get_health', {}, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'eat_food',
      description: 'Eat food to restore health and hunger. Can specify food item or eat any available food.',
      input_schema: {
        type: 'object',
        properties: {
          food_item: {
            type: 'string',
            description: 'Optional: Specific food to eat (e.g., "cooked_beef", "bread"). If not specified, eats any available food.',
          },
        },
      },
      execute: async (params: { food_item?: string } = {}) => {
        try {
          const result = await eat_food(bot, params);
          logToolExecution('eat_food', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to eat food: ${error.message}`;
          logToolExecution('eat_food', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'attack_entity',
      description: 'Attack a nearby hostile mob. Finds nearest entity of specified type and engages in combat.',
      input_schema: {
        type: 'object',
        properties: {
          entity_type: {
            type: 'string',
            description: 'Type of entity to attack (e.g., "zombie", "skeleton", "creeper", "spider")',
          },
          max_distance: {
            type: 'number',
            description: 'Maximum distance to search for target (default: 10 blocks)',
          },
        },
        required: ['entity_type'],
      },
      execute: async (params: { entity_type: string; max_distance?: number }) => {
        try {
          const result = await attack_entity(bot, params);
          logToolExecution('attack_entity', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to attack entity: ${error.message}`;
          logToolExecution('attack_entity', params, undefined, error);
          return errorMsg;
        }
      },
    },

    // Farming Tools
    {
      name: 'till_soil',
      description: 'Till soil (convert dirt or grass to farmland) for planting crops. Requires a hoe in inventory.',
      input_schema: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'X coordinate of the block to till',
          },
          y: {
            type: 'number',
            description: 'Y coordinate of the block to till',
          },
          z: {
            type: 'number',
            description: 'Z coordinate of the block to till',
          },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number }) => {
        try {
          const result = await till_soil(bot, params);
          logToolExecution('till_soil', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to till soil: ${error.message}`;
          logToolExecution('till_soil', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'feed_entity',
      description: 'Feed an animal to breed it or speed up baby growth. Finds nearest animal of specified type and feeds it the appropriate food. Valid foods: cow/sheep=wheat, pig=carrot/potato, chicken=seeds, etc.',
      input_schema: {
        type: 'object',
        properties: {
          entity_type: {
            type: 'string',
            description: 'Type of animal to feed (e.g., "cow", "sheep", "pig", "chicken", "horse")',
          },
          food_item: {
            type: 'string',
            description: 'Food item to feed (e.g., "wheat", "carrot", "wheat_seeds")',
          },
          max_distance: {
            type: 'number',
            description: 'Maximum distance to search for animal (default: 16 blocks)',
          },
        },
        required: ['entity_type', 'food_item'],
      },
      execute: async (params: { entity_type: string; food_item: string; max_distance?: number }) => {
        try {
          const result = await feed_entity(bot, params);
          logToolExecution('feed_entity', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to feed entity: ${error.message}`;
          logToolExecution('feed_entity', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'shear_sheep',
      description: 'Shear a nearby sheep to collect wool. Requires shears in inventory. Bot will find nearest sheep and collect 1-3 wool blocks.',
      input_schema: {
        type: 'object',
        properties: {
          max_distance: {
            type: 'number',
            description: 'Maximum distance to search for sheep (default: 16 blocks)',
          },
        },
      },
      execute: async (params: { max_distance?: number } = {}) => {
        try {
          const result = await shear_sheep(bot, params);
          logToolExecution('shear_sheep', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to shear sheep: ${error.message}`;
          logToolExecution('shear_sheep', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'milk_cow',
      description: 'Milk a nearby cow to get a milk bucket. Requires empty bucket in inventory. Bot will find nearest cow and collect milk.',
      input_schema: {
        type: 'object',
        properties: {
          max_distance: {
            type: 'number',
            description: 'Maximum distance to search for cows (default: 16 blocks)',
          },
        },
      },
      execute: async (params: { max_distance?: number } = {}) => {
        try {
          const result = await milk_cow(bot, params);
          logToolExecution('milk_cow', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to milk cow: ${error.message}`;
          logToolExecution('milk_cow', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'use_bone_meal',
      description: 'Use bone meal on a crop or plant to accelerate its growth. Works on wheat, carrots, potatoes, beetroots, saplings, and other plants. Instantly advances growth stages.',
      input_schema: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'X coordinate of the crop/plant to fertilize',
          },
          y: {
            type: 'number',
            description: 'Y coordinate of the crop/plant to fertilize',
          },
          z: {
            type: 'number',
            description: 'Z coordinate of the crop/plant to fertilize',
          },
        },
        required: ['x', 'y', 'z'],
      },
      execute: async (params: { x: number; y: number; z: number }) => {
        try {
          const result = await use_bone_meal(bot, params);
          logToolExecution('use_bone_meal', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to use bone meal: ${error.message}`;
          logToolExecution('use_bone_meal', params, undefined, error);
          return errorMsg;
        }
      },
    },

    // Navigation/Waypoint Tools
    {
      name: 'set_waypoint',
      description: 'Save a named waypoint (location) for later navigation. Uses current position if coordinates not provided. Waypoints are shared across all bots.',
      input_schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name for the waypoint (e.g., "Home", "Mine", "Farm")',
          },
          x: {
            type: 'number',
            description: 'X coordinate (optional, uses current position if not provided)',
          },
          y: {
            type: 'number',
            description: 'Y coordinate (optional, uses current position if not provided)',
          },
          z: {
            type: 'number',
            description: 'Z coordinate (optional, uses current position if not provided)',
          },
          description: {
            type: 'string',
            description: 'Optional description of the waypoint',
          },
        },
        required: ['name'],
      },
      execute: async (params: { name: string; x?: number; y?: number; z?: number; description?: string }) => {
        try {
          const result = await set_waypoint(bot, params);
          logToolExecution('set_waypoint', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to set waypoint: ${error.message}`;
          logToolExecution('set_waypoint', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'list_waypoints',
      description: 'List all saved waypoints with their coordinates and distances from current position. Optionally sort by distance.',
      input_schema: {
        type: 'object',
        properties: {
          sort_by_distance: {
            type: 'boolean',
            description: 'Sort waypoints by distance from current position (default: false)',
          },
        },
      },
      execute: async (params: { sort_by_distance?: boolean } = {}) => {
        try {
          const result = await list_waypoints(bot, params);
          logToolExecution('list_waypoints', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to list waypoints: ${error.message}`;
          logToolExecution('list_waypoints', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'delete_waypoint',
      description: 'Delete a saved waypoint by name.',
      input_schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the waypoint to delete',
          },
        },
        required: ['name'],
      },
      execute: async (params: { name: string }) => {
        try {
          const result = await delete_waypoint(bot, params);
          logToolExecution('delete_waypoint', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to delete waypoint: ${error.message}`;
          logToolExecution('delete_waypoint', params, undefined, error);
          return errorMsg;
        }
      },
    },

    // ==================== Crafting Tools ====================
    {
      name: 'craft_item',
      description: 'Craft items using a crafting table or inventory crafting grid. Automatically finds nearby crafting table if recipe requires 3x3 grid.',
      input_schema: {
        type: 'object',
        properties: {
          item_name: {
            type: 'string',
            description: 'Name of item to craft (e.g., "wooden_pickaxe", "crafting_table", "stick", "oak_planks")'
          },
          count: {
            type: 'number',
            description: 'Number of items to craft (default: 1, max: 64)',
            default: 1
          }
        },
        required: ['item_name']
      },
      execute: async (params: any) => {
        try {
          const result = await craft_item(bot, params);
          logToolExecution('craft_item', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to craft item: ${error.message}`;
          logToolExecution('craft_item', params, undefined, error);
          return errorMsg;
        }
      },
    },

    {
      name: 'smelt_item',
      description: 'Smelt items in a furnace (ores, raw food, etc.). Automatically finds nearby furnace and uses available fuel.',
      input_schema: {
        type: 'object',
        properties: {
          item_name: {
            type: 'string',
            description: 'Name of item to smelt (e.g., "iron_ore", "raw_iron", "raw_beef", "cobblestone")'
          },
          count: {
            type: 'number',
            description: 'Number of items to smelt (default: 1, max: 64)',
            default: 1
          },
          fuel: {
            type: 'string',
            description: 'Optional: specific fuel to use (e.g., "coal", "charcoal"). If not specified, auto-selects from available fuel.'
          }
        },
        required: ['item_name']
      },
      execute: async (params: any) => {
        try {
          const result = await smelt_item(bot, params);
          logToolExecution('smelt_item', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to smelt item: ${error.message}`;
          logToolExecution('smelt_item', params, undefined, error);
          return errorMsg;
        }
      },
    },

    // ==================== Inventory Management Tools ====================
    {
      name: 'equip_item',
      description: 'Equip an item from inventory to a specific slot (hand, armor slots, off-hand). Useful for equipping tools, weapons, and armor.',
      input_schema: {
        type: 'object',
        properties: {
          item_name: {
            type: 'string',
            description: 'Name of item to equip (e.g., "iron_pickaxe", "diamond_sword", "iron_chestplate")'
          },
          destination: {
            type: 'string',
            description: 'Where to equip the item: "hand" (default), "head", "torso", "legs", "feet", or "off-hand"',
            enum: ['hand', 'head', 'torso', 'legs', 'feet', 'off-hand'],
            default: 'hand'
          }
        },
        required: ['item_name']
      },
      execute: async (params: any) => {
        try {
          const result = await equip_item(bot, params);
          logToolExecution('equip_item', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to equip item: ${error.message}`;
          logToolExecution('equip_item', params, undefined, error);
          return errorMsg;
        }
      },
    },

    {
      name: 'drop_item',
      description: 'Drop items from inventory onto the ground. Useful for discarding unwanted items or transferring items between bots.',
      input_schema: {
        type: 'object',
        properties: {
          item_name: {
            type: 'string',
            description: 'Name of item to drop (e.g., "dirt", "cobblestone", "rotten_flesh")'
          },
          count: {
            type: 'number',
            description: 'Number of items to drop (omit to drop all of this item type)'
          }
        },
        required: ['item_name']
      },
      execute: async (params: any) => {
        try {
          const result = await drop_item(bot, params);
          logToolExecution('drop_item', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to drop item: ${error.message}`;
          logToolExecution('drop_item', params, undefined, error);
          return errorMsg;
        }
      },
    },

    {
      name: 'collect_items',
      description: 'Collect nearby dropped items from the ground. Can filter by item type or collect everything nearby.',
      input_schema: {
        type: 'object',
        properties: {
          item_name: {
            type: 'string',
            description: 'Optional: specific item to collect (e.g., "diamond", "iron_ore"). If omitted, collects all nearby items.'
          },
          max_distance: {
            type: 'number',
            description: 'Maximum distance to search for items (default: 16, max: 64)',
            default: 16
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to spend collecting in milliseconds (default: 5000)',
            default: 5000
          }
        }
      },
      execute: async (params: any) => {
        try {
          const result = await collect_items(bot, params);
          logToolExecution('collect_items', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to collect items: ${error.message}`;
          logToolExecution('collect_items', params, undefined, error);
          return errorMsg;
        }
      },
    },

    // Storage Management Tools
    {
      name: 'open_chest',
      description: 'Open a chest at specific coordinates and view its contents without taking items. Works with chests, barrels, and shulker boxes.',
      input_schema: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'X coordinate of chest'
          },
          y: {
            type: 'number',
            description: 'Y coordinate of chest'
          },
          z: {
            type: 'number',
            description: 'Z coordinate of chest'
          }
        },
        required: ['x', 'y', 'z']
      },
      execute: async (params: { x: number; y: number; z: number }) => {
        try {
          const result = await open_chest(bot, params);
          logToolExecution('open_chest', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to open chest: ${error.message}`;
          logToolExecution('open_chest', params, undefined, error);
          return errorMsg;
        }
      },
    },

    {
      name: 'deposit_items',
      description: 'Deposit items from bot inventory into a chest at specific coordinates. Essential for storing gathered resources.',
      input_schema: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'X coordinate of chest'
          },
          y: {
            type: 'number',
            description: 'Y coordinate of chest'
          },
          z: {
            type: 'number',
            description: 'Z coordinate of chest'
          },
          item_name: {
            type: 'string',
            description: 'Name of item to deposit (e.g., "oak_log", "cobblestone")'
          },
          count: {
            type: 'number',
            description: 'Number of items to deposit (optional, defaults to all)'
          }
        },
        required: ['x', 'y', 'z', 'item_name']
      },
      execute: async (params: { x: number; y: number; z: number; item_name: string; count?: number }) => {
        try {
          const result = await deposit_items(bot, params);
          logToolExecution('deposit_items', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to deposit items: ${error.message}`;
          logToolExecution('deposit_items', params, undefined, error);
          return errorMsg;
        }
      },
    },

    {
      name: 'withdraw_items',
      description: 'Withdraw items from a chest at specific coordinates into bot inventory. Use for retrieving stored resources.',
      input_schema: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'X coordinate of chest'
          },
          y: {
            type: 'number',
            description: 'Y coordinate of chest'
          },
          z: {
            type: 'number',
            description: 'Z coordinate of chest'
          },
          item_name: {
            type: 'string',
            description: 'Name of item to withdraw (e.g., "oak_log", "cobblestone")'
          },
          count: {
            type: 'number',
            description: 'Number of items to withdraw (optional, defaults to all)'
          }
        },
        required: ['x', 'y', 'z', 'item_name']
      },
      execute: async (params: { x: number; y: number; z: number; item_name: string; count?: number }) => {
        try {
          const result = await withdraw_items(bot, params);
          logToolExecution('withdraw_items', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to withdraw items: ${error.message}`;
          logToolExecution('withdraw_items', params, undefined, error);
          return errorMsg;
        }
      },
    },
    // Mining and Exploration Tools
    {
      name: 'find_stone',
      description: 'Find accessible stone deposits (surface, cliff, cave) within search radius. Returns coordinates, distance, accessibility, and estimated yield for each deposit. Use for Phase 2 stone gathering.',
      input_schema: {
        type: 'object',
        properties: {
          radius: {
            type: 'number',
            description: 'Search radius in blocks (default: 32)'
          },
          stone_types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific stone types to find (e.g., ["stone", "cobblestone"]). If not specified, finds all stone types'
          }
        }
      },
      execute: async (params: { radius?: number; stone_types?: string[] }) => {
        try {
          const result = await findStone(bot, params.radius, params.stone_types);
          logToolExecution('find_stone', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to find stone: ${error.message}`;
          logToolExecution('find_stone', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'get_block_info',
      description: 'Get detailed information about a block at specific coordinates (type, hardness, tool requirements, reachability). Essential for "blind bot" spatial awareness.',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          z: { type: 'number', description: 'Z coordinate' }
        },
        required: ['x', 'y', 'z']
      },
      execute: async (params: { x: number; y: number; z: number }) => {
        try {
          const result = await get_block_info(minecraftBot, params);
          logToolExecution('get_block_info', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to get block info: ${error.message}`;
          logToolExecution('get_block_info', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'find_ores',
      description: 'Find ore blocks (coal, iron, diamond, etc.) within radius. Returns exact coordinates and distances sorted by proximity. Use for locating mining resources.',
      input_schema: {
        type: 'object',
        properties: {
          oreType: {
            type: 'string',
            description: 'Specific ore type: "coal_ore", "iron_ore", "diamond_ore", etc. Omit to find all ores'
          },
          maxDistance: {
            type: 'number',
            description: 'Maximum search radius in blocks (default: 32)'
          },
          count: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)'
          }
        }
      },
      execute: async (params: { oreType?: string; maxDistance?: number; count?: number }) => {
        try {
          const result = await find_ores(minecraftBot, params);
          logToolExecution('find_ores', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to find ores: ${error.message}`;
          logToolExecution('find_ores', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'find_water',
      description: 'Find water sources within radius. Returns coordinates, distances, and water depth. Useful for fishing, farming, or boat navigation.',
      input_schema: {
        type: 'object',
        properties: {
          maxDistance: {
            type: 'number',
            description: 'Maximum search radius in blocks (default: 64)'
          },
          minDepth: {
            type: 'number',
            description: 'Minimum water depth required (default: 2, suitable for fishing/boats)'
          },
          count: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)'
          }
        }
      },
      execute: async (params: { maxDistance?: number; minDepth?: number; count?: number }) => {
        try {
          const result = await find_water(minecraftBot, params);
          logToolExecution('find_water', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to find water: ${error.message}`;
          logToolExecution('find_water', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'find_flat_area',
      description: 'Find flat areas suitable for building structures. Returns coordinates, dimensions, and distances. Use before building bases or farms.',
      input_schema: {
        type: 'object',
        properties: {
          minSize: {
            type: 'number',
            description: 'Minimum flat area size in blocks (default: 5, creates 5x5 area)'
          },
          maxDistance: {
            type: 'number',
            description: 'Maximum search radius in blocks (default: 32)'
          },
          count: {
            type: 'number',
            description: 'Maximum number of results to return (default: 3)'
          }
        }
      },
      execute: async (params: { minSize?: number; maxDistance?: number; count?: number }) => {
        try {
          const result = await find_flat_area(minecraftBot, params);
          logToolExecution('find_flat_area', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to find flat area: ${error.message}`;
          logToolExecution('find_flat_area', params, undefined, error);
          return errorMsg;
        }
      },
    },
    // World Awareness Tools
    {
      name: 'detect_time_of_day',
      description: 'Get current Minecraft time, day/night status, and safety information for mob spawning. Critical for night safety protocols.',
      input_schema: {
        type: 'object',
        properties: {}
      },
      execute: async () => {
        try {
          const result = await detectTimeOfDay(bot);
          logToolExecution('detect_time_of_day', {}, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to detect time: ${error.message}`;
          logToolExecution('detect_time_of_day', {}, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'detect_biome',
      description: 'Detect the biome at current position or specified coordinates. Returns biome name, temperature, rainfall, and characteristics (surface blocks, trees, water).',
      input_schema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate (defaults to bot position)' },
          y: { type: 'number', description: 'Y coordinate (defaults to bot position)' },
          z: { type: 'number', description: 'Z coordinate (defaults to bot position)' }
        }
      },
      execute: async (params: { x?: number; y?: number; z?: number }) => {
        try {
          const result = await detect_biome(bot, params.x, params.y, params.z);
          logToolExecution('detect_biome', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to detect biome: ${error.message}`;
          logToolExecution('detect_biome', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'scan_biomes_in_area',
      description: 'Scan a radius around current position to find all unique biomes nearby. Useful for exploration, finding biome boundaries, and locating specific biomes.',
      input_schema: {
        type: 'object',
        properties: {
          radius: {
            type: 'number',
            description: 'Scan radius in blocks (default: 50)'
          },
          centerX: {
            type: 'number',
            description: 'Center X coordinate (defaults to bot position)'
          },
          centerZ: {
            type: 'number',
            description: 'Center Z coordinate (defaults to bot position)'
          }
        }
      },
      execute: async (params: { radius?: number; centerX?: number; centerZ?: number }) => {
        try {
          const result = await scan_biomes_in_area(bot, params.radius, params.centerX, params.centerZ);
          logToolExecution('scan_biomes_in_area', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to scan biomes: ${error.message}`;
          logToolExecution('scan_biomes_in_area', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'get_nearby_blocks',
      description: 'Get information about all blocks in a radius around the bot. Shows block distribution and interesting blocks with coordinates. Essential for understanding immediate surroundings.',
      input_schema: {
        type: 'object',
        properties: {
          radius: {
            type: 'number',
            description: 'Search radius in blocks (default: 5)'
          },
          includeAir: {
            type: 'boolean',
            description: 'Include air blocks in results (default: false)'
          }
        }
      },
      execute: async (params: { radius?: number; includeAir?: boolean }) => {
        try {
          const result = await getNearbyBlocks(bot, params.radius, params.includeAir);
          logToolExecution('get_nearby_blocks', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to get nearby blocks: ${error.message}`;
          logToolExecution('get_nearby_blocks', params, undefined, error);
          return errorMsg;
        }
      },
    },
    // Colony Coordination Tools
    {
      name: 'report_status',
      description: 'Generate comprehensive bot status report for colony coordination. Shows health, position, inventory, current task, and warnings. Can broadcast to other bots.',
      input_schema: {
        type: 'object',
        properties: {
          include_inventory: {
            type: 'boolean',
            description: 'Include detailed inventory summary (default: true)'
          },
          include_waypoints: {
            type: 'boolean',
            description: 'Include waypoints in report (default: false)'
          },
          broadcast: {
            type: 'boolean',
            description: 'Broadcast status summary to chat (default: false)'
          }
        }
      },
      execute: async (params: { include_inventory?: boolean; include_waypoints?: boolean; broadcast?: boolean }) => {
        try {
          const result = await report_status(bot, params);
          logToolExecution('report_status', params, result);
          return result;
        } catch (error: any) {
          const errorMsg = `Failed to report status: ${error.message}`;
          logToolExecution('report_status', params, undefined, error);
          return errorMsg;
        }
      },
    },
  ];
}
