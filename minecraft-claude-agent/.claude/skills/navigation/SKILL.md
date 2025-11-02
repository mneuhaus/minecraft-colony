---
name: navigation
description: Navigate the world, create waypoints, explore new areas, and find your way back home. Use for travel, exploration, and location management.
allowed-tools: get_position, move_to_position, look_at, send_chat, send_bot_message, read_bot_messages, place_block, build_pillar, find_entity, set_waypoint, list_waypoints, delete_waypoint
---

# Navigation Skill – Exploration and Wayfinding

This skill teaches you how to navigate the Minecraft world, manage waypoints, explore efficiently, and coordinate locations with other bots.

## Available Tools

### Movement & Position
- **get_position()** – get your current (x, y, z) coordinates
- **move_to_position(x, y, z, range)** – navigate to specific coordinates
- **look_at(x, y, z)** – orient yourself toward a location

### Waypoint Management
- **set_waypoint(name, x, y, z, description)** – save named locations persistently (uses current position if x/y/z not provided)
- **list_waypoints(sort_by_distance)** – retrieve all saved waypoints with distances from current position
- **delete_waypoint(name)** – remove a saved waypoint by name

### Physical Markers
- **place_block(x, y, z, block_type)** – mark locations with distinctive blocks
- **build_pillar(height)** – create tall markers visible from distance

### Entity Location
- **find_entity(entityType, maxDistance)** – locate players or bots nearby

### Communication
- **send_chat(message)** – share location information
- **send_bot_message(recipient, message, priority)** – send coordinates to other bots
- **read_bot_messages(mark_as_read, only_unread)** – receive location updates from bots

## Core Navigation Concepts

### Coordinate System

Minecraft uses a 3D coordinate system:
- **X-axis**: East (+) / West (-)
- **Y-axis**: Up (+) / Down (-) [Height: 0-320 in newer versions, 0-256 in older]
- **Z-axis**: South (+) / North (-)

**Example Position**: (120, 64, -80)
- X=120: 120 blocks East of spawn (0, 64, 0)
- Y=64: At sea level (typical ground height)
- Z=-80: 80 blocks North of spawn

### Distance Calculation

Calculate distance between two points using 3D Euclidean distance:

```
distance = √[(x₂-x₁)² + (y₂-y₁)² + (z₂-z₁)²]
```

**Horizontal distance** (ignoring Y):
```
horizontal_distance = √[(x₂-x₁)² + (z₂-z₁)²]
```

**Example**:
- Bot at (100, 64, 100)
- Base at (150, 70, 50)
- Horizontal distance: √[(150-100)² + (50-100)²] = √[2500 + 2500] = √5000 ≈ 71 blocks

### Cardinal Directions

- **North**: Negative Z direction (Z decreases)
- **South**: Positive Z direction (Z increases)
- **East**: Positive X direction (X increases)
- **West**: Negative X direction (X decreases)

## Waypoint Management

### Creating Waypoints

**Persistent Waypoints** (saved to file, recommended):
```
# Save current location as waypoint
set_waypoint(name="Home Base", description="Main storage and crafting area")

# Save specific coordinates as waypoint
set_waypoint(name="Diamond Mine", x=95, y=12, z=-120, description="Rich diamond vein")

# Result: Waypoint saved persistently, shared across all bots
# Access later with list_waypoints() or use coordinates with move_to_position()
```

**Physical Markers** (visible structures):
```
1. Get current position: myPos = get_position()
2. Build tall pillar: build_pillar(20)
   - Creates distinctive landmark visible from far away
3. Save as waypoint: set_waypoint(name="Tower Marker", description="Tall pillar at exploration point")
4. send_chat("Created waypoint pillar at (X, Y, Z)")
```

**Marker Types**:
| Marker | Visibility | Best For |
|---|---|---|
| **Tall pillar (20+ blocks)** | ~100 blocks | General waypoints |
| **Glowstone/torch pillar** | Night visibility | Caves, dark areas |
| **Colored wool pillar** | Easy identification | Multiple nearby waypoints |
| **Beacon** | Several kilometers | Major bases (requires materials) |

### Waypoint Naming Convention

Use descriptive names (coordinates are auto-stored):
- "Home Base" - Main storage and crafting
- "Mine Entrance" - Diamond mine access
- "Iron Farm" - Automated iron production
- "Village" - Trading post location
- "Nether Portal" - Fast travel hub

