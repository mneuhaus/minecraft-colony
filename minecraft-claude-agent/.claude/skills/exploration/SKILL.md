---
name: exploration
description: Scout and explore the world to discover resources, biomes, structures, and points of interest. Use for reconnaissance missions, resource location, mapping new territory, and reporting findings to other bots.
allowed-tools: get_position, move_to_position, look_at, find_block, find_entity, find_trees, list_inventory, send_chat, send_bot_message, set_waypoint, list_waypoints, delete_waypoint, read_bot_messages
---

# Exploration Skill – Resource Discovery and Scouting

This skill teaches you how to explore the Minecraft world systematically, locate valuable resources, discover points of interest, and report findings to coordinate with other bots.

## Available Tools

### Movement & Position
- **get_position()** – know your current coordinates for navigation and waypoint creation
- **move_to_position(x, y, z, range)** – navigate to specific coordinates
- **look_at(x, y, z)** – orient yourself toward points of interest

### Resource Discovery
- **find_block(block_type, max_distance)** – locate specific block types (ore, water, lava, etc.)
- **find_entity(entityType, maxDistance)** – locate mobs, animals, players
- **find_trees(radius, types)** – find trees for woodcutting operations

### Navigation Management
- **set_waypoint(name, x, y, z, description)** – mark important locations
- **list_waypoints()** – view all saved waypoints
- **delete_waypoint(name)** – remove outdated waypoints

### Inventory & Supplies
- **list_inventory()** – check what supplies you have for the journey

### Communication
- **send_chat(message)** – broadcast discoveries to nearby players
- **send_bot_message(recipient, message, priority)** – send detailed reports to specific bots
- **read_bot_messages()** – check for exploration requests from other bots

## Exploration Workflow

### 1. Preparation Phase

**Before embarking on exploration:**
```
1. Check current position: get_position()
2. Review supplies: list_inventory()
3. Check for exploration requests: read_bot_messages()
4. Set home waypoint if not exists:
   set_waypoint("home", current_x, current_y, current_z, "Main base location")
```

**Recommended inventory for exploration:**
- Food: 32+ units (bread, cooked meat)
- Torches: 64+ (mark explored areas, prevent mob spawns)
- Cobblestone: 64+ (emergency bridges, markers)
- Basic tools: pickaxe, axe, shovel
- Boat (if near water biomes)
- Extra inventory space for discovered items

### 2. Mission Types

#### Mission Type A: Resource Scouting

**Objective:** Find specific resources (trees, ores, animals, water)

**Example – Locating Oak Trees:**
```
1. get_position() → Note starting location
2. find_trees(radius=50, types=["oak"])
   → Returns: "Found 5 oak trees. Nearest: oak_log at (110, 72, 122) - 49 blocks"
3. For each discovered tree:
   - move_to_position(tree_x, tree_y, tree_z, range=5)
   - Verify tree is accessible (not over water/lava)
   - set_waypoint("oak_forest_1", tree_x, tree_y, tree_z, "Oak forest, 5+ trees")
4. Report findings:
   send_bot_message("SammelBot", "Found oak forest at (110, 72, 122) - 5+ trees", "high")
   send_chat("Oak forest located and marked as waypoint")
```

**Example – Locating Animals for Farming:**
```
1. find_entity("cow", 50) → Search 50 block radius
2. Count animals found (e.g., 3 cows at different positions)
3. If animals found:
   - Choose cluster location (where most animals are)
   - set_waypoint("cow_spawn", x, y, z, "Natural cow spawn area, 3+ cows")
   - Report: send_bot_message("BauBot", "Found cow spawn at (X,Y,Z). Build pen here?", "normal")
4. If not found:
   - Expand search radius: find_entity("cow", 100)
   - Move to new area and repeat
```

#### Mission Type B: Biome Survey

**Objective:** Identify different biomes and their characteristics

**Procedure:**
```
1. Start at known position: pos = get_position()
2. Choose direction (North/South/East/West)
3. Travel 100 blocks in chosen direction:
   move_to_position(pos.x + 100, pos.y, pos.z)  # East
4. Observe surroundings:
   - Tree types: find_trees(30)
   - Water presence: find_block("water", 20)
   - Animal types: find_entity("any", 30)
5. Identify biome characteristics:
   - Plains: Grass, few trees, horses, cows, sheep
   - Forest: Dense trees (oak, birch)
   - Jungle: Tall trees, dense foliage, jungle_log
   - Desert: Sand, cacti, no trees
   - Taiga: Spruce trees, wolves
6. Set waypoint: set_waypoint("biome_plains_1", x, y, z, "Plains biome - good for farming")
7. Continue in same direction or change direction
8. Repeat for 500+ block exploration
```

