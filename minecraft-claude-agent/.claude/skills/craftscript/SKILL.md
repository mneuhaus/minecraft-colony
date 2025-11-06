---
name: craftscript
description: Write safe, minimal CraftScript using world(x,y,z) coordinates for movement and block actions. Use read-only tools to plan, then execute with strong guardrails and report clear errors.
allowed-tools: craftscript_start, craftscript_status, craftscript_cancel, nav, get_vox, block_info, affordances, nearest, get_topography, send_chat
---

# CraftScript (World Coordinates) – Safe Execution Guide

Use world(x,y,z) for precise actions. Always inspect first, plan in small steps, and rely on guardrails that return specific error codes when an action is unsafe or impossible.

## Read-Only Scouting

- get_position() → { x,y,z }
- get_vox(radius, grep?) → voxels near the bot (x/y/z; matches for grep)
- look_at_map(radius, zoom, grep?) → 2D cells with relative height
- block_info({ x,y,z }) → block metadata at position
- nearest({ block_id|entity_id, radius, reachable? }) → candidates (world coords)
- affordances({ x,y,z }) → standability, placeable faces, safety hints

## Actions

- nav { action:'start', target:{ type:'WORLD', x,y,z }, tol?, timeout_ms? } → movement via pathfinder
- craftscript_start({ script }) → run CraftScript (see patterns below)
- craftscript_status({ job_id }) / craftscript_cancel({ job_id })

## Guardrails (Error Codes)

- dig:
  - no_target → there is no block to dig at that position
  - out_of_reach → target further than 4.5 blocks
  - invariant_violation: gravity_block_overhead → avoid opening into gravel/sand above
  - runtime_error → dig failed (engine reason)

- place:
  - unavailable → missing item in inventory
  - blocked: no reference to place against (check face)
  - out_of_reach → reference beyond reach (4.5)
  - runtime_error → place failed (engine reason)

- move/goto:
  - no_path → pathfinder couldn’t plan a path to world(x,y,z)

When you get an error, explain briefly what failed and propose a safer or smaller step (e.g., move closer first, pick another face, clear gravity overhead, scan again).

## Examples

### Move then Dig at a Coordinate (Safe)

```
repeat(1){
  // navigate near target
  goto(world(120, 64, -80), tol:1);
  // inspect
  scan(2);
  // dig the block if reachable
  dig(world(120, 64, -80));
}
```

### Place a Block Against a Face

```
// Equip and place a planks block at world position, facing up
place("minecraft:oak_planks", world(121, 64, -80), face: up);
```

### Short Navigation Script with Check

```
macro step_to(x:int,y:int,z:int){
  goto(world(x,y,z), tol:1);
}

repeat(3){ step_to(100,64,-10); }
```

## Strategy

1) Use get_vox/nearest/block_info to select exact targets.
2) If far, nav to a nearby safe location (tol≈1–2).
3) For dig/place:
   - Confirm reach ≤4.5 blocks
   - Avoid gravity-overhead before digging
   - For placing, ensure a solid reference on the chosen face
4) Handle errors explicitly; try a smaller/safer step.

Keep scripts short (≤20 lines) and stateful: verify after each risky op.

