---
name: mining
description: Mine blocks and gather resources like stone, coal, iron, and other minerals. Use for underground excavation and tunnel creation.
allowed-tools: get_position, move_to_position, look_at, list_inventory, find_item, dig_block, break_block_and_wait, collect_nearby_items, place_block, build_pillar, descend_pillar_safely, send_chat, send_bot_message
---

# Mining Skill – Resource Gathering and Excavation

This skill teaches you how to mine blocks safely and efficiently to gather resources.

## Available Tools

- **get_position()** – know your current coordinates before starting.
- **move_to_position(x, y, z, range)** – navigate to mining location.
- **look_at(x, y, z)** – face the block you want to mine.
- **list_inventory()** – check available tools and inventory space.
- **find_item(name)** – locate pickaxes and other tools.
- **dig_block(x, y, z)** – mine a single block quickly.
- **break_block_and_wait(x, y, z)** – mine a block and wait for item drops (more reliable for collecting).
- **collect_nearby_items(item_types, radius)** – pick up mined resources.
- **place_block(x, y, z, block_type)** – place blocks for safety (bridges, pillars).
- **build_pillar(height)** – build up quickly when mining upward.
- **descend_pillar_safely()** – safely descend after building up.
- **send_chat(message)** – communicate status and progress.
- **send_bot_message(recipient, message, priority)** – notify other bots of findings.

## Mining Workflow

### 1. Prepare for Mining

**Check Equipment:**
- Run `list_inventory()` to verify you have the right tools:
  - **Wooden pickaxe**: Can mine stone, coal
  - **Stone pickaxe**: Can mine iron, lapis lazuli
  - **Iron pickaxe**: Can mine gold, redstone, diamond
  - **Diamond pickaxe**: Can mine obsidian
- Check inventory space (at least 10 empty slots recommended)
- Confirm you have torches for lighting (if going underground)

**Safety First:**
- In creative mode: You can fly and are invulnerable
- In survival mode: Be cautious of fall damage, lava, and mobs
- Always keep track of your position with `get_position()`

### 2. Choose Mining Location

**Surface Mining (Easiest):**
- Look for exposed stone on hillsides or mountains
- Use `get_position()` to note your starting location
- Good for: Stone, coal, sometimes iron

**Cave Mining (Efficient):**
- Find natural caves for easy access to resources
- Caves often contain coal, iron, and other ores
- Watch for: Lava, water, mob spawners

**Strip Mining (Systematic):**
- Dig straight tunnels at specific Y-levels:
  - **Y=11-12**: Best for diamonds (also lava common, be careful!)
  - **Y=30-50**: Good for iron and coal
  - **Y=0-16**: Ancient debris (Nether only), diamonds
- Create parallel tunnels 2-3 blocks apart

**Quarry Mining (Large Scale):**
- Dig out large rectangular areas layer by layer
- Good for clearing space and getting lots of stone/cobblestone
- Very time-consuming but thorough

### 3. Basic Mining Techniques

**Single Block Mining:**
```
1. Stand next to the target block
2. Use look_at(block_x, block_y, block_z)
3. Use dig_block(block_x, block_y, block_z) for speed
4. OR use break_block_and_wait(block_x, block_y, block_z) if you want to ensure item collection
5. Use collect_nearby_items(["cobblestone", "coal", "iron_ore"], 3)
```

**Digging a Straight Tunnel:**
```
1. Start at your current position
2. Look straight ahead
3. Mine the block in front at head level (y+1)
4. Mine the block in front at foot level (y)
5. Move forward one block
6. Repeat for desired length
7. Place torches every 8 blocks for lighting (survival mode)
```

**Mining Downward (Staircase):**
```
NEVER dig straight down (you could fall into lava or caves)!
Instead, create a staircase:
1. Dig one block at your feet
2. Move into that space
3. Dig diagonally downward (one block forward, one block down)
4. Repeat in a spiral or straight pattern
5. This creates safe stairs you can climb back up
```

**Mining Upward (Pillar):**
```
1. Use build_pillar(height) to go up quickly
2. OR manually:
   - Mine the block above your head
   - Place a block beneath you to rise
   - Repeat
3. Use descend_pillar_safely() when done
```

### 4. Resource Collection

**After Mining Blocks:**
- Items drop nearby (within 2-3 blocks usually)
- Use `collect_nearby_items(["cobblestone", "coal_ore", "iron_ore"], radius=5)`
- Specify item types to avoid collecting junk
- Check inventory periodically with `list_inventory()`

**When Inventory is Full:**
- Stop mining
- Use `send_chat("My inventory is full, returning to base")`
- Navigate back to storage location
- Drop off items or store in chests
- Return to continue mining

### 5. Common Ores and Where to Find Them