#### Mission Type C: Structure Discovery

**Objective:** Locate villages, temples, mineshafts, or other generated structures

**Searching for Villages:**
```
1. Villages typically spawn in plains/savanna/desert biomes
2. Look for artificial patterns:
   - Paths (dirt/gravel paths)
   - Buildings (cobblestone, planks, glass)
   - Farms (wheat, carrots)
3. When structure suspected:
   move_to_position(suspected_x, suspected_y, suspected_z, range=10)
4. Verify structure type
5. Set comprehensive waypoint:
   set_waypoint("village_1", center_x, center_y, center_z, "Village - has farms, bell, 5 houses")
6. Report to traders:
   send_bot_message("HandelBot", "Village discovered at (X,Y,Z) - potential trading post", "high")
```

**Finding Caves and Mineshafts:**
```
1. Surface indicators:
   - Exposed cave openings (air blocks in hillsides)
   - Ravines (large vertical gaps)
2. When found:
   - get_position() → Note cave entrance coordinates
   - set_waypoint("cave_entrance", x, y, z, "Cave entrance - unexplored")
   - DO NOT enter without proper equipment (torches, weapons, food)
3. Report to mining bot:
   send_bot_message("GräberBot", "Cave entrance at (X,Y,Z) - ready for mining expedition", "normal")
```

### 3. Systematic Exploration Patterns

#### Spiral Pattern (Good for local area coverage)
```
Starting position: (0, 64, 0)

Move East 10 blocks    → (10, 64, 0)
Move North 10 blocks   → (10, 64, 10)
Move West 20 blocks    → (-10, 64, 10)
Move South 20 blocks   → (-10, 64, -10)
Move East 30 blocks    → (20, 64, -10)
Move North 30 blocks   → (20, 64, 20)
...continue expanding spiral

At each waypoint: Scan for resources and mark findings
```

#### Grid Pattern (Best for thorough coverage)
```
Divide world into 100x100 grid squares

Square 1: (0,0) to (100,100)
Square 2: (100,0) to (200,100)
Square 3: (0,100) to (100,200)
...

For each square:
1. Move to center of square
2. Perform 360° scan (find_block, find_entity, find_trees)
3. Mark all discoveries with waypoints
4. Move to next square
```

#### Radial Pattern (Fast reconnaissance)
```
Choose 8 cardinal directions:
- North: (x, y, z+100)
- Northeast: (x+70, y, z+70)
- East: (x+100, y, z)
- Southeast: (x+70, y, z-70)
- South: (x, y, z-100)
- Southwest: (x-70, y, z-70)
- West: (x-100, y, z)
- Northwest: (x-70, y, z+70)

Travel each direction, scan, return to base, repeat with expanded radius
```

### 4. Waypoint Management Strategy

**Waypoint Naming Convention:**
```
[resource_type]_[biome]_[number]

Examples:
- "oak_forest_1" → First oak forest found
- "cow_spawn_plains_2" → Second cow spawn in plains
- "iron_ore_cave_3" → Third iron ore vein in caves
- "village_desert_1" → First desert village
- "home" → Main base (reserved name)
- "temp_marker" → Temporary markers (delete after use)
```

**Waypoint Descriptions Best Practices:**
```
✅ Good descriptions:
- "Oak forest - 8+ trees, flat terrain, near water"
- "Cave entrance at Y=45 - coal visible, needs torches"
- "Cow spawn - 5 cows, plains biome, good for pen"

❌ Bad descriptions:
- "trees" (not specific)
- "stuff here" (not useful)
- "" (empty - no context)
```

**Waypoint Cleanup:**
```
Periodically review waypoints: list_waypoints()

Delete outdated/redundant waypoints:
- Temporary markers no longer needed
- Depleted resources (trees harvested, animals moved)
- Duplicate markers for same location

delete_waypoint("temp_marker_5")
```

### 5. Reporting Findings

**To Specific Bots:**
```
# Resource found → Notify gatherer
send_bot_message("SammelBot",
  "Oak forest at (110,72,122) - 8 trees, waypoint 'oak_forest_1' created",
  "normal")

# Building location → Notify builder
send_bot_message("BauBot",
  "Flat plains at (200,64,150) - 20x20 clear area, perfect for farm",
  "normal")

# Rare find → High priority alert
send_bot_message("ALL_BOTS",
  "URGENT: Village found at (-300,65,450) - trading opportunities!",
  "high")
```