### Listing and Managing Waypoints

**View All Waypoints**:
```
# List all waypoints with distances
list_waypoints()

# Output shows:
# === Saved Waypoints (3 total) ===
# Current position: (150, 64, 100)
#
# 📍 Home Base
#    Location: (120, 64, -80)
#    Distance: 181.2 blocks
#    Description: Main storage and crafting area
#    Created by: BauBot
```

**Sort by Distance** (find nearest waypoint):
```
list_waypoints(sort_by_distance=true)

# Shows closest waypoints first - useful for:
# - Finding nearest safe location
# - Choosing closest resource point
# - Optimizing travel routes
```

**Delete Waypoints**:
```
# Remove outdated waypoints
delete_waypoint(name="Old Mine")

# Result: Waypoint removed from persistent storage
```

### Sharing Waypoints with Bots

**Automatic Sharing via Waypoint System** (recommended):
```
# Any bot can create waypoint - all bots can access it
set_waypoint(name="Village", x=350, y=68, z=-200, description="Wheat farm available")

# Other bots can list it automatically
list_waypoints()  # Shows all waypoints from all bots

# Navigate to shared waypoint
# (Get coordinates from list_waypoints, then use move_to_position)
```

**Manual Coordinate Sharing** (for temporary locations):
```
# Share a temporary location
send_bot_message("SammelBot", "Found creeper at (350, 68, -200), need help!", "high")

# Request current position
send_bot_message("BauBot", "Where are you? Need to meet up", "high")

# Share current position
myPos = get_position()
send_bot_message("HandelBot", f"I'm at ({myPos.x}, {myPos.y}, {myPos.z}) - come here for trade", "normal")
```

## Navigation Workflows

### 1. Returning to a Known Location

**Simple Navigation**:
```
1. Get current position: get_position()
2. Calculate direction to target
3. Use move_to_position(target_x, target_y, target_z, range=5)
4. Pathfinding handles obstacles automatically
```

**Example - Return to Base**:
```
# Base is at (120, 64, -80)
# Currently at (200, 68, 50)

1. move_to_position(120, 64, -80, range=3)
   - Bot automatically pathfinds around obstacles
   - Range=3 means "get within 3 blocks"
2. Wait for arrival
3. send_chat("Arrived at base")
```

### 2. Exploring New Territory

**Systematic Exploration**:
```
1. Get starting position: start = get_position()
2. Choose exploration pattern:
   - Spiral: Move in expanding square spiral
   - Grid: Cover area in parallel lines
   - Random walk: Move to random nearby positions
3. Mark explored coordinates
4. Return to start periodically to store findings
```

**Spiral Exploration Example**:
```
Start at (100, 64, 100)
Move pattern:
1. East 50 blocks → (150, 64, 100)
2. South 50 blocks → (150, 64, 150)
3. West 100 blocks → (50, 64, 150)
4. North 100 blocks → (50, 64, 50)
5. East 150 blocks → (200, 64, 50)
... continue expanding
```

### 3. Creating a Navigation Network

**Marker Grid** (for large-scale navigation):
```
1. Place pillars every 100 blocks in grid pattern
2. Top each with unique colored wool based on quadrant:
   - NE (X+, Z-): Red wool
   - SE (X+, Z+): Blue wool
   - SW (X-, Z+): Green wool
   - NW (X-, Z-): Yellow wool
3. Navigate between pillars visually
```

**Path Marking** (for frequently traveled routes):
```
1. Travel from A to B once
2. Every 20 blocks, place torch/glowstone
3. Creates lit path for easy repeat navigation
4. Useful for: mine to base, base to farm, etc.
```

### 4. Meeting Another Bot

**Coordination Protocol**:
```
# Bot 1 (initiator):
1. my_pos = get_position()
2. send_bot_message("BauBot", f"Meet me at ({my_pos.x}, {my_pos.y}, {my_pos.z})", "high")
3. Wait at location

# Bot 2 (responder):
1. read_bot_messages() → Receives coordinates
2. move_to_position(received_x, received_y, received_z, range=3)
3. send_bot_message("SammelBot", "Arriving at your location", "normal")

# Visual confirmation:
find_entity("player", maxDistance=20) → Locate the other bot
```

### 5. Rescue/Recovery Navigation