| Resource | Tool Required | Y-Level Range | Notes |
|---|---|---|---|
| **Coal** | Wooden pickaxe+ | Y=0-192 | Common everywhere, used for torches/fuel |
| **Iron** | Stone pickaxe+ | Y=-64 to 320 | Most common around Y=16, essential resource |
| **Gold** | Iron pickaxe+ | Y=-64 to 32 | Rare in Overworld, common in Nether |
| **Lapis Lazuli** | Stone pickaxe+ | Y=-64 to 64 | Peak at Y=0, used for enchanting |
| **Redstone** | Iron pickaxe+ | Y=-64 to 16 | Peak at Y=-59, used for circuits |
| **Diamond** | Iron pickaxe+ | Y=-64 to 16 | Peak at Y=-59, very valuable |
| **Emerald** | Iron pickaxe+ | Y=-16 to 320 | Only in mountain biomes |
| **Copper** | Stone pickaxe+ | Y=-16 to 112 | Common, used for building |

### 6. Safety Guidelines

**Avoid These Mistakes:**
- ❌ **Never dig straight down** → Could fall into lava or caves
- ❌ **Never dig straight up** → Gravel/sand could suffocate you, lava could pour down
- ❌ **Don't mine without tools** → You'll destroy blocks but get no items
- ❌ **Don't forget your position** → Easy to get lost underground

**Best Practices:**
- ✅ Always keep track of coordinates with `get_position()`
- ✅ Mark your path with torches or distinctive blocks
- ✅ Carry extra tools (pickaxes break!)
- ✅ In survival: Keep food, armor, and weapon ready
- ✅ Place torches to prevent mob spawning (light level > 7)
- ✅ Listen for sounds: water, lava, mobs

**Emergency Situations:**
- **Hit lava:** Immediately place a block in front of it to block flow
- **Falling:** In creative mode, no damage. In survival, try to land in water or place blocks beneath you
- **Lost:** Use `get_position()` and navigate back to known coordinates

### 7. Efficiency Tips

**Tool Management:**
- Use the correct pickaxe tier for the ore (don't waste diamond pickaxe on stone!)
- Keep multiple pickaxes in inventory as backup
- In creative mode: Tools don't break, so use any tool

**Speed Mining:**
- `dig_block()` is faster than `break_block_and_wait()`
- Use `dig_block()` when mining lots of stone/dirt
- Use `break_block_and_wait()` for valuable ores to ensure item drop collection

**Inventory Management:**
- Don't collect cobblestone unless needed (very common, fills inventory)
- Focus on ores: coal, iron, gold, diamonds, redstone, lapis
- Use `collect_nearby_items(["coal", "iron_ore", "diamond"], 5)` to be selective

### 8. Coordinate with Other Bots

**When you find valuable resources:**
```
send_bot_message("HandelBot", "Found iron ore vein at (120, 45, -80), approximately 8 blocks", "normal")
```

**When you need supplies:**
```
send_bot_message("SammelBot", "Need more torches and food for extended mining run", "normal")
```

**Share discoveries:**
```
send_chat("I found a cave system at (150, 30, -100) with lots of coal")
```

### 9. Example Mining Task

**Task: "Mine 32 cobblestone"**

```
1. Check inventory: list_inventory()
2. Confirm pickaxe available: find_item("pickaxe")
3. Get current position: get_position()
4. Find nearby stone (usually just below surface)
5. Mine stone blocks:
   - look_at(stone_x, stone_y, stone_z)
   - break_block_and_wait(stone_x, stone_y, stone_z)
6. Collect drops: collect_nearby_items(["cobblestone"], 3)
7. Repeat until you have 32 cobblestone
8. Verify: list_inventory() should show cobblestone x 32+
9. Report: send_chat("I've collected 32 cobblestone")
```

**Task: "Mine down to Y=11 and look for diamonds"**

```
1. Get starting position: get_position()  # e.g., (100, 64, 200)
2. Create staircase mine going down:
   - Mine block at feet level
   - Move forward diagonally
   - Mine next block down
   - Place torches every 8 blocks
   - Continue until Y=11
3. At Y=11, create 2x2 tunnel extending in one direction:
   - Mine two blocks wide, two blocks tall
   - Extend for 30-50 blocks
   - Look for diamond ore (light blue ore blocks)
4. When found:
   - break_block_and_wait(diamond_ore_x, diamond_ore_y, diamond_ore_z)
   - collect_nearby_items(["diamond"], 3)
   - send_chat("Found diamonds at (x, y, z)!")
5. Return via the staircase you created
```

## When NOT to Use This Skill

- **If you need wood** → Use tree-felling skill instead
- **If you need to build structures** → Use building skill instead
- **If you need farmed items** → Use farming skill (crops, animals)
- **If area is protected** → Some servers prevent block breaking in spawn areas

## Troubleshooting

**"I can't break the block":**
- Check if you have the right pickaxe tier
- Bedrock (Y=0 in older versions) cannot be broken
- Some blocks require specific tools (dirt→shovel, wood→axe)

**"Items disappeared after mining":**
- Items may have fallen into lava or void
- Items despawn after 5 minutes if not collected
- Use `break_block_and_wait()` instead of `dig_block()` for better reliability

**"I'm lost underground":**
- Use `get_position()` to see current coordinates
- Navigate back to known coordinates (base, entrance)
- In worst case, dig straight up (place blocks below you as you go to avoid fall damage)

**"Inventory full":**
- Use `list_inventory()` to see what you have
- Drop less valuable items (cobblestone, dirt) to make room
- Return to base to store items in chests