**General Broadcasts:**
```
# Discoveries
send_chat("Discovered jungle biome 200 blocks East - jungle wood available")

# Warnings
send_chat("Warning: Deep ravine at (150,64,200) - dangerous crossing")

# Milestones
send_chat("Exploration complete: 500 block radius surveyed, 12 waypoints created")
```

### 6. Special Exploration Tasks

#### Water Source Location
```
Purpose: Find water for farms, travel, or base location

1. find_block("water", 50) → Search 50 block radius
2. If found:
   - Verify it's not a small puddle (check multiple water blocks nearby)
   - Determine if it's lake, river, or ocean
3. For lakes:
   - move_to_position(water_x, water_y, water_z, range=5)
   - Estimate size (small lake <100 blocks, large lake >100 blocks)
4. For rivers:
   - Follow river course by moving along water edge
   - Note direction of flow (useful for boat travel)
5. Set waypoint:
   set_waypoint("water_lake_1", x, y, z, "Large lake - 200+ blocks, good for fishing")
```

#### Lava Source Location (for Nether Portal or Smelting)
```
1. find_block("lava", 30) → Dangerous, approach carefully
2. If found:
   - DO NOT move too close (lava causes fire damage)
   - Note position: get_position()
   - move_to_position(safe_x, safe_y, safe_z) → Move to safe distance
3. Set WARNING waypoint:
   set_waypoint("lava_hazard_1", lava_x, lava_y, lava_z, "WARNING: Lava pool - stay clear")
4. Report:
   send_bot_message("ALL_BOTS", "DANGER: Lava at (X,Y,Z) - avoid this area", "high")
```

#### Food Source Survey
```
Natural food sources for survival:

1. Animals for meat:
   find_entity("cow", 50)
   find_entity("pig", 50)
   find_entity("sheep", 50)
   find_entity("chicken", 50)

2. Wild crops:
   find_block("wheat", 30)  # Villages may have wheat farms
   find_block("potato", 30)
   find_block("carrot", 30)

3. Report food security status:
   "Food survey: 5 cows, 3 pigs within 50 blocks. Farm recommended for sustainability."
```

### 7. Safety Protocols

**Day/Night Awareness:**
```
# Exploration is safest during daytime
# If night falls while exploring:

1. Evaluate danger: find_entity("zombie", 30), find_entity("skeleton", 30)
2. Options:
   A) Build emergency shelter (3x3 cobblestone box with torches)
   B) Return to nearest waypoint: move_to_position(waypoint_x, waypoint_y, waypoint_z)
   C) Build pillar and wait out the night (if creative mode)
3. Report status:
   send_bot_message("ALL_BOTS", "Sheltering at (X,Y,Z) until dawn - continuing exploration after", "normal")
```

**Hazard Avoidance:**
```
# Deep water → May need boat or bridge
# Lava pools → Keep 5+ block distance
# Steep cliffs → Risk of fall damage
# Cave openings → Don't enter unprepared (no torches/weapons)

When hazard detected:
1. Stop movement
2. Set warning waypoint
3. Navigate around hazard or return to safe path
4. Report hazard location to other bots
```

**Lost Protocol:**
```
If you don't recognize surroundings:

1. get_position() → Note current coordinates
2. list_waypoints() → Find nearest known waypoint
3. Calculate direction to home:
   Home: (0, 64, 0)
   Current: (234, 67, -189)
   Direction: West and North
4. move_to_position(0, 64, 0, range=10) → Return home
5. send_chat("Returned to base after exploration - safely back")
```

### 8. Multi-Bot Exploration Coordination

**Divide and Conquer Strategy:**
```
Four bots exploring in different directions:

SammelBot: Explore North (0° - 90°)
BauBot: Explore East (90° - 180°)
GräberBot: Explore South (180° - 270°)
HandelBot: Explore West (270° - 360°)

Each bot:
1. Travels 500 blocks in assigned direction
2. Creates waypoints for discoveries
3. Reports findings via send_bot_message
4. Returns to base
5. Compare notes and plan next phase
```

**Relay Exploration:**
```
For very long-distance exploration:

Bot 1: Travel 200 blocks, set waypoint "relay_1", report position
Bot 2: Move to "relay_1", continue 200 blocks further, set "relay_2"
Bot 3: Move to "relay_2", continue 200 blocks, set "relay_3"
...

This allows mapping of 600+ block distances efficiently
```

