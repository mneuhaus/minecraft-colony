---
name: craftscript
description: Write safe, minimal CraftScript using direct coordinates (x,y,z) for movement and block actions. Use read-only tools to plan, then execute with strong guardrails and report clear errors. ALL movement and block interaction must be done through CraftScript - do NOT use nav or other direct tools.
allowed-tools: craftscript_start, craftscript_status, craftscript_cancel, get_vox, block_info, affordances, get_topography, send_chat, get_position, get_inventory
---

# CraftScript (Direct Coordinates) – Safe Execution Guide

Use direct coordinates (x,y,z) for precise actions. Always inspect first, plan in small steps, and rely on guardrails that return specific error codes when an action is unsafe or impossible.

## Read-Only Scouting

Use these tools to gather information and plan your CraftScript actions:

- get_position() → { x,y,z } - Get bot's current position
- get_inventory() → list of all items in bot's inventory with counts
- get_vox(radius, grep?) → voxels near the bot (x/y/z; matches for grep)
- get_topography(radius) → 2D height map around bot
- block_info({ x,y,z }) → block metadata at position
- affordances({ x,y,z }) → standability, placeable faces, safety hints

## Execution

ALL movement and block interaction must be done through CraftScript:

- craftscript_start({ script }) → run CraftScript with movement/actions
- craftscript_status({ job_id }) → check CraftScript execution status
- craftscript_cancel({ job_id }) → cancel running CraftScript

**IMPORTANT**: Do NOT use `nav` or `nearest` tools directly. Use `goto()`, `dig()`, `place()`, etc. inside CraftScript instead.

## CraftScript Commands

**Block Interaction:**
- dig(x, y, z) or dig(selector) → dig block at position
- break(x, y, z) or break(selector) → alias for dig (better for breaking logs/wood)
- place(block_id, x, y, z) or place(block_id, selector) → place block at position
- build_up() or build_up(block_id) → jump and place block beneath (builds pillar upward)
- plant(sapling_id, x, y, z) → plant sapling/crop at position

**Movement & Navigation:**
- goto(x, y, z, tol:1) or goto(selector, tol:1) → navigate to position
- scan(radius) → refresh local voxel data

**Inventory:**
- equip(item_id) → equip tool or item
- pickup_blocks() or pickup_blocks(radius) → collect dropped items within radius (default 8 blocks)
- drop(item_id, count) → drop items from inventory

**Crafting & Containers:**
- craft(item_id, count) → craft items (auto-finds crafting table if needed)
- wait(ms) → wait/delay for milliseconds (max 300000 = 5 minutes)
// Low-level (slots)
- open_container(x, y, z) → open at position (alias: open)
- container_put(slot, item_id, count) → put items (slots: "input"/"fuel" for furnace or number for chest)
- container_take(slot, count) → take items (slots: "output" for furnace or number for chest)
- container_items() → list all items in the open container
- close_container() → close (alias: close)

// High-level (slotless shorthands)
- deposit([x,y,z,] item_id, count?) → deposit into container (opens/closes automatically when x,y,z provided). Omitting count deposits all of that item in inventory.
- withdraw([x,y,z,] item_id, count?) → withdraw from container (opens/closes automatically when x,y,z provided). Omitting count withdraws all available.

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

- build_up:
  - unavailable → no building blocks (dirt/cobblestone/stone/planks/log) in inventory
  - blocked: no reference block beneath → can't place block mid-air
  - runtime_error → jump or place failed (engine reason)

- move/goto:
  - no_path → pathfinder couldn't plan a path to coordinates

When you get an error, explain briefly what failed and propose a safer or smaller step (e.g., move closer first, pick another face, clear gravity overhead, scan again).

## Examples

### Move then Dig at a Coordinate (Safe)

```
repeat(1){
  // navigate near target
  goto(120, 64, -80, tol:1);
  // inspect
  scan(2);
  // dig the block if reachable
  dig(120, 64, -80);
}
```

### Place a Block Against a Face

```
// Equip and place a planks block at world position, facing up
place("minecraft:oak_planks", 121, 64, -80, face: up);
```

### Build Up (Jump and Place Beneath)

```
// Build a pillar 5 blocks high
repeat(5) {
  build_up();  // Auto-selects dirt/cobblestone/stone/planks/log
}

// Build with specific material
repeat(3) {
  build_up("dirt");  // Uses dirt blocks specifically
}

// Combine with navigation
goto(100, 64, -10, tol:1);
repeat(10) {
  build_up("cobblestone");  // Build 10-block cobblestone pillar
}
```

