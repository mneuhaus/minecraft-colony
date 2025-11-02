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
  ];
}