**Resource Chain Discovery:**
```
When one resource is found, search for complementary resources nearby:

Example - Tree → Farm → Animals chain:
1. Find trees: find_trees(50) → Wood source
2. Find water: find_block("water", 50) → Farm location
3. Find flat land: Identify suitable building area
4. Find animals: find_entity("cow", 100) → Livestock for farm

Report complete package:
"Complete farm site at (X,Y,Z): Trees nearby, water source, flat land, 4 cows. Ready for development."
```

## Exploration Best Practices

✅ **Do:**
- **Set waypoints frequently** – Mark everything of interest
- **Report findings immediately** – Other bots can act on intel
- **Travel during day** – Safer, better visibility
- **Bring sufficient supplies** – Food, blocks, torches
- **Check messages regularly** – Other bots may request specific resources
- **Document biomes** – Different biomes = different resources
- **Return home periodically** – Share findings, resupply

❌ **Don't:**
- Don't explore at night without preparation (mob danger)
- Don't forget to mark your path (waypoints prevent getting lost)
- Don't ignore hazards (lava, cliffs, caves)
- Don't deplete your food supply (keep 50% reserved for return trip)
- Don't create duplicate waypoints (check list_waypoints first)
- Don't enter caves alone without proper equipment

## Integration with Other Skills

- **Tree-felling skill**: Use exploration to find optimal wood sources before harvesting
- **Farming skill**: Locate water, flat land, and animals for farm construction
- **Mining skill**: Find cave entrances and mark mineral-rich areas
- **Building skill**: Identify ideal building locations (flat, near resources)
- **Combat skill**: Report hostile mob concentrations as danger zones
- **Navigation skill**: Heavy use of waypoint system for all discoveries

## Example Exploration Missions

**Mission: "Find resources for starting a farm"**
```
1. Check requirements:
   - Water source
   - Flat land (at least 10x10)
   - Animals (cows/pigs/chickens)
   - Wood (for tools and fences)

2. Start at base: pos = get_position() → (0, 64, 0)

3. Find water:
   find_block("water", 50) → Found at (45, 63, 22)
   move_to_position(45, 63, 22, range=5)

4. Check area around water:
   - Flat? Yes (Y=63-64 consistent)
   - 10x10 space? Yes
   set_waypoint("farm_site_1", 45, 63, 22, "Water + flat land for farm")

5. Find animals nearby:
   find_entity("cow", 50) → 3 cows at (60, 64, 30)
   find_entity("chicken", 50) → 2 chickens at (50, 64, 18)

6. Find wood nearby:
   find_trees(50) → 5 oak trees at (55, 64, 10)

7. Report complete package:
   send_bot_message("BauBot", "Perfect farm site at (45,63,22): water, flat land, 3 cows, 2 chickens, 5 trees nearby. Waypoint 'farm_site_1' created. Ready to build?", "high")
   send_chat("Farm site located and marked - awaiting construction approval")
```

**Mission: "Scout 300 blocks North for new biomes"**
```
1. Start: get_position() → (0, 64, 0)
2. Waypoint home: set_waypoint("home", 0, 64, 0, "Main base")
3. Move North 100 blocks: move_to_position(0, 64, 100, range=5)
4. Scan: find_trees(30) → Oak forest found
5. Waypoint: set_waypoint("oak_forest_n1", 0, 64, 100, "Oak forest - 10+ trees")
6. Move North 200 blocks: move_to_position(0, 64, 200)
7. Scan: find_trees(30) → Spruce forest (different biome - Taiga!)
8. Waypoint: set_waypoint("taiga_biome", 0, 64, 200, "Taiga biome - spruce trees, cold")
9. Move North 300 blocks: move_to_position(0, 64, 300)
10. Scan: find_block("water", 40) → Large lake found
11. Waypoint: set_waypoint("lake_north", 0, 64, 300, "Large lake in taiga - fishing potential")
12. Return home: move_to_position(0, 64, 0)
13. Report: send_chat("North exploration complete: Oak forest at +100, Taiga biome at +200, Lake at +300. 3 waypoints created.")
```

## When to Use This Skill

- Starting a new world (initial reconnaissance)
- Looking for specific resources (trees, animals, water, biomes)
- Mapping unexplored territory
- Finding suitable locations for bases, farms, or projects
- Coordinating multi-bot resource gathering operations
- Responding to exploration requests from other bots

## When NOT to Use This Skill

- If you need to gather resources immediately (use gathering skills instead)
- If you need to build structures (use building skill)
- If specific coordinates are already known (just navigate there)
- If exploring underground caves (different skillset - requires mining/combat skills)

This skill is specifically for **surface exploration, resource discovery, and reconnaissance** to support coordinated bot operations.