**When Lost**:
```
1. get_position() → Note current coordinates
2. Calculate direction to known location:
   - If base is at (0, 64, 0) and you're at (500, 70, -300)
   - You need to go: 500 blocks West, 300 blocks South
3. move_to_position(0, 64, 0, range=10)
4. If pathfinding fails:
   - Move toward base in stages (waypoints every 100 blocks)
   - Build pillars at each stage for backtracking
```

**Stuck in Cave**:
```
1. get_position() → Note depth (Y-coordinate)
2. Dig staircase up (never straight up!):
   - Dig one block forward
   - Dig one block up diagonally
   - Repeat until Y > 60 (surface level)
3. Once at surface, use normal navigation
```

## Advanced Navigation Techniques

### Distance Estimation Without Tools

Visual distance estimation (when get_position not available):
- **Chunks**: Minecraft loads in 16x16 block chunks
- **Render distance**: Usually 8-12 chunks (128-192 blocks)
- **Player visibility**: ~100 blocks in clear weather

### Optimal Travel Routes

**Faster Travel Methods**:
1. **Walking**: 4.3 blocks/second
2. **Sprinting**: 5.6 blocks/second
3. **Swimming**: 2.2 blocks/second (slow!)
4. **Boat on ice**: 40 blocks/second (fastest!)
5. **Nether portal**: 8x multiplier (1 block in Nether = 8 in Overworld)

**Route Optimization**:
```
# Long distance (>1000 blocks): Use Nether portal
- Build portal at base (Overworld)
- Enter Nether
- Travel 1/8th the distance in Nether
- Build return portal
- Result: 8x faster travel

# Medium distance (100-1000 blocks): Direct navigation
- move_to_position(target_x, target_y, target_z)

# Short distance (<100 blocks): Visual navigation
- Use markers and landmarks
```

### Coordinate Notation Systems

**Relative Coordinates** (from a reference point):
```
Reference: Base at (0, 64, 0)
- Mine: "100 East, 50 North" → (100, 64, -50)
- Farm: "50 West, 80 South" → (-50, 64, 80)
```

**Absolute Coordinates**:
```
Direct (x, y, z) notation:
- Base: (120, 64, -80)
- Mine: (95, 45, -120)
```

## Multi-Bot Navigation Scenarios

### Scenario 1: Coordinated Exploration

```
# Divide exploration area among bots
Base at (0, 64, 0)

HandelBot: Explore NE quadrant (X+, Z-)
- move_to_position(500, 64, -500)
- Report findings

SammelBot: Explore SE quadrant (X+, Z+)
- move_to_position(500, 64, 500)
- Report findings

BauBot: Explore NW quadrant (X-, Z-)
- move_to_position(-500, 64, -500)
- Build markers at key locations

GräberBot: Explore SW quadrant (X-, Z+)
- move_to_position(-500, 64, 500)
- Note ore locations
```

### Scenario 2: Resource Run

```
# GräberBot mines resources, HandelBot picks up and delivers

GräberBot:
1. Navigate to mine: move_to_position(95, 45, -120)
2. Mine resources
3. send_bot_message("HandelBot", "32 iron ore ready at (95, 45, -120)", "normal")

HandelBot:
1. read_bot_messages() → Get pickup location
2. move_to_position(95, 45, -120, range=5)
3. Collect items (using trading skill)
4. move_to_position(0, 64, 0) → Return to base storage
```

### Scenario 3: Rescue Operation

```
# SammelBot lost in cave, BauBot rescues

SammelBot:
1. get_position() → (150, 12, -200) [Deep underground!]
2. send_bot_message("BauBot", "Lost in cave at (150, 12, -200), need help", "high")

BauBot:
1. read_bot_messages() → Get distress coordinates
2. move_to_position(150, 64, -200) → Navigate to surface above
3. build_pillar(52) → Build pillar down to Y=12 (64-12=52 blocks)
4. send_bot_message("SammelBot", "Built rescue pillar at (150, 64, -200), climb up", "high")
```

## Navigation Best Practices

✅ **Do:**
- Always call `get_position()` before long journeys (note your starting point)
- Build marker pillars at key locations for visual reference
- Share coordinates with other bots using `send_bot_message()`
- Use `range` parameter in `move_to_position()` (3-5 blocks is good)
- Travel during day when possible (better visibility)
- Mark important locations with distinctive blocks (glowstone, colored wool)