### Direct Coordinates vs Selectors

```
// Using direct coordinates (x, y, z)
dig(106, 67, 82);
place("stone", 106, 67, 82);
goto(106, 67, 82, tol:1);

// Using selectors (relative positioning)
dig(f1+u2);                    // dig forward 1, up 2
place("cobblestone", f1+u1, face:"up");  // place at forward 1, up 1
goto(f6, tol:1);               // move to 6 blocks forward

// Using waypoints
goto(waypoint("home"), tol:1);
```

### Building a Platform

```
// Build a 3x3 platform at specific location
goto(100, 64, 50, tol:1);
place("oak_planks", 100, 64, 50);
place("oak_planks", 101, 64, 50);
place("oak_planks", 102, 64, 50);
place("oak_planks", 100, 64, 51);
place("oak_planks", 101, 64, 51);
place("oak_planks", 102, 64, 51);
place("oak_planks", 100, 64, 52);
place("oak_planks", 101, 64, 52);
place("oak_planks", 102, 64, 52);
```

### Short Navigation Script with Check

```
macro step_to(x:int,y:int,z:int){
  goto(x, y, z, tol:1);
}

repeat(3){ step_to(100,64,-10); }
```

### Digging a Tunnel

```
// Dig a horizontal tunnel 5 blocks long
let start_x = 100;
let y = 64;
let z = 50;

repeat(5) {
  dig(start_x, y, z);      // Dig at feet level
  dig(start_x, y+1, z);    // Dig at head level
  start_x = start_x + 1;   // Move forward
  goto(start_x, y, z, tol:1);
}
```

### Breaking Trees and Collecting Wood

```
// Break tree logs using 'break' (clearer than 'dig' for wood)
equip("minecraft:iron_axe");
break(f1);                 // Break log in front
break(f1+u1);             // Break log above
break(f1+u2);             // Continue up the tree
pickup_blocks(8);         // Collect dropped wood and saplings
```

### Collecting Dropped Items After Mining

```
// After mining, collect all dropped items
dig(f1);
dig(f1+u1);
dig(f1+d1);
pickup_blocks();          // Default 8 block radius
pickup_blocks(16);        // Or specify larger radius for scattered items
```

### Crafting Tools and Items

```
// Craft basic tools
craft("stick", 4);
craft("wooden_pickaxe");
craft("crafting_table");

// Craft with quantity
craft("torch", 16);
```

### Smelting with Furnace

```
// Complete smelting workflow
goto(100, 64, 50, tol:1);           // Go to furnace
open_container(100, 64, 50);         // Open the furnace
container_put("input", "iron_ore", 8);  // Add 8 iron ore
container_put("fuel", "coal", 2);       // Add 2 coal
close_container();                   // Close and let it smelt

wait(80000);                         // Wait ~80 seconds for smelting

open_container(100, 64, 50);         // Reopen furnace
container_take("output", 8);         // Take iron ingots
close_container();
```

### Tree Farming with Replanting

```
// Fell tree, collect items, replant
equip("iron_axe");
break(100, 64, 50);        // Break base log
break(100, 65, 50);        // Break log above
break(100, 66, 50);        // Continue breaking
pickup_blocks(10);         // Collect wood and saplings
plant("oak_sapling", 100, 64, 50);  // Replant sapling
```

### Storing Items in Chest

```
// Transfer items to storage chest
goto(120, 64, 80, tol:1);
deposit(120, 64, 80, "cobblestone", 64);
deposit(120, 64, 80, "iron_ore", 32);
```

## Strategy

1) **Scout first**: Use get_position(), get_vox(), block_info() to understand surroundings
2) **Plan in CraftScript**: Write all movement and actions in a single CraftScript
3) **Navigate with goto()**: Use `goto(x, y, z, tol:1)` for all movement - do NOT use nav tool
4) **Check reach**: Confirm targets are ≤4.5 blocks before dig/place
5) **Safety checks**:
   - Avoid gravity-overhead before digging (gravel/sand)
   - Ensure solid reference block for placing
6) **Handle errors**: Check craftscript_status() and adapt on failures

Keep scripts short (≤20 lines) and focused. Write multiple small scripts rather than one huge script.

**Example workflow**:
```
1. get_position() → find where you are
2. get_inventory() → check what items you have
3. get_vox(10) → see nearby blocks
4. craftscript_start({ script: "goto(100,64,50,tol:1); dig(100,65,50);" })
5. craftscript_status() → check if succeeded
```
