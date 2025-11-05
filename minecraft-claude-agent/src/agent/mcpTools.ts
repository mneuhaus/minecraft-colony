import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { MinecraftBot } from '../bot/MinecraftBot.js';

// Minimal selector parser for string keys like F1+U2+R-1
function selectorKeyToAst(key: string): any {
  const terms = key.trim().toUpperCase().split('+').filter(Boolean).map((part) => {
    const axis = part[0];
    const n = Number(part.slice(1));
    const axisMap: any = { F: 'f', B: 'b', R: 'r', L: 'l', U: 'u', D: 'd' };
    if (!axisMap[axis] || Number.isNaN(n)) throw new Error(`Invalid selector segment: ${part}`);
    return { type: 'SelTerm', axis: axisMap[axis], n };
  });
  return { type: 'Selector', terms };
}

// Wrapper to log tool calls and results
function loggingTool<T extends z.ZodRawShape>(
  name: string,
  description: string,
  schema: T,
  handler: (params: z.infer<z.ZodObject<T>>) => Promise<any>,
  minecraftBot: MinecraftBot
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

      // Log to activity writer
      const activityWriter = (minecraftBot as any).activityWriter;
      if (activityWriter) {
        activityWriter.addActivity({
          type: 'tool',
          message: `Tool: ${name}`,
          details: {
            name,
            tool_name: name,
            input: params,
            params_summary: params,
            output: outputText,
            duration_ms: duration,
          },
          speaker: (minecraftBot as any).botName,
          role: 'tool',
        });
      }

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Log error to activity writer
      const activityWriter = (minecraftBot as any).activityWriter;
      if (activityWriter) {
        activityWriter.addActivity({
          type: 'tool',
          message: `Tool: ${name} (ERROR)`,
          details: {
            name,
            tool_name: name,
            input: params,
            params_summary: params,
            output: `Error: ${error.message}`,
            duration_ms: duration,
            error: true,
          },
          speaker: (minecraftBot as any).botName,
          role: 'tool',
        });
      }

      throw error;
    }
  });
}

