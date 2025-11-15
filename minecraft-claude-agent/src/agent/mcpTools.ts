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
      /**
       * Sends a single plaintext chat line without formatting or emojis.
       * @remarks Input: `{ message: string }` and must be <= 1–2 sentences with no newlines.
       * @returns MCP text payload confirming the send or describing the failure.
       */
      loggingTool('send_chat', 'Send message to in-game chat. IMPORTANT: Single line only, NO markdown/formatting, NO newlines, NO emojis. Keep short and readable for game chat (max 1-2 sentences).', { message: z.string() }, async ({ message }) => {
        try { minecraftBot.chat(message); return { content: [{ type: 'text', text: `Sent: ${message}` }] }; }
        catch (e: any) { return { content: [{ type: 'text', text: `Failed: ${e.message}` }], isError: true }; }
      }, context),
      /**
       * Fetches the bot's integer world coordinates.
       * @remarks Input: `{}` (none).
       * @returns `{ x, y, z }` as a JSON string or `Not spawned` if the entity is missing.
       */
      loggingTool('get_position', 'Get current bot position', {}, async () => {
        const p = bot.entity?.position; if (!p) return { content: [{ type: 'text', text: 'Not spawned' }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }) }] };
      }, context),
      /**
       * Comprehensive status snapshot combining position, local vox, inventory, nearby players, and nearby items.
       * @remarks Input: `{}` (none).
       * @returns JSON with position, vox (3x3x3), inventory, nearby players (within 32 blocks), and nearby items (within 8 blocks).
       */
      loggingTool('get_status', 'Get comprehensive bot status including position, 3x3 vox, inventory, nearby players (32 blocks), and nearby items (8 blocks)', {}, async () => {
        const { get_inventory } = await import('../tools/inventory/get_inventory.js');
        const { get_vox } = await import('../craftscript/env.js');

        // Get position
        const p = bot.entity?.position;
        if (!p) return { content: [{ type: 'text', text: 'Not spawned' }], isError: true };
        const position = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };

        // Get 3x3x3 vox (radius 1)
        const vox = await get_vox(bot, 1, false);

        // Get inventory (returns formatted text, not JSON)
        const inventory = await get_inventory(bot);

        // Get nearby players (within 32 blocks)
        const players = Object.values(bot.players || {})
          .filter((player: any) => player.entity && player.username !== bot.username)
          .map((player: any) => {
            const pos = player.entity.position;
            const distance = p.distanceTo(pos);
            if (distance > 32) return null;
            return {
              username: player.username,
              distance: Math.floor(distance),
              position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) }
            };
          })
          .filter(Boolean);

        // Get nearby items (within 8 blocks that can be picked up)
        const nearbyItems = Object.values(bot.entities || {})
          .filter((entity: any) => {
            if (entity.type !== 'object' || entity.name !== 'item') return false;
            const distance = p.distanceTo(entity.position);
            return distance <= 8;
          })
          .map((entity: any) => {
            const distance = p.distanceTo(entity.position);
            return {
              item: entity.metadata?.[8]?.itemId || entity.metadata?.[7]?.itemId || 'unknown',
              count: entity.metadata?.[8]?.itemCount || entity.metadata?.[7]?.itemCount || 1,
              distance: Math.floor(distance * 10) / 10,
              position: { x: Math.floor(entity.position.x), y: Math.floor(entity.position.y), z: Math.floor(entity.position.z) }
            };
          });

        const status = {
          position,
          vox,
          inventory,
          players,
          items: nearbyItems
        };

        return { content: [{ type: 'text', text: JSON.stringify(status) }] };
      }, context),
      /**
       * Returns every occupied inventory slot with slot index, item id, and count.
       * @remarks Input: `{}` (none). Uses `tools/inventory/get_inventory`.
       * @returns JSON encoded inventory summary for LLM reasoning.
       */
      loggingTool('get_inventory', 'Get current bot inventory contents', {}, async () => {
        const { get_inventory } = await import('../tools/inventory/get_inventory.js');
        const result = await get_inventory(bot);
        return { content: [{ type: 'text', text: result }] };
      }, context),
      // Note: Storage interactions are intentionally NOT exposed as direct tools.
      // Use CraftScript commands only: open/close, container_put/take, deposit/withdraw.
      /**
       * Captures a voxel snapshot centered on the bot for short-range spatial reasoning.
       * @remarks Input: `{ radius?: number, include_air?: boolean, grep?: string[], filter?: string[] }`.
       * @returns JSON text describing sampled voxels, including block ids and coordinates.
       */
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
      /**
       * Reports movement affordances (safe stands, climbs, drops) for a given block.
       * @remarks Input: `{ x: number, y: number, z: number }`.
       * @returns JSON summary of what the agent can do at that location.
       */
      loggingTool('affordances', 'Affordances at world position', { x: z.number(), y: z.number(), z: z.number() }, async ({ x, y, z }) => {
        const { affordances } = await import('../craftscript/env.js');
        return { content: [{ type: 'text', text: JSON.stringify(affordances(bot, { x, y, z })) }] };
      }, context),
      /**
       * Finds the nearest block or entity that matches optional filters/constraints.
       * @remarks Input: `{ block_id?: string, entity_id?: string, radius?: number, reachable?: boolean }`.
       * @returns JSON payload with the closest match, coordinates, and distance info.
       */
      loggingTool('nearest', 'Find nearest block/entity', { block_id: z.string().optional(), entity_id: z.string().optional(), radius: z.number().optional(), reachable: z.boolean().optional() }, async (params) => {
        const { nearest } = await import('../craftscript/env.js');
        const res = await nearest(bot, params as any);
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      }, context),
      /**
       * Retrieves metadata about a block either by world coordinates or block id lookup.
       * @remarks Input: `{ id?: string, x?: number, y?: number, z?: number }`.
       * @returns JSON string detailing block name, hardness, tool requirements, etc.
       */
      loggingTool('block_info', 'Block info by id or x/y/z position', { id: z.string().optional(), x: z.number().optional(), y: z.number().optional(), z: z.number().optional() }, async ({ id, x, y, z }) => {
        const { block_info } = await import('../craftscript/env.js');
        const info = block_info(bot, { id, x, y, z });
        return { content: [{ type: 'text', text: JSON.stringify(info) }] };
      }, context),
      /**
       * Emits a top-down ASCII map for situational awareness with optional zoom/filter tweaks.
       * @remarks Input: `{ radius?: number, zoom?: number, grep?: string[], filter?: string[] }`.
       * @returns ASCII map text where each cell encodes elevation (+ optional filters).
       */
      loggingTool('look_at_map', 'Top-down 2D map for fast orientation (world x/z cells). Each cell summarizes a zoom block; symbols show relative height (▲/•/▼).', { radius: z.number().optional(), zoom: z.number().optional(), grep: z.array(z.string()).optional(), filter: z.array(z.string()).optional() }, async ({ radius, zoom, grep, filter }) => {
        const { look_at_map } = await import('../craftscript/env.js');
        const patterns = (grep && Array.isArray(grep) ? grep : (filter && Array.isArray(filter) ? filter : undefined));
        return { content: [{ type: 'text', text: JSON.stringify(look_at_map(bot, radius ?? 10, zoom ?? 1, patterns as any)) }] };
      }, context),
      /**
       * Emits a preconfigured 4× zoom ASCII map for medium-range scouting.
       * @remarks Input: `{ radius?: number }`.
       * @returns JSON string containing the rendered map.
       */
      loggingTool('look_at_map_4', 'Birds eye view with 4x zoom (4x4 blocks per cell) for medium range scanning', { radius: z.number().optional() }, async ({ radius }) => {
        const { look_at_map } = await import('../craftscript/env.js');
        return { content: [{ type: 'text', text: JSON.stringify(look_at_map(bot, radius ?? 20, 4)) }] };
      }, context),
      /**
       * Emits a preconfigured 5× zoom ASCII map for long-range scouting.
       * @remarks Input: `{ radius?: number }`.
       * @returns JSON string containing the rendered map.
       */
      loggingTool('look_at_map_5', 'Birds eye view with 5x zoom (5x5 blocks per cell) for long range scanning', { radius: z.number().optional() }, async ({ radius }) => {
        const { look_at_map } = await import('../craftscript/env.js');
        return { content: [{ type: 'text', text: JSON.stringify(look_at_map(bot, radius ?? 25, 5)) }] };
      }, context),
      /**
       * Queues a CraftScript program for asynchronous execution.
       * @remarks Input: `{ script: string }` CraftScript source code.
       * @returns `{ job_id, state }` JSON payload once the job is enqueued.
       */
      loggingTool('craftscript_start', 'Start CraftScript asynchronously. Response only confirms `{ job_id, state: "queued" }` — ALWAYS poll `craftscript_status` / `craftscript_logs` to learn whether it compiled, failed, or completed.', { script: z.string() }, async ({ script }) => {
        const { createCraftscriptJob } = await import('./craftscriptJobs.js');
        if ((process.env.CRAFTSCRIPT_CHAT_ENABLED ?? 'false').toLowerCase() !== 'false') {
          try {
            const lines = String(script || '').split(/\r?\n/);
            const max = Math.max(0, parseInt(process.env.CRAFTSCRIPT_CHAT_PREVIEW_LINES ?? '4', 10));
            const suffix = max > 0 && lines.length > max ? `… ${lines.length - max} more line(s)` : '';
            minecraftBot.chat(`Start CraftScript (${lines.length} lines) ${suffix}`.trim());
          } catch {}
        }
        const id = createCraftscriptJob(minecraftBot, script, context.activityWriter as any, context.botName, context.memoryStore as any, context.getSessionId);
        return { content: [{ type: 'text', text: JSON.stringify({ job_id: id, state: 'queued' }) }] };
      }, context),
      /**
       * Polls the current status of a CraftScript job.
       * @remarks Input: `{ job_id: string }`.
       * @returns JSON status including state, last_step, and optional error.
       */
      loggingTool('craftscript_status', 'Poll CraftScript job status (state + last_step + error). Use this immediately after `craftscript_start` to see if the script compiled, started running, failed, or finished.', { job_id: z.string() }, async ({ job_id }) => {
        const { getCraftscriptStatus } = await import('./craftscriptJobs.js');
        const status = getCraftscriptStatus(job_id);
        return { content: [{ type: 'text', text: JSON.stringify(status || { ok: false, error: 'not_found' }) }] };
      }, context),
      /**
       * Streams consolidated CraftScript logs (status, steps, traces) for auditing.
       * @remarks Input: `{ job_id: string, limit?: number }`.
       * @returns JSON object with ordered logs suitable for timeline rendering.
       */
      loggingTool('craftscript_logs', 'Fetch consolidated CraftScript logs for a job (status + steps + traces). Falls back to the live runtime snapshot when the database has no rows yet so you can still see whether the job is queued, failed, or done.', { job_id: z.string(), limit: z.number().optional() }, async ({ job_id, limit = 300 }) => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const { getCraftscriptStatus } = await import('./craftscriptJobs.js');
        const colonyDb = ColonyDatabase.getInstance();
        const db = colonyDb.getDb();
        // Resolve bot_id from bot name
        const botId = colonyDb.getBotId(context.botName);
        if (!botId) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }], isError: true } as any;

        const rows = db.prepare(
          `SELECT type, description, timestamp, data
           FROM activities
           WHERE bot_id = ? AND data LIKE ?
           ORDER BY timestamp ASC
           LIMIT ?`
        ).all(botId, `%${job_id}%`, Math.max(1, Math.min(1000, Number(limit))));

        const out: any = { job_id, status: null, error: null, logs: [] as any[] };
        for (const r of rows as any[]) {
          let data: any = {};
          try { data = r.data ? JSON.parse(String(r.data)) : {}; } catch {}
          const tool = String(data?.name || '').toLowerCase();
          const ts = (Number(r.timestamp) || 0) * 1000;
          if (tool === 'craftscript_status') {
            let payload: any = {};
            try { payload = data?.output ? JSON.parse(String(data.output)) : {}; } catch {}
            out.status = payload?.state || out.status || null;
            if (payload?.error) out.error = payload.error;
            out.logs.push({ kind: 'status', ts, data: payload });
            continue;
          }
          if (tool === 'craftscript_step') {
            let payload: any = {};
            try { payload = data?.output ? JSON.parse(String(data.output)) : {}; } catch {}
            const step = payload?.step || payload;
            out.logs.push({ kind: step?.ok ? 'ok' : 'fail', ts, data: step });
            continue;
          }
          if (tool === 'craftscript_trace') {
            let payload: any = {};
            try { payload = data?.output ? JSON.parse(String(data.output)) : {}; } catch {}
            const trace = payload?.trace || payload;
            out.logs.push({ kind: 'trace', ts, data: trace });
            continue;
          }
        }
        const attachRuntimeSnapshot = () => {
          const runtime = getCraftscriptStatus(job_id);
          if (!runtime) return;
          const runtimeSnapshot = {
            id: runtime.id,
            state: runtime.state,
            error: runtime.error ?? null,
            last_step: runtime.lastStep ?? null,
            started_at: runtime.startedAt ?? null,
            ended_at: runtime.endedAt ?? null
          };
          out.status = out.status ?? runtimeSnapshot.state;
          if (!out.error && runtimeSnapshot.error) out.error = runtimeSnapshot.error;
          out.logs.push({ kind: 'runtime_status', ts: Date.now(), data: runtimeSnapshot });
        };
        if (!rows.length || !out.status) {
          attachRuntimeSnapshot();
        }
        return { content: [{ type: 'text', text: JSON.stringify(out) }] };
      }, context),
      /**
       * Cancels a queued or running CraftScript job.
       * @remarks Input: `{ job_id: string }`.
       * @returns `{ job_id, state: 'canceled' }` confirmation payload.
       */
      loggingTool('craftscript_cancel', 'Cancel CraftScript job', { job_id: z.string() }, async ({ job_id }) => {
        const { cancelCraftscriptJob } = await import('./craftscriptJobs.js');
        cancelCraftscriptJob(job_id);
        return { content: [{ type: 'text', text: JSON.stringify({ job_id, state: 'canceled' }) }] };
      }, context),
      /**
       * Retrieves full CraftScript traces including block changes and movement history.
       * @remarks Input: `{ job_id: string }`.
       * @returns JSON with `{ job_id, total_changes, changes[] }` sorted chronologically.
       */
      loggingTool('craftscript_trace', 'Retrieve all traces for a CraftScript job including block changes (placed/destroyed) and movement. Returns chronological list with coordinates, block types, commands, positions, and timestamps. Useful for verifying builds, debugging paths, testing, and creating visualizations. Every modification and movement is tracked automatically even if the script fails.', {
        job_id: z.string()
      }, async ({ job_id }) => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const db = colonyDb.getDb();
        const botId = colonyDb.getBotId(context.botName);
        if (!botId) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }], isError: true } as any;

        try {
          const changes = db.prepare(`
            SELECT action, x, y, z, block_id, previous_block_id, command, timestamp
            FROM craftscript_block_changes
            WHERE job_id = ? AND bot_id = ?
            ORDER BY timestamp ASC
          `).all(job_id, botId);

          const result = {
            job_id,
            bot_id: botId,
            total_changes: changes.length,
            changes
          };

          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: error.message }) }], isError: true } as any;
        }
      }, context),

      // Custom CraftScript Function Management
      /**
       * Registers a new versioned CraftScript function available to future jobs.
       * @remarks Input: `{ name, description?, args: {name,type,...}[], body }`.
       * @returns JSON containing the persisted function id and initial version.
       */
      loggingTool('create_craftscript_function', 'Create a new reusable CraftScript function with automatic versioning. Functions are persistent across sessions and can be called from any CraftScript. Args must specify {name, type, optional?, default?} where type is \"int\", \"bool\", or \"string\". Body is CraftScript code that can reference arg names as variables.', {
        name: z.string(),
        description: z.string().optional(),
        args: z.array(z.object({
          name: z.string(),
          type: z.enum(['int', 'bool', 'string']),
          optional: z.boolean().optional(),
          default: z.any().optional()
        })),
        body: z.string()
      }, async ({ name, description, args, body }) => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const db = colonyDb.getDb();
        const botId = colonyDb.getBotId(context.botName);
        if (!botId) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }] };

        const now = Date.now();
        const cleanBody = sanitizeScriptBody(body);
        try {
          const result = db.prepare(`
            INSERT INTO craftscript_functions (bot_id, name, description, args, body, current_version, created_at, updated_at, created_by)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
          `).run(botId, name, description || null, JSON.stringify(args), cleanBody, now, now, context.botName);

          const functionId = Number(result.lastInsertRowid);

          // Create version 1 entry
          db.prepare(`
            INSERT INTO craftscript_function_versions (function_id, version, body, description, args, created_at, created_by, change_summary)
            VALUES (?, 1, ?, ?, ?, ?, ?, 'Initial version')
          `).run(functionId, cleanBody, description || null, JSON.stringify(args), now, context.botName);

          return { content: [{ type: 'text', text: JSON.stringify({ ok: true, id: functionId, name, version: 1 }) }] };
        } catch (error: any) {
          if (error.message?.includes('UNIQUE constraint')) {
            return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'function_exists', message: `Function "${name}" already exists` }) }] };
          }
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'database_error', message: error.message }) }] };
        }
      }, context),

      /**
       * Creates a new version of an existing CraftScript function (edit in place).
       * @remarks Input: `{ name, description?, args?, body?, change_summary? }`.
       * @returns JSON showing previous/current version numbers and bodies.
       */
      loggingTool('edit_craftscript_function', 'Update an existing CraftScript function. Creates a new version automatically (increments version number). You can update body, description, args, or any combination. Use change_summary to document what changed. Previous versions are preserved and can be viewed with list_function_versions.', {
        name: z.string(),
        description: z.string().optional(),
        args: z.array(z.object({
          name: z.string(),
          type: z.enum(['int', 'bool', 'string']),
          optional: z.boolean().optional(),
          default: z.any().optional()
        })).optional(),
        body: z.string().optional(),
        change_summary: z.string().optional()
      }, async ({ name, description, args, body, change_summary }) => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const db = colonyDb.getDb();
        const botId = colonyDb.getBotId(context.botName);
        if (!botId) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }] };

        const now = Date.now();
        const cleanBody = body !== undefined ? sanitizeScriptBody(body) : undefined;
        try {
          // Get current function
          const func = db.prepare('SELECT * FROM craftscript_functions WHERE bot_id = ? AND name = ?').get(botId, name) as any;
          if (!func) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'not_found', message: `Function "${name}" not found` }) }] };

          const newVersion = func.current_version + 1;
          const newBody = cleanBody !== undefined ? cleanBody : func.body;
          const newDescription = description !== undefined ? description : func.description;
          const newArgs = args !== undefined ? JSON.stringify(args) : func.args;

          // Update main function record
          db.prepare(`
            UPDATE craftscript_functions
            SET body = ?, description = ?, args = ?, current_version = ?, updated_at = ?
            WHERE id = ?
          `).run(newBody, newDescription, newArgs, newVersion, now, func.id);

          // Create new version entry
          db.prepare(`
            INSERT INTO craftscript_function_versions (function_id, version, body, description, args, created_at, created_by, change_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(func.id, newVersion, newBody, newDescription, newArgs, now, context.botName, change_summary || 'Updated');

          return { content: [{ type: 'text', text: JSON.stringify({
            ok: true,
            name,
            version: newVersion,
            previous_version: func.current_version,
            previous_body: func.body,
            new_body: newBody
          }) }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'database_error', message: error.message }) }] };
        }
      }, context),

      /**
       * Permanently deletes a CraftScript function (and all stored versions).
       * @remarks Input: `{ name: string }`.
       * @returns `{ ok: true, name, deleted: true }` or not_found errors.
       */
      loggingTool('delete_craftscript_function', 'Permanently delete a CraftScript function and ALL its version history. This cannot be undone. Use with caution.', {
        name: z.string()
      }, async ({ name }) => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const db = colonyDb.getDb();
        const botId = colonyDb.getBotId(context.botName);
        if (!botId) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }] };

        try {
          const result = db.prepare('DELETE FROM craftscript_functions WHERE bot_id = ? AND name = ?').run(botId, name);
          if (result.changes === 0) {
            return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'not_found', message: `Function "${name}" not found` }) }] };
          }
          return { content: [{ type: 'text', text: JSON.stringify({ ok: true, name, deleted: true }) }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'database_error', message: error.message }) }] };
        }
      }, context),

      /**
       * Lists every CraftScript function owned by this bot with metadata.
       * @remarks Input: `{}` (none).
       * @returns JSON `{ ok: true, functions: [...] }` sorted alphabetically.
       */
      loggingTool('list_craftscript_functions', 'List all custom CraftScript functions created by this bot. Returns name, description, args, current_version, and timestamps for each function. Use this to discover available functions before calling them in CraftScript.', {}, async () => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const db = colonyDb.getDb();
        const botId = colonyDb.getBotId(context.botName);
        if (!botId) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }] };

        const functions = db.prepare(`
          SELECT id, name, description, args, current_version, created_at, updated_at
          FROM craftscript_functions
          WHERE bot_id = ?
          ORDER BY name ASC
        `).all(botId) as any[];

        const list = functions.map(f => ({
          id: f.id,
          name: f.name,
          description: f.description,
          args: JSON.parse(f.args),
          current_version: f.current_version,
          created_at: f.created_at,
          updated_at: f.updated_at
        }));

        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, functions: list, count: list.length }) }] };
      }, context),

      /**
       * Fetches the latest version of a specific CraftScript function.
       * @remarks Input: `{ name: string }`.
       * @returns JSON `{ ok: true, function: {...} }` or `not_found`.
       */
      loggingTool('get_craftscript_function', 'Get complete details of a specific CraftScript function including its current body, args, description, and version info. Use this to inspect a function before editing or to understand what it does.', {
        name: z.string()
      }, async ({ name }) => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const db = colonyDb.getDb();
        const botId = colonyDb.getBotId(context.botName);
        if (!botId) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }] };

        const func = db.prepare(`
          SELECT id, name, description, args, body, current_version, created_at, updated_at, created_by
          FROM craftscript_functions
          WHERE bot_id = ? AND name = ?
        `).get(botId, name) as any;

        if (!func) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'not_found', message: `Function "${name}" not found` }) }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify({
          ok: true,
          function: {
            id: func.id,
            name: func.name,
            description: func.description,
            args: JSON.parse(func.args),
            body: func.body,
            current_version: func.current_version,
            created_at: func.created_at,
            updated_at: func.updated_at,
            created_by: func.created_by
          }
        }) }] };
      }, context),

      /**
       * Lists version history entries for a CraftScript function.
       * @remarks Input: `{ name: string, limit?: number }`.
       * @returns JSON `{ ok: true, versions: [...] }` ordered newest first.
       */
      loggingTool('list_function_versions', 'List complete version history of a CraftScript function. Returns all versions with their body, args, timestamps, who created them, and change summaries. Useful for understanding how a function evolved or reverting to previous logic. Versions ordered newest first.', {
        name: z.string(),
        limit: z.number().optional()
      }, async ({ name, limit = 10 }) => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const db = colonyDb.getDb();
        const botId = colonyDb.getBotId(context.botName);
        if (!botId) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }] };

        // Get function ID
        const func = db.prepare('SELECT id FROM craftscript_functions WHERE bot_id = ? AND name = ?').get(botId, name) as any;
        if (!func) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'not_found', message: `Function "${name}" not found` }) }] };

        const versions = db.prepare(`
          SELECT version, body, description, args, created_at, created_by, change_summary, metadata
          FROM craftscript_function_versions
          WHERE function_id = ?
          ORDER BY version DESC
          LIMIT ?
        `).all(func.id, limit) as any[];

        const list = versions.map(v => ({
          version: v.version,
          body: v.body,
          description: v.description,
          args: JSON.parse(v.args),
          created_at: v.created_at,
          created_by: v.created_by,
          change_summary: v.change_summary,
          metadata: v.metadata ? JSON.parse(v.metadata) : null
        }));

        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, name, versions: list, count: list.length }) }] };
      }, context),

      /**
       * Creates an issue in the shared colony tracker with severity metadata.
       * @remarks Input: `{ title: string, description: string, severity?: 'low'|'medium'|'high'|'critical' }`.
       * @returns `{ ok: true, issue }` on success or validation errors.
       */
      loggingTool('report_bug', 'Report a bug or regression with a markdown description and reproduction steps.', {
        title: z.string().min(5),
        description: z.string().min(10),
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional()
      }, async ({ title, description, severity }) => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const botId = colonyDb.getBotId(context.botName);
        if (botId === null) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }], isError: true };
        }
        try {
          const issue = colonyDb.createIssue(botId, title, description, context.botName, severity || 'medium');
          return { content: [{ type: 'text', text: JSON.stringify({ ok: true, issue }) }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: error.message }) }], isError: true };
        }
      }, context),

      /**
       * Lists issues filtered by state/assignment for dashboard review.
       * @remarks Input: `{ state?: string, assigned?: 'me'|'any'|'none', limit?: number }`.
       * @returns JSON array of issue summaries respecting the filters.
       */
      loggingTool('list_issues', 'List issues from the tracker. By default returns issues assigned to this bot that are not closed.', {
        state: z.string().optional(),
        assigned: z.enum(['me', 'any', 'none']).optional(),
        limit: z.number().min(1).max(100).optional()
      }, async ({ state, assigned = 'me', limit = 20 }) => {
        const { ColonyDatabase, ISSUE_STATES } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const botId = colonyDb.getBotId(context.botName);
        if (botId === null && assigned === 'me') {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'bot_not_found' }) }], isError: true };
        }

        let states: string[] | undefined;
        if (state) {
          const requested = state.split(',').map((s) => s.trim()).filter(Boolean);
          const invalid = requested.filter((s) => !ISSUE_STATES.includes(s as any));
          if (invalid.length) {
            return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: `invalid_state`, details: invalid }) }], isError: true };
          }
          states = requested;
        } else {
          states = ISSUE_STATES.filter((s: string) => !['resolved', 'closed'].includes(s));
        }

        const filters: any = { state: states, limit };
        if (assigned === 'me') {
          filters.assignedBotId = botId;
        } else if (assigned === 'none') {
          filters.assignedBotId = null;
        }

        const issues = colonyDb.listIssues(filters);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, count: issues.length, issues }) }] };
      }, context),

      /**
       * Retrieves full issue detail including comments and assignment metadata.
       * @remarks Input: `{ id: number }`.
       * @returns `{ ok: true, issue }` or `not_found`.
       */
      loggingTool('get_issue', 'Get details for a single issue, including comments and current assignment.', {
        id: z.number().int().positive()
      }, async ({ id }) => {
        const { ColonyDatabase } = await import('../database/ColonyDatabase.js');
        const colonyDb = ColonyDatabase.getInstance();
        const detail = colonyDb.getIssueDetail(id);
        if (!detail) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'not_found' }) }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, issue: detail.issue, comments: detail.comments }) }] };
      }, context),

      // Memory tools
      /**
       * Returns the markdown-based long-term memory for the current bot.
       * @remarks Input: `{}` (none).
       * @returns Plain markdown string representing remembered context.
       */
      loggingTool('get_memory', 'Get bot memory as markdown text. Returns what the bot remembers.', {}, async () => {
        const { getMemoryText } = await import('../tools/memory/memory.js');
        const text = await getMemoryText(context.botName);
        return { content: [{ type: 'text', text }] };
      }, context),
      /**
       * Replaces the markdown memory blob with fresh content.
       * @remarks Input: `{ content: string }`.
       * @returns Text confirmation once persisted.
       */
      loggingTool('update_memory', 'Update bot memory with markdown text. Replaces entire memory content.', { content: z.string() }, async ({ content: memoryContent }) => {
        const { updateMemoryText } = await import('../tools/memory/memory.js');
        await updateMemoryText(context.botName, memoryContent);
        return { content: [{ type: 'text', text: 'Memory updated successfully' }] };
      }, context),

      // Blueprint tools
      /**
       * Lists blueprint metadata (name, description, counts) stored on disk.
       * @remarks Input: `{}` (none).
       * @returns JSON array of blueprint summaries.
       */
      loggingTool('list_blueprints', 'List stored blueprints (name, description, count)', {}, async () => {
        const { listBlueprints } = await import('../tools/blueprints/storage.js');
        const list = listBlueprints();
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
      }, context),
      /**
       * Creates a new blueprint JSON document from raw vox data.
       * @remarks Input: `{ name, description?, vox: Array<{x,y,z,id,face?,label?}> }`.
       * @returns JSON blueprint payload including validation info.
       */
      loggingTool('create_blueprint', 'Create a new blueprint with vox at origin (0,0,0). Vox is an array of {x,y,z,id,face?}.', {
        name: z.string(),
        description: z.string().optional(),
        vox: z.array(z.object({ x: z.number(), y: z.number(), z: z.number(), id: z.string(), face: z.enum(['up','down','north','south','east','west']).optional(), label: z.string().optional() })),
      }, async ({ name, description, vox }) => {
        const { createBlueprint } = await import('../tools/blueprints/storage.js');
        const bp = createBlueprint({ name, description, vox } as any);
        return { content: [{ type: 'text', text: JSON.stringify(bp) }] };
      }, context),
      /**
       * Updates blueprint vox data or description in place.
       * @remarks Input: `{ name, description?, vox? }`.
       * @returns JSON blueprint payload after update.
       */
      loggingTool('update_blueprint', 'Update an existing blueprint; can change description and vox.', {
        name: z.string(),
        description: z.string().optional(),
        vox: z.array(z.object({ x: z.number(), y: z.number(), z: z.number(), id: z.string(), face: z.enum(['up','down','north','south','east','west']).optional(), label: z.string().optional() })).optional(),
      }, async ({ name, description, vox }) => {
        const { updateBlueprint } = await import('../tools/blueprints/storage.js');
        const bp = updateBlueprint(name, { description, vox } as any);
        return { content: [{ type: 'text', text: JSON.stringify(bp) }] };
      }, context),
      /**
       * Deletes a blueprint file from storage.
       * @remarks Input: `{ name: string }`.
       * @returns `{ ok: boolean }` JSON flag.
       */
      loggingTool('remove_blueprint', 'Remove a blueprint by name', { name: z.string() }, async ({ name }) => {
        const { removeBlueprint } = await import('../tools/blueprints/storage.js');
        const ok = removeBlueprint(name);
        return { content: [{ type: 'text', text: JSON.stringify({ ok }) }] };
      }, context),
      /**
       * Loads a blueprint and returns validation issues (if any).
       * @remarks Input: `{ name: string }`.
       * @returns `{ ok, issues, blueprint }` JSON payload.
       */
      loggingTool('get_blueprint', 'Get a blueprint by name with validation issues if any', { name: z.string() }, async ({ name }) => {
        const { getBlueprint, validateBlueprint } = await import('../tools/blueprints/storage.js');
        const bp = getBlueprint(name);
        if (!bp) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'not_found' }) }], isError: true } as any;
        const v = validateBlueprint(bp as any);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: v.ok, issues: v.issues, blueprint: bp }) }] };
      }, context),
      /**
       * Rotates/translates a blueprint to a target world origin for planning.
       * @remarks Input: `{ name, origin: {x,y,z}, rotation?: 0|90|180|270 }`.
       * @returns `{ ok: true, voxels }` JSON payload for placement previews.
       */
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
    { name: 'send_chat' }, { name: 'get_position' }, { name: 'get_status' }, { name: 'get_inventory' }, { name: 'get_vox' }, { name: 'affordances' },
    { name: 'nearest' }, { name: 'block_info' }, { name: 'look_at_map' }, { name: 'look_at_map_4' }, { name: 'look_at_map_5' },
    { name: 'craftscript_start' }, { name: 'craftscript_status' }, { name: 'craftscript_cancel' }, { name: 'craftscript_trace' },
    { name: 'create_craftscript_function' }, { name: 'edit_craftscript_function' }, { name: 'delete_craftscript_function' },
    { name: 'list_craftscript_functions' }, { name: 'get_craftscript_function' }, { name: 'list_function_versions' },
    { name: 'get_memory' }, { name: 'update_memory' },
    { name: 'list_blueprints' }, { name: 'create_blueprint' }, { name: 'update_blueprint' }, { name: 'remove_blueprint' }, { name: 'get_blueprint' }, { name: 'instantiate_blueprint' }
  ] };
  return server;
}

// Back-compat exports
export const createMinecraftMcpServer = createUnifiedMcpServer;
export const createPlannerMcpServer = createUnifiedMcpServer;
function sanitizeScriptBody(input: string): string {
  if (!input) return '';
  let body = String(input);
  body = body
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  if (/<\/?[a-z][^>]*>/i.test(body)) {
    body = body.replace(/<[^>]+>/g, '');
  }
  return body;
}