❌ **Don't:**
- Don't travel long distances without noting your start coordinates
- Don't rely only on visual navigation (always have coordinates as backup)
- Don't forget to account for Y-coordinate (height) when navigating
- Don't navigate into lava or water without checking
- Don't assume pathfinding will work 100% (check for arrival)

## Troubleshooting Navigation

**"I can't reach the target coordinates"**:
- Check Y-coordinate (might be underground or too high)
- Try increasing `range` parameter: move_to_position(x, y, z, range=10)
- Navigate in stages (waypoints every 100 blocks)
- Check for water/lava obstacles

**"Pathfinding is stuck"**:
- Get current position: get_position()
- Try different Y-level (go up or down a few blocks)
- Move to intermediate waypoint first
- In worst case: manually dig/build path using mining or building skills

**"I don't know where I am"**:
- Call `get_position()` to get absolute coordinates
- Calculate direction to known location (base, spawn)
- If completely lost, look for natural landmarks:
  - Oceans (usually at Y=63)
  - Mountains (high Y values)
  - Deserts, forests (biome features)
- Build tall pillar to see further

## Integration with Other Skills

- **Mining Skill**: Navigate to ore-rich Y-levels, return to base with ores
- **Building Skill**: Navigate to build site, create navigation markers
- **Farming Skill**: Navigate between multiple farms, coordinate bot positions
- **Trading Skill**: Meet up with other bots for item exchange

## Implemented Waypoint System

✅ **Available Now**:
- `set_waypoint(name, x, y, z, description)`: Save named locations persistently to shared file
- `list_waypoints(sort_by_distance)`: Retrieve all saved waypoints with distances
- `delete_waypoint(name)`: Remove waypoints from persistent storage

## Potential Future Enhancements

Additional tools that could further improve navigation:
- `get_waypoint_route(waypoint_name)`: Get direct navigation command to saved waypoint
- `nearest_waypoint()`: Auto-find and return closest saved location
- `calculate_path(start, end)`: Get step-by-step navigation instructions
- `find_biome(biome_type)`: Locate specific biomes (mesa, jungle, etc.)
- `map_area(center_x, center_z, radius)`: Survey and map surroundings
- `create_waypoint_path(waypoint_list)`: Chain waypoints for complex routes

## Example Navigation Tasks

**Task: "Save this location as a waypoint and list all waypoints"**
```
1. set_waypoint(name="Resource Drop", description="Temporary storage for mining haul")
2. list_waypoints(sort_by_distance=true)
3. send_chat("Waypoint saved! Closest waypoint is [check output]")
```

**Task: "Navigate to a previously saved waypoint"**
```
1. list_waypoints() → Find waypoint "Home Base" at (120, 64, -80)
2. move_to_position(120, 64, -80, range=5)
3. send_chat("Arrived at Home Base waypoint")
```

**Task: "Go to coordinates (200, 65, -150)"**
```
1. get_position() → Note current location
2. move_to_position(200, 65, -150, range=5)
3. send_chat("Arrived at (200, 65, -150)")
```

**Task: "Explore 500 blocks north and report findings"**
```
1. start = get_position()
2. target_z = start.z - 500  # North is negative Z
3. move_to_position(start.x, start.y, target_z, range=10)
4. look around (note what you see)
5. send_chat(f"Explored to ({start.x}, Y, {target_z}). Found: [describe]")
6. Return: move_to_position(start.x, start.y, start.z)
```

**Task: "Create a navigation marker at home base"**
```
1. Navigate to base: move_to_position(0, 64, 0)
2. Build tall marker: build_pillar(30)
3. Top with glowstone: place_block(0, 95, 0, "glowstone")
4. send_chat("Built 30-block marker at home base (0, 64, 0)")
```

**Task: "Meet HandelBot for trading"**
```
1. send_bot_message("HandelBot", "Where should we meet?", "normal")
2. read_bot_messages() → Wait for response with coordinates
3. Once received: move_to_position(received_x, received_y, received_z, range=3)
4. find_entity("player", 20) → Verify HandelBot is nearby
5. Proceed with trading skill
```

## When NOT to Use This Skill

- **For combat** → Use combat skill (when defending against mobs)
- **For building** → Use building skill (constructing structures)
- **For resource gathering** → Use mining/farming skills
- **For item exchange** → Use trading skill

This skill is specifically for **movement, wayfinding, and location management**.
