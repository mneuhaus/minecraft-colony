import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { MinecraftBot } from '../bot/MinecraftBot.js';

// MCRN removed — all tool inputs/outputs use world coordinates (x,y,z)

// Wrapper to log tool calls and results
function loggingTool<T extends z.ZodRawShape>(
  name: string,
  description: string,
  schema: T,
  handler: (params: z.infer<z.ZodObject<T>>) => Promise<any>,
  context: { activityWriter: any; botName: string; memoryStore: any; getSessionId: () => string | null }
) {
  return tool(name, description, schema, async (params: z.infer<z.ZodObject<T>>) => {
    const startTime = Date.now();
    try {
      const result = await handler(params);
      const duration = Date.now() - startTime;

      // Extract output text from MCP result format
      let outputText = '';
      if (result.content && Array.isArray(result.content)) {
        outputText = result.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('');
      }

      // Prepare enriched tool data
      const toolData = {
        name,
        tool_name: name,
        input: params,
        params_summary: params,
        output: outputText,
        duration_ms: duration,
      };

      // Log to activity writer (for real-time WebSocket streaming)
      if (context.activityWriter) {
        context.activityWriter.addActivity({
          type: 'tool',
          message: `Tool: ${name}`,
          details: toolData,
          speaker: context.botName,
          role: 'tool',
        });
      }

      // ALSO log to SqlMemoryStore (for database persistence with enriched data)
      if (context.memoryStore && context.getSessionId) {
        const sessionId = context.getSessionId();
        if (sessionId) {
          context.memoryStore.addActivity(
            sessionId,
            'tool',
            `Used ${name}`,
            toolData
          );
        }
      }

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Prepare error tool data
      const errorData = {
        name,
        tool_name: name,
        input: params,
        params_summary: params,
        output: `Error: ${error.message}`,
        duration_ms: duration,
        error: true,
      };

      // Log error to activity writer
      if (context.activityWriter) {
        context.activityWriter.addActivity({
          type: 'tool',
          message: `Tool: ${name} (ERROR)`,
          details: errorData,
          speaker: context.botName,
          role: 'tool',
        });
      }

      // Also log error to SqlMemoryStore
      if (context.memoryStore && context.getSessionId) {
        const sessionId = context.getSessionId();
        if (sessionId) {
          context.memoryStore.addActivity(
            sessionId,
            'tool',
            `Used ${name} (ERROR)`,
            errorData
          );
        }
      }

      throw error;
    }
  });
}

