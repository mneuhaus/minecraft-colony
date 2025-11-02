import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';
import { MinecraftBot } from '../bot/MinecraftBot.js';
import { logToolExecution } from '../logger.js';
import { findTree } from '../skills/find_tree.js';
import { fellTree } from '../skills/fell_tree.js';

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

    // TREE FELLING HELPERS
    {
      name: 'find_tree',
      description: 'Find all trees within range, sorted by distance (nearest first). Returns coordinates and wood types for multiple trees. The nearest tree is recommended but you can choose others if pathfinding fails.',
      input_schema: {
        type: 'object',
        properties: {
          maxDistance: {
            type: 'number',
            description: 'Maximum distance to search for trees in blocks (default: 128)',
          },
        },
        required: [],
      },
      execute: async (params: { maxDistance?: number }) => {
        try {
          const result = await findTree(bot, params.maxDistance);
          logToolExecution('find_tree', params, result.message);
          return result.message;
        } catch (error: any) {
          const errorMsg = `Failed to find tree: ${error.message}`;
          logToolExecution('find_tree', params, undefined, error);
          return errorMsg;
        }
      },
    },
    {
      name: 'fell_tree',
      description: 'Completely fell a tree at given coordinates. This will: 1) Clear ALL logs (no floating blocks), 2) Handle both 1x1 and 2x2 mega trees, 3) Wait for leaf decay, 4) Collect saplings, 5) Replant saplings. You must provide the tree position (from find_tree) and wood type.',
      input_schema: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'X coordinate of tree base',
          },
          y: {
            type: 'number',
            description: 'Y coordinate of tree base',
          },
          z: {
            type: 'number',
            description: 'Z coordinate of tree base',
          },
          woodType: {
            type: 'string',
            description: 'Type of wood (e.g., oak_log, birch_log, spruce_log)',
          },
        },
        required: ['x', 'y', 'z', 'woodType'],
      },
      execute: async (params: { x: number; y: number; z: number; woodType: string }) => {
        try {
          const treePos = new Vec3(params.x, params.y, params.z);
          const result = await fellTree(bot, treePos, params.woodType);
          logToolExecution('fell_tree', params, result.message);
          return result.message;
        } catch (error: any) {
          const errorMsg = `Failed to fell tree: ${error.message}`;
          logToolExecution('fell_tree', params, undefined, error);
          return errorMsg;
        }
      },
    },
  ];
}
