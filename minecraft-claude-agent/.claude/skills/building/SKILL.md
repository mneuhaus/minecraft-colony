---
name: building
description: Build basic structures like walls, platforms, pillars, and simple shelters. Use this for construction tasks and creating safe spaces. Supports multi-bot coordination for large builds.
allowed-tools: get_position, move_to_position, look_at, list_inventory, find_item, place_block, break_block_and_wait, build_pillar, descend_pillar_safely, send_chat, send_bot_message, read_bot_messages, find_entity
---

# Building Skill – Basic Construction

This skill teaches you how to build simple structures in Minecraft using available materials.

## Available Tools

- **get_position()** – Know your current location before building.
- **move_to_position(x, y, z, range)** – Navigate to the build site.
- **look_at(x, y, z)** – Face the direction you're building.
- **list_inventory()** – Check what building materials you have.
- **find_item(name)** – Verify you have enough blocks for the project.
- **place_block(x, y, z, block_type)** – Place a single block at coordinates.
- **break_block_and_wait(x, y, z)** – Remove misplaced blocks AND collect the dropped items. **IMPORTANT**: Always use this instead of dig_block when you need to recover building materials!
- **build_pillar(height)** – Quickly build vertical pillars.
- **descend_pillar_safely()** – Come back down after building high.
- **send_chat(message)** – Confirm progress and ask for clarification.
- **send_bot_message(recipient, message, priority)** – Send direct messages to other bots for coordination.
- **read_bot_messages()** – Check for messages from other bots.
- **find_entity(type, max_distance)** – Find nearby players or bots to coordinate with.

## Building Workflow

### 1. Understand the Request
- Ask what should be built: wall, platform, shelter, pillar?
- Get dimensions: length, width, height
- Confirm location: specific coordinates or "near me"
- Use `send_chat` to clarify any ambiguity

### 2. Check Materials
- Run `list_inventory()` to see available blocks
- Use `find_item` to check for specific materials
- Calculate: Length × Width × Height = Blocks needed
- If insufficient materials, report shortage via `send_chat`

### 3. Navigate to Build Site
- Use `get_position()` for current location
- Use `move_to_position(target_x, target_y, target_z, range=1)` to reach site
- Position yourself at the starting corner

### 4. Build the Structure

#### For Flat Platforms (e.g., "build a 5x5 platform")
```
1. Start at one corner
2. Place blocks in a row using place_block(x, y, z, block_type)
3. Move to next row, repeat
4. Continue until platform complete
5. Use look_at to face each placement location
```

#### For Walls (e.g., "build a 10-block wall, 3 blocks high")
```
1. Place ground-level blocks first (row by row)
2. Build second layer on top
3. Continue for each layer until desired height
4. For tall walls, use build_pillar to reach high blocks
```

#### For Pillars (e.g., "build a pillar 10 blocks high")
```
1. Use build_pillar(height=10) for quick vertical construction
2. Descend using descend_pillar_safely()
```

#### For Simple Shelters (e.g., "build a 3x3 shelter")
```
1. Build floor platform (3x3)
2. Build 4 walls around perimeter (leave gap for door)
3. Build roof on top
4. Use build_pillar for tall constructions
```

### 5. Verify and Report
- After building, move back to view the structure
- Use `send_chat` to confirm completion
- Report blocks used and blocks remaining
- Mention any issues encountered

## Best Practices

### Tool Usage Notes (CRITICAL)

**Block Breaking Tools - Know the Difference:**
- **break_block_and_wait(x, y, z)**: Breaks block AND waits for items to drop, then auto-collects them. ✅ **Use this for building!**
- **dig_block(x, y, z)**: Only breaks the block, does NOT wait for or collect items. ❌ **Don't use for material recovery!**

**Why This Matters:**
When you break a misplaced block or need to clear space:
```
❌ WRONG: dig_block(100, 64, 50) → Block breaks, items drop, but you don't collect them
✅ RIGHT: break_block_and_wait(100, 64, 50) → Block breaks, wait for drops, auto-collect items
```

**Item Collection:**
- After using break_block_and_wait, items are automatically picked up
- If you accidentally used dig_block, use collect_nearby_items(radius=10) to recover drops
- Always verify inventory with list_inventory() after breaking blocks to confirm collection

### Material Management
- Always check inventory before starting
- Reserve 10-20% extra blocks for mistakes
- Use common materials: dirt, cobblestone, planks, logs
- Don't use rare materials (diamond blocks, gold) without confirmation
- Use break_block_and_wait to recover misplaced blocks into inventory

### Building Techniques
- Start from ground level, build upward
- Build in layers (bottom to top)
- For large structures, build in sections
- Use `look_at` before each `place_block` for accuracy
- Double-check coordinates to avoid misplacement