export function createUnifiedMcpServer(
  minecraftBot: MinecraftBot,
  activityWriter: any,
  botName: string,
  memoryStore: any,
  getSessionId: () => string | null
) {
  const bot = minecraftBot.getBot();
  const context = { activityWriter, botName, memoryStore, getSessionId };
  const server: any = createSdkMcpServer({
    name: 'minecraft',
    version: '1.0.0-unified',
    tools: [
      loggingTool('send_chat', 'Send message to in-game chat. IMPORTANT: Single line only, NO markdown/formatting, NO newlines, NO emojis. Keep short and readable for game chat (max 1-2 sentences).', { message: z.string() }, async ({ message }) => {
        try { minecraftBot.chat(message); return { content: [{ type: 'text', text: `Sent: ${message}` }] }; }
        catch (e: any) { return { content: [{ type: 'text', text: `Failed: ${e.message}` }], isError: true }; }
      }, context),
      loggingTool('get_position', 'Get current bot position', {}, async () => {
        const p = bot.entity?.position; if (!p) return { content: [{ type: 'text', text: 'Not spawned' }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }) }] };
      }, context),
      loggingTool('get_inventory', 'Get current bot inventory contents', {}, async () => {
        const { get_inventory } = await import('../tools/inventory/get_inventory.js');
        const result = await get_inventory(bot);
        return { content: [{ type: 'text', text: result }] };
      }, context),
      // Note: Storage interactions are intentionally NOT exposed as direct tools.
      // Use CraftScript commands only: open/close, container_put/take, deposit/withdraw.
      loggingTool('get_vox', '3D voxel snapshot of the local area around the bot (x/y/z world coordinates). Use for precise short-range understanding; combine with look_at_map for 2D overview.', {
        radius: z.number().optional(),
        include_air: z.boolean().optional(),
        grep: z.array(z.string()).optional(),
        filter: z.array(z.string()).optional()
      }, async ({ radius, include_air = false, grep, filter }) => {
        const { get_vox } = await import('../craftscript/env.js');
        const patterns = (grep && Array.isArray(grep) ? grep : (filter && Array.isArray(filter) ? filter : undefined));
        const snap = await get_vox(bot, radius, include_air, undefined, patterns as any);
        return { content: [{ type: 'text', text: JSON.stringify(snap) }] };
      }, context),
      loggingTool('affordances', 'Affordances at world position', { x: z.number(), y: z.number(), z: z.number() }, async ({ x, y, z }) => {
        const { affordances } = await import('../craftscript/env.js');
        return { content: [{ type: 'text', text: JSON.stringify(affordances(bot, { x, y, z })) }] };
      }, context),
      loggingTool('nearest', 'Find nearest block/entity', { block_id: z.string().optional(), entity_id: z.string().optional(), radius: z.number().optional(), reachable: z.boolean().optional() }, async (params) => {
        const { nearest } = await import('../craftscript/env.js');
        const res = await nearest(bot, params as any);
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      }, context),
      loggingTool('block_info', 'Block info by id or x/y/z position', { id: z.string().optional(), x: z.number().optional(), y: z.number().optional(), z: z.number().optional() }, async ({ id, x, y, z }) => {
        const { block_info } = await import('../craftscript/env.js');
        const info = block_info(bot, { id, x, y, z });
        return { content: [{ type: 'text', text: JSON.stringify(info) }] };
      }, context),
      loggingTool('look_at_map', 'Top-down 2D map for fast orientation (world x/z cells). Each cell summarizes a zoom block; symbols show relative height (▲/•/▼).', { radius: z.number().optional(), zoom: z.number().optional(), grep: z.array(z.string()).optional(), filter: z.array(z.string()).optional() }, async ({ radius, zoom, grep, filter }) => {
        const { look_at_map } = await import('../craftscript/env.js');
        const patterns = (grep && Array.isArray(grep) ? grep : (filter && Array.isArray(filter) ? filter : undefined));
        return { content: [{ type: 'text', text: JSON.stringify(look_at_map(bot, radius ?? 10, zoom ?? 1, patterns as any)) }] };
      }, context),
      loggingTool('look_at_map_4', 'Birds eye view with 4x zoom (4x4 blocks per cell) for medium range scanning', { radius: z.number().optional() }, async ({ radius }) => {
        const { look_at_map } = await import('../craftscript/env.js');
        return { content: [{ type: 'text', text: JSON.stringify(look_at_map(bot, radius ?? 20, 4)) }] };
      }, context),
      loggingTool('look_at_map_5', 'Birds eye view with 5x zoom (5x5 blocks per cell) for long range scanning', { radius: z.number().optional() }, async ({ radius }) => {
        const { look_at_map } = await import('../craftscript/env.js');
        return { content: [{ type: 'text', text: JSON.stringify(look_at_map(bot, radius ?? 25, 5)) }] };
      }, context),
      loggingTool('craftscript_start', 'Start CraftScript in background; returns job_id', { script: z.string() }, async ({ script }) => {
        const { createCraftscriptJob } = await import('./craftscriptJobs.js');
        try { const enable = (process.env.CRAFTSCRIPT_CHAT_ENABLED ?? 'true').toLowerCase() !== 'false'; if (enable) { const max = Math.max(0, parseInt(process.env.CRAFTSCRIPT_CHAT_PREVIEW_LINES ?? '12', 10)); const lines = String(script||'').split(/\r?\n/); const preview = max>0?lines.slice(0,max).join('\n'):''; const suffix=max>0&&lines.length>max?`\n… ${lines.length-max} more line(s)`:''; minecraftBot.chat(`Start CraftScript (${lines.length} lines)\n\`\`\`c\n${preview}${suffix}\n\`\`\``);} } catch {}
        const id = createCraftscriptJob(minecraftBot, script, context.activityWriter as any, context.botName, context.memoryStore as any, context.getSessionId);
        return { content: [{ type: 'text', text: JSON.stringify({ job_id: id, state: 'queued' }) }] };
      }, context),
      loggingTool('craftscript_status', 'Poll CraftScript job status', { job_id: z.string() }, async ({ job_id }) => {
        const { getCraftscriptStatus } = await import('./craftscriptJobs.js');
        const status = getCraftscriptStatus(job_id);
        return { content: [{ type: 'text', text: JSON.stringify(status || { ok: false, error: 'not_found' }) }] };
      }, context),
      loggingTool('craftscript_cancel', 'Cancel CraftScript job', { job_id: z.string() }, async ({ job_id }) => {
        const { cancelCraftscriptJob } = await import('./craftscriptJobs.js');
        cancelCraftscriptJob(job_id);
        return { content: [{ type: 'text', text: JSON.stringify({ job_id, state: 'canceled' }) }] };
      }, context),

      // Memory tools
      loggingTool('get_memory', 'Get bot memory as markdown text. Returns what the bot remembers.', {}, async () => {
        const { getMemoryText } = await import('../tools/memory/memory.js');
        const text = await getMemoryText(context.botName);
        return { content: [{ type: 'text', text }] };
      }, context),
      loggingTool('update_memory', 'Update bot memory with markdown text. Replaces entire memory content.', { content: z.string() }, async ({ content: memoryContent }) => {
        const { updateMemoryText } = await import('../tools/memory/memory.js');
        await updateMemoryText(context.botName, memoryContent);
        return { content: [{ type: 'text', text: 'Memory updated successfully' }] };
      }, context),

      // Blueprint tools
      loggingTool('list_blueprints', 'List stored blueprints (name, description, count)', {}, async () => {
        const { listBlueprints } = await import('../tools/blueprints/storage.js');
        const list = listBlueprints();
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
      }, context),
      loggingTool('create_blueprint', 'Create a new blueprint with vox at origin (0,0,0). Vox is an array of {x,y,z,id,face?}.', {
        name: z.string(),
        description: z.string().optional(),
        vox: z.array(z.object({ x: z.number(), y: z.number(), z: z.number(), id: z.string(), face: z.enum(['up','down','north','south','east','west']).optional(), label: z.string().optional() })),
      }, async ({ name, description, vox }) => {
        const { createBlueprint } = await import('../tools/blueprints/storage.js');
        const bp = createBlueprint({ name, description, vox } as any);
        return { content: [{ type: 'text', text: JSON.stringify(bp) }] };
      }, context),
      loggingTool('update_blueprint', 'Update an existing blueprint; can change description and vox.', {
        name: z.string(),
        description: z.string().optional(),
        vox: z.array(z.object({ x: z.number(), y: z.number(), z: z.number(), id: z.string(), face: z.enum(['up','down','north','south','east','west']).optional(), label: z.string().optional() })).optional(),
      }, async ({ name, description, vox }) => {
        const { updateBlueprint } = await import('../tools/blueprints/storage.js');
        const bp = updateBlueprint(name, { description, vox } as any);
        return { content: [{ type: 'text', text: JSON.stringify(bp) }] };
      }, context),
      loggingTool('remove_blueprint', 'Remove a blueprint by name', { name: z.string() }, async ({ name }) => {
        const { removeBlueprint } = await import('../tools/blueprints/storage.js');
        const ok = removeBlueprint(name);
        return { content: [{ type: 'text', text: JSON.stringify({ ok }) }] };
      }, context),
      loggingTool('get_blueprint', 'Get a blueprint by name with validation issues if any', { name: z.string() }, async ({ name }) => {
        const { getBlueprint, validateBlueprint } = await import('../tools/blueprints/storage.js');
        const bp = getBlueprint(name);
        if (!bp) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'not_found' }) }], isError: true } as any;
        const v = validateBlueprint(bp as any);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: v.ok, issues: v.issues, blueprint: bp }) }] };
      }, context),
      loggingTool('instantiate_blueprint', 'Instantiate a blueprint at origin with rotation (0|90|180|270). Returns absolute voxels.', { name: z.string(), origin: z.object({ x: z.number(), y: z.number(), z: z.number() }), rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional() }, async ({ name, origin, rotation }) => {
        const { getBlueprint, instantiateBlueprint } = await import('../tools/blueprints/storage.js');
        const bp = getBlueprint(name);
        if (!bp) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'not_found' }) }], isError: true } as any;
        const vox = instantiateBlueprint(bp as any, origin as any, (rotation as any) ?? 0);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, voxels: vox, count: vox.length }) }] };
      }, context),
    ],
  });
  if (!server.manifest) server.manifest = { name: 'minecraft', tools: [
    { name: 'send_chat' }, { name: 'get_position' }, { name: 'get_inventory' }, { name: 'get_vox' }, { name: 'affordances' },
    { name: 'nearest' }, { name: 'block_info' }, { name: 'look_at_map' }, { name: 'look_at_map_4' }, { name: 'look_at_map_5' },
    { name: 'craftscript_start' }, { name: 'craftscript_status' }, { name: 'craftscript_cancel' },
    { name: 'get_memory' }, { name: 'update_memory' },
    { name: 'list_blueprints' }, { name: 'create_blueprint' }, { name: 'update_blueprint' }, { name: 'remove_blueprint' }, { name: 'get_blueprint' }, { name: 'instantiate_blueprint' }
  ] };
  return server;
}

// Back-compat exports
export const createMinecraftMcpServer = createUnifiedMcpServer;
export const createPlannerMcpServer = createUnifiedMcpServer;
