import { createPlannerMcpServer } from '../../agent/mcpTools.js';

class FakeBot { username = 'TestBot'; entity?: any; inventory:any={items:()=>[]}; pathfinder:any={}; game:any={}; version:any='1.20'; blockAt(){return null;} lookAt(){return;}
}
class FakeMinecraftBot { private inner = new FakeBot(); getBot(){ return this.inner as any; } }

function extractToolNames(manifest: any): string[] {
  const names: string[] = [];
  const tools = manifest?.tools;
  if (!tools) return names;
  if (Array.isArray(tools)) {
    for (const t of tools) { if (t?.name) names.push(t.name); }
  } else if (tools instanceof Map) {
    for (const t of tools.values()) { if (t?.name) names.push(t.name); }
  } else if (typeof tools === 'object') {
    for (const [k, v] of Object.entries<any>(tools)) { names.push(v?.name || k); }
  }
  return names;
}

function assert(cond: any, msg: string){ if(!cond){ console.error('FAIL:', msg); process.exit(1); } }

async function main(){
  const server: any = createPlannerMcpServer(new FakeMinecraftBot() as any);
  const manifest = (server && (server.manifest || server.getManifest && server.getManifest())) || {};
  const names = extractToolNames(manifest);
  // Required tools present
  const mustHave = ['enqueue_job','get_job_status','pause_job','resume_job','cancel_job','get_position','list_waypoints','get_waypoint','detect_time_of_day','detect_biome','scan_biomes_in_area','get_nearby_blocks','analyze_surroundings','send_chat'];
  mustHave.forEach(n=>assert(names.some(t=>t===n || t.endsWith(`__${n}`)), `expected tool '${n}'`));
  // Mutation tools absent
  const mustNot = ['dig_block','place_block','craft_item','build_pillar','move_to_position','look_at','use_item_on_block','deposit_items','withdraw_items'];
  mustNot.forEach(n=>assert(!names.some(t=>t===n || t.endsWith(`__${n}`)), `forbidden tool '${n}' present`));
  console.log('PASS: Planner MCP tool manifest restricted');
}

main().catch((e)=>{ console.error('FAIL:', e); process.exit(1); });
