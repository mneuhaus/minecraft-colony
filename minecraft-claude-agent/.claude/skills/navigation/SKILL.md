---
name: navigation
description: This skill should be used for navigating the Minecraft world. Uses JavaScript with goto() and SimplePathfinder for scaffolding/ladder support.
allowed-tools: get_position, get_status, get_vox, look_at_map, look_at_map_image, craftscript_start, craftscript_status, craftscript_logs
---

# The Zen of Minecraft Navigation

Simple is better than complex.
Explicit is better than implicit.

MCP Tools reveal the world.
JavaScript changes the world.

Inspect before you act.
Act when inspection is done.
Monitor after you act.

## Core Principles

**Read-only MCP tools reveal the world:**
- `get_position()` → where you are (x, y, z)
- `get_status()` → comprehensive snapshot (position, 3x3 vox, inventory, nearby players/items)
- `get_vox(radius)` → detailed voxel data around you (exact block information)
- `look_at_map(radius)` → ASCII map overview (quick orientation)
- `look_at_map_image(radius)` → rendered map image (visual confirmation of symmetry, shape, gaps)

**JavaScript changes the world:**
- Write script with `await goto(x, y, z)`
- Execute with `craftscript_start(script)`
- Monitor with `craftscript_status(job_id)` and `craftscript_logs(job_id)`

## Pathfinding System

Navigation uses a dual-pathfinder approach:

1. **SimplePathfinder** (default, preferred)
   - Custom A* implementation with proper scaffolding/ladder support
   - Block classification: solid, passable, climbable, danger, liquid
   - Handles: walking, jumping, dropping (up to 3 blocks), climbing scaffolding/ladders
   - Falls back to mineflayer-pathfinder if no path found

2. **mineflayer-pathfinder** (fallback)
   - Standard Minecraft pathfinding
   - Used when SimplePathfinder can't find a path

You can force the fallback pathfinder: `await goto(x, y, z, { simple: false })`

## Movement Physics (Critical)

You stand **ON** blocks, not **IN** them.
- `await goto(100, 64, 50)` → stand ON the block at Y=63, feet at Y=64
- Bot height: 2 blocks (feet to head)
- Step up: 1 block automatic, 2+ blocks need building
- Fall damage: 4+ blocks (3 is safe)

**CRITICAL - Navigation Targets:**
- You can ONLY navigate to **air** or **water** blocks (empty space)
- You CANNOT navigate to solid blocks (stone, dirt, wood, etc.)
- To reach a solid block: navigate NEAR it, then use tools to interact
- Example: To break stone at (100, 64, 50):
  - Navigate to (100, 64, 51) - air block next to stone
  - Then use `await dig(100, 64, 50)` to break it

## Coordinates

X: East (+) / West (-)
Y: Up (+) / Down (-) [0-320]
Z: South (+) / North (-)

North = Negative Z
South = Positive Z
East = Positive X
West = Negative X

## Navigation Pattern

**1. Inspect (use tools):**
- `get_position()` → get current coordinates
- `get_status()` → get surroundings, inventory, nearby entities
- `get_vox(radius)` → examine nearby blocks (exact block information by coordinates)
- `look_at_map(radius)` → ASCII terrain overview (quick orientation)
- `look_at_map_image(radius)` → visual confirmation (check symmetry, shapes, gaps, blind spots)

**2. Act (use JavaScript):**
```javascript
await goto(100, 64, -50, { tolerance: 3 });
console.log("Arrived at target");
```

**3. Monitor (use tools):**
- `craftscript_status(job_id)` → check if running/completed/failed
- `craftscript_logs(job_id)` → see execution details

## JavaScript Commands

**Basic movement:**
```javascript
await goto(x, y, z);                    // Move to position (default tolerance: 1)
await goto(x, y, z, { tolerance: 3 });  // Move within 3 blocks
```

**Safe navigation:**
```javascript
await goto(100, 64, 50, { tolerance: 5 });
console.log("Arrived");
```

**Staged travel (long distance):**
```javascript
// Break into waypoints
await goto(50, 64, 0, { tolerance: 5 });
await goto(100, 64, 0, { tolerance: 5 });
console.log("Completed journey");
```

## Common Patterns

**Return home:**
```javascript
// Home at (0, 64, 0)
await goto(0, 64, 0, { tolerance: 3 });
```

**Explore north 100 blocks:**
First use `get_position()` tool, then:
```javascript
// If current position is (50, 64, 100)
// North is negative Z, so target is (50, 64, 0)
await goto(50, 64, 0, { tolerance: 5 });
```

**Meet another player:**
First use `get_status()` tool to find player position, then:
```javascript
// If player is at (75, 64, -30)
await goto(75, 64, -30, { tolerance: 3 });
```

## Troubleshooting

**Can't reach target:**
- Increase tolerance: `await goto(x, y, z, { tolerance: 10 })`
- Navigate in stages (intermediate waypoints)
- Check Y-level (might be underground)

**Pathfinding stuck:**
- Try different Y-level (go up/down)
- Move to intermediate point first
- Check `craftscript_logs(job_id)` for errors

**Lost:**
- Call `get_position()` → absolute coordinates
- Calculate direction to known location
- Navigate in stages

## Integration

Navigation is the foundation.
Other skills build upon it.

Mining → navigate to ore-rich Y-levels
Building → navigate to build site
Farming → navigate between farms
Trading → navigate to meet bots

## When NOT to Use

Navigation is for movement.
Not for combat, building, or gathering.
Each skill has its purpose.

## Examples

**Task: Go to (100, 64, -50)**
```javascript
await goto(100, 64, -50, { tolerance: 3 });
console.log("Arrived at destination");
```

**Task: Check surroundings before moving**
First use `get_status()` tool to examine surroundings, then:
```javascript
// If safe to proceed
await goto(100, 64, -50, { tolerance: 5 });
```

**Task: Multi-stage journey**
```javascript
// Stage 1
await goto(50, 64, 0, { tolerance: 5 });

// Stage 2
await goto(100, 64, -50, { tolerance: 5 });

console.log("Journey complete");
```

Simple is better than complex.
Explicit is better than implicit.
Now is better than never.
