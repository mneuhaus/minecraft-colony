---
name: building
description: Build basic structures like walls, platforms, pillars, and simple shelters. Use this for construction tasks and creating safe spaces.
allowed-tools: get_position, move_to_position, look_at, list_inventory, find_item, place_block, break_block_and_wait, build_pillar, descend_pillar_safely, send_chat
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
- **break_block_and_wait(x, y, z)** – Remove misplaced blocks.
- **build_pillar(height)** – Quickly build vertical pillars.
- **descend_pillar_safely()** – Come back down after building high.
- **send_chat(message)** – Confirm progress and ask for clarification.

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

### Material Management
- Always check inventory before starting
- Reserve 10-20% extra blocks for mistakes
- Use common materials: dirt, cobblestone, planks, logs
- Don't use rare materials (diamond blocks, gold) without confirmation

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

## When Not to Use This Skill

- Complex redstone contraptions → requires specialized redstone skill
- Automated farms → requires farming skill
- Large-scale terraforming → requires excavation skill
- Decorative builds with specific patterns → needs detailed blueprint, not general building

## Example Commands

- "Build a 5x5 dirt platform here"
- "Make a wall 10 blocks long and 3 blocks high"
- "Build a simple 3x3 shelter with a door"
- "Create a pillar 15 blocks tall"
- "Build a bridge connecting these two points"
