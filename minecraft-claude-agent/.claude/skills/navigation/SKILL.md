---
name: navigation
description: Navigate the world using tools and CraftScript. Philosophy over procedures.
allowed-tools: get_position, get_status, get_vox, look_at_map, look_at_map_4, look_at_map_5, craftscript_start, craftscript_status, craftscript_logs
---

# The Zen of Minecraft Navigation

Simple is better than complex.
Explicit is better than implicit.

Tools reveal the world.
CraftScript changes the world.

Inspect before you act.
Act when inspection is done.
Monitor after you act.

## Core Principles

**Read-only tools reveal the world:**
- `get_position()` → where you are (x, y, z)
- `get_status()` → comprehensive snapshot (position, 3x3 vox, inventory, nearby players/items)
- `get_vox(radius)` → detailed voxel data around you
- `look_at_map(radius)` → ASCII map overview
- `look_at_map_4(radius)` → 4-direction ASCII map
- `look_at_map_5(radius)` → 5-layer ASCII map

**CraftScript changes the world:**
- Write script with `navigate()`, `look()`, `waitForPosition()`
- Execute with `craftscript_start(script)`
- Monitor with `craftscript_status(job_id)` and `craftscript_logs(job_id)`

## Movement Physics (Critical)

You stand **ON** blocks, not **IN** them.
- `navigate(100, 64, 50)` → stand ON the block at Y=63, feet at Y=64
- Bot height: 2 blocks (feet to head)
- Step up: 1 block automatic, 2+ blocks need building
- Fall damage: 4+ blocks (3 is safe)

**CRITICAL - Navigation Targets:**
- You can ONLY navigate to **air** or **water** blocks (empty space)
- You CANNOT navigate to solid blocks (stone, dirt, wood, etc.)
- To reach a solid block: navigate NEAR it, then use tools to interact
- Example: To break stone at (100, 64, 50):
  - Navigate to (100, 64, 51) - air block next to stone
  - Then use `dig(100, 64, 50)` to break it

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
- `get_vox(radius)` → examine nearby blocks
- `look_at_map(radius)` → see terrain overview

**2. Act (use CraftScript):**
```craftscript
navigate(100, 64, -50);
waitForPosition(100, 64, -50, 3);
chat("Arrived at target");
```

**3. Monitor (use tools):**
- `craftscript_status(job_id)` → check if running/completed/failed
- `craftscript_logs(job_id)` → see execution details

## CraftScript Commands

**Basic movement:**
```craftscript
navigate(x, y, z);              // Move to position
look(x, y, z);                  // Orient toward position
waitForPosition(x, y, z, 3);    // Wait until within 3 blocks
```

**Safe navigation:**
```craftscript
navigate(100, 64, 50);
waitForPosition(100, 64, 50, 5);
chat("Arrived");
```

**Staged travel (long distance):**
```craftscript
// Break into waypoints
navigate(50, 64, 0);
waitForPosition(50, 64, 0, 5);
navigate(100, 64, 0);
waitForPosition(100, 64, 0, 5);
chat("Completed journey");
```

## Common Patterns

**Return home:**
```craftscript
// Home at (0, 64, 0)
navigate(0, 64, 0);
waitForPosition(0, 64, 0, 3);
```

**Explore north 100 blocks:**
First use `get_position()` tool, then:
```craftscript
// If current position is (50, 64, 100)
// North is negative Z, so target is (50, 64, 0)
navigate(50, 64, 0);
waitForPosition(50, 64, 0, 5);
```

**Meet another player:**
First use `get_status()` tool to find player position, then:
```craftscript
// If player is at (75, 64, -30)
navigate(75, 64, -30);
waitForPosition(75, 64, -30, 3);
```

## Troubleshooting

**Can't reach target:**
- Increase tolerance: `waitForPosition(x, y, z, 10)`
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
```craftscript
navigate(100, 64, -50);
waitForPosition(100, 64, -50, 3);
chat("Arrived at destination");
```

**Task: Check surroundings before moving**
First use `get_status()` tool to examine surroundings, then:
```craftscript
// If safe to proceed
navigate(100, 64, -50);
waitForPosition(100, 64, -50, 5);
```

**Task: Multi-stage journey**
```craftscript
// Stage 1
navigate(50, 64, 0);
waitForPosition(50, 64, 0, 5);

// Stage 2
navigate(100, 64, -50);
waitForPosition(100, 64, -50, 5);

chat("Journey complete");
```

Simple is better than complex.
Explicit is better than implicit.
Now is better than never.