export function createUnifiedMcpServer(minecraftBot: MinecraftBot) {
  const bot = minecraftBot.getBot();
  const server: any = createSdkMcpServer({
    name: 'minecraft',
    version: '1.0.0-unified',
    tools: [
      loggingTool('send_chat', 'Send a message to all players in the chat', { message: z.string() }, async ({ message }) => {
        try { minecraftBot.chat(message); return { content: [{ type: 'text', text: `Sent: ${message}` }] }; }
        catch (e: any) { return { content: [{ type: 'text', text: `Failed: ${e.message}` }], isError: true }; }
      }, minecraftBot),
      loggingTool('get_position', 'Get current bot position', {}, async () => {
        const p = bot.entity?.position; if (!p) return { content: [{ type: 'text', text: 'Not spawned' }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }) }] };
      }, minecraftBot),
      loggingTool('get_vox', 'Local voxel snapshot and safety predicates', { radius: z.number().optional(), include_air: z.boolean().optional() }, async ({ radius = 2, include_air = false }) => {
        const { get_vox } = await import('../craftscript/env.js');
        const snap = await get_vox(bot, radius, include_air);
        const pose = { heading: 'E', feet_world: [Math.floor(bot.entity.position.x), Math.floor(bot.entity.position.y), Math.floor(bot.entity.position.z)] };
        return { content: [{ type: 'text', text: JSON.stringify({ version: 'mcrn-vox/1.1', pose, ts: Math.floor(Date.now()/1000), ...snap }) }] };
      }, minecraftBot),
      loggingTool('affordances', 'Affordances at selector', { selector: z.string() }, async ({ selector }) => {
        const { affordances } = await import('../craftscript/env.js');
        const selAst = selectorKeyToAst(selector);
        return { content: [{ type: 'text', text: JSON.stringify(affordances(bot, selAst)) }] };
      }, minecraftBot),
      loggingTool('nearest', 'Find nearest block/entity', { block_id: z.string().optional(), entity_id: z.string().optional(), radius: z.number().optional(), reachable: z.boolean().optional() }, async (params) => {
        const { nearest } = await import('../craftscript/env.js');
        const res = await nearest(bot, params as any);
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      }, minecraftBot),
      loggingTool('block_info', 'Block info by id or selector', { id: z.string().optional(), selector: z.string().optional() }, async ({ id, selector }) => {
        const { block_info } = await import('../craftscript/env.js');
        const info = block_info(bot, { id, selector: selector ? selectorKeyToAst(selector) as any : undefined });
        return { content: [{ type: 'text', text: JSON.stringify(info) }] };
      }, minecraftBot),
      loggingTool('get_topography', 'Heightmap & slope around bot', { radius: z.number().optional() }, async ({ radius }) => {
        const { get_topography } = await import('../craftscript/env.js');
        return { content: [{ type: 'text', text: JSON.stringify(get_topography(bot, radius ?? 6)) }] };
      }, minecraftBot),
      loggingTool('nav', 'Navigation wrapper (start/status/cancel)', { action: z.enum(['start','status','cancel']), nav_id: z.string().optional(), target: z.object({ type: z.literal('WORLD'), x: z.number(), y: z.number(), z: z.number() }).or(z.object({ type: z.literal('SELECTOR'), sel: z.string() })).optional(), tol: z.number().optional(), timeout_ms: z.number().optional(), policy: z.object({ allow_dig: z.boolean().optional(), max_drop: z.number().optional(), max_step: z.number().optional() }).optional() }, async (params) => {
        const { nav } = await import('../craftscript/env.js');
        const req: any = { ...params };
        if (req.target?.type === 'SELECTOR' && typeof req.target.sel === 'string') req.target.sel = selectorKeyToAst(req.target.sel);
        return { content: [{ type: 'text', text: JSON.stringify(nav(bot, req)) }] };
      }, minecraftBot),
      loggingTool('craftscript_start', 'Start CraftScript in background; returns job_id', { script: z.string() }, async ({ script }) => {
        const { createCraftscriptJob } = await import('./craftscriptJobs.js');
        try { const enable = (process.env.CRAFTSCRIPT_CHAT_ENABLED ?? 'true').toLowerCase() !== 'false'; if (enable) { const max = Math.max(0, parseInt(process.env.CRAFTSCRIPT_CHAT_PREVIEW_LINES ?? '12', 10)); const lines = String(script||'').split(/\r?\n/); const preview = max>0?lines.slice(0,max).join('\n'):''; const suffix=max>0&&lines.length>max?`\n… ${lines.length-max} more line(s)`:''; minecraftBot.chat(`Start CraftScript (${lines.length} lines)\n\`\`\`c\n${preview}${suffix}\n\`\`\``);} } catch {}
        const id = createCraftscriptJob(minecraftBot, script);
        return { content: [{ type: 'text', text: JSON.stringify({ job_id: id, state: 'queued' }) }] };
      }, minecraftBot),
      loggingTool('craftscript_status', 'Poll CraftScript job status', { job_id: z.string() }, async ({ job_id }) => {
        const { getCraftscriptStatus } = await import('./craftscriptJobs.js');
        const status = getCraftscriptStatus(job_id);
        return { content: [{ type: 'text', text: JSON.stringify(status || { ok: false, error: 'not_found' }) }] };
      }, minecraftBot),
      loggingTool('craftscript_cancel', 'Cancel CraftScript job', { job_id: z.string() }, async ({ job_id }) => {
        const { cancelCraftscriptJob } = await import('./craftscriptJobs.js');
        cancelCraftscriptJob(job_id);
        return { content: [{ type: 'text', text: JSON.stringify({ job_id, state: 'canceled' }) }] };
      }, minecraftBot),
    ],
  });
  if (!server.manifest) server.manifest = { name: 'minecraft', tools: [{ name: 'send_chat' }, { name: 'get_position' }, { name: 'get_vox' }, { name: 'affordances' }, { name: 'nearest' }, { name: 'block_info' }, { name: 'get_topography' }, { name: 'nav' }, { name: 'craftscript_start' }, { name: 'craftscript_status' }, { name: 'craftscript_cancel' }] };
  return server;
}

// Back-compat exports
export const createMinecraftMcpServer = createUnifiedMcpServer;
export const createPlannerMcpServer = createUnifiedMcpServer;