### Safety
- Don't build over lava or water without confirming
- For high structures, use `build_pillar` and `descend_pillar_safely`
- If materials run out mid-build, stop and report status
- Keep track of your position - use `get_position()` frequently

### Common Patterns

**4-Wall Room**:
1. Build perimeter at ground level (leave door gap)
2. Build second layer, third layer, etc.
3. Add roof on top

**Bridge**:
1. Build pillars at both ends (use `build_pillar`)
2. Place blocks across the gap
3. Build in straight line between pillars

**Tower**:
1. Use `build_pillar(height)` for quick vertical construction
2. Add platforms at intervals if needed
3. Descend with `descend_pillar_safely()`

## Error Handling

- **Insufficient materials**: Report shortage, ask for more or scale down project
- **Can't reach location**: Use `build_pillar` to gain height or navigate closer
- **Block placement fails**: Check if space is occupied, break existing block first
- **Lost position**: Use `get_position()` to reorient, navigate back to build site

## Multi-Bot Coordination for Large Builds

When building projects require >200 blocks or multiple simultaneous structures:

### 1. Project Planning Phase
```
Build coordinator (usually BauBot):
1. Announce project: send_chat("Starting 20x20 platform build at (100, 64, 100)")
2. Calculate materials: 20×20 = 400 blocks needed
3. Request materials: send_bot_message("SammelBot", "Need 400 cobblestone for platform project", "high")
4. Wait for material delivery confirmation
5. Divide work zones
```

### 2. Work Zone Division
Split large builds into non-overlapping zones to prevent bots from interfering:

**Example: 20x20 Platform Split Between 2 Bots**
```
Bot A (BauBot): Rows X=100 to X=109 (west half)
Bot B (HandelBot): Rows X=110 to X=119 (east half)

Announce divisions:
send_bot_message("HandelBot", "You build east half (X=110-119), I'll build west half (X=100-109)", "high")
```

**Example: 4-Wall Structure Split Between 3 Bots**
```
BauBot: North wall (Z=100, X=100-120)
HandelBot: East wall (X=120, Z=100-115)
GräberBot: South + West walls (remaining)
```

### 3. Coordination Protocol
```
Before starting your section:
1. Confirm assignment: send_chat("Starting on east wall section")
2. Move to starting position: move_to_position(zone_start_x, y, zone_start_z)
3. Begin building in your zone ONLY

While building:
4. Progress updates every 50 blocks: send_chat("East wall 50% complete")
5. If you finish early: read_bot_messages() to check if others need help
6. If blocked/stuck: send_bot_message("BauBot", "Need help, stuck at (X,Y,Z)", "high")

After completing section:
7. Announce completion: send_chat("East wall section complete")
8. Offer to help: "My zone done, who needs assistance?"
9. Return excess materials: see resource-management skill
```

### 4. Preventing Conflicts
**Space separation**: Keep 3+ blocks between bots to avoid placement conflicts
**Synchronization points**: "Everyone finish current row before moving to next level"
**Material handoffs**: Use designated drop zones, not direct bot-to-bot while building

### 5. Progress Tracking
Project coordinator maintains status:
```
send_chat("Platform build status: West 75%, East 60%, Total 67%")
```

Other bots report completion:
```
send_chat("My section complete. 128 cobblestone used, 12 remaining")
```

### 6. Common Multi-Bot Patterns

**Parallel Walls (2 bots):**
- Bot A builds north/south walls
- Bot B builds east/west walls
- Meet at corners, coordinate final blocks

**Layer-by-Layer (3+ bots):**
- All bots work on same Y-level
- Divide XZ plane into quadrants
- Move up together: "Everyone ready for Y=65?"

**Assembly Line (material + builder):**
- SammelBot continuously gathers/delivers materials
- BauBot focuses purely on placing blocks
- HandelBot handles finishing touches (torches, doors)

## When Not to Use This Skill

- Complex redstone contraptions → requires specialized redstone skill
- Automated farms → requires farming skill
- Large-scale terraforming → requires excavation skill
- Decorative builds with specific patterns → needs detailed blueprint, not general building

## Example Commands

**Single Bot:**
- "Build a 5x5 dirt platform here"
- "Make a wall 10 blocks long and 3 blocks high"
- "Build a simple 3x3 shelter with a door"
- "Create a pillar 15 blocks tall"
- "Build a bridge connecting these two points"

**Multi-Bot Coordination:**
- "BauBot and HandelBot, build a 20x20 platform at spawn. Divide work zones"
- "I'll build the north wall, HandelBot takes east wall, GräberBot south/west"
- "Everyone working on large community hall - check your assigned section"
- "Coordinate with BauBot on shared corner placement at (100,64,100)"
