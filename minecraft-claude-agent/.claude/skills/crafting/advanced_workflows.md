# Advanced Crafting Workflows – Multi-Step Production Chains

## Overview

Advanced crafting involves creating complex items that require multiple intermediate steps, coordination between bots, and efficient resource management. This guide covers production chains, crafting station setup, and automation patterns.

## Production Chain Concepts

### Chain Components

1. **Raw Materials** → Gathered from world (logs, ores, wool, etc.)
2. **Intermediate Products** → First processing (planks, ingots, string, etc.)
3. **Final Products** → Assembled items (tools, armor, mechanisms, etc.)

### Chain Efficiency

**Simple Chain (1 bot):**
```
SammelBot: Gather oak_logs → Craft planks → Craft sticks → Craft pickaxe
Time: 10 minutes (sequential)
```

**Parallel Chain (3 bots):**
```
SammelBot: Gather oak_logs continuously
HandelBot: Craft planks and sticks continuously
BauBot: Craft tools from ready components
Time: 4 minutes (parallel processing)
```

## Common Production Chains

### Chain 1: Basic Tools (Pickaxes, Axes, Shovels)

**Materials Needed:**
- Wood: 3+ logs per tool
- Stone/Iron: 3 blocks/ingots per tool (for stone/iron tools)

**Workflow:**
```
Phase 1: Wood Gathering
SammelBot:
1. find_trees(radius=50, types=["oak", "spruce"])
2. Use tree-felling skill to gather 16 oak_logs
3. Report: send_chat("Collected 16 oak_logs for toolmaking")

Phase 2: Material Processing
HandelBot:
1. Receive logs from SammelBot
2. craft_item("oak_planks", count=64) → converts 16 logs to 64 planks
3. craft_item("stick", count=32) → converts 32 planks to 32 sticks
4. Report: "Processed: 32 planks remaining + 32 sticks ready"

Phase 3: Tool Crafting
BauBot:
1. Receive planks and sticks
2. craft_item("wooden_pickaxe", count=2)
3. craft_item("wooden_axe", count=2)
4. craft_item("wooden_shovel", count=2)
5. Distribute tools: drop_item("wooden_pickaxe", 1) near each miner
```

**Optimization:**
- Keep 1 stack of sticks always in reserve
- Craft tools in batches of 5+ when possible
- Use stone/iron for pickaxes (more durable), wood for other tools (cheaper)

### Chain 2: Iron Tools & Armor

**Materials Needed:**
- Iron ore: 24+ blocks (for full armor + tool set)
- Coal/Wood: 8+ units (for smelting fuel)
- Sticks: 8+ (for tool handles)

**Workflow:**
```
Phase 1: Mining Expedition (30 min)
GräberBot + SammelBot:
1. Use mining skill, target Y=11-50
2. Mine iron_ore until 24+ blocks collected
3. Mine coal simultaneously for fuel
4. Return to base: send_chat("Returning with 32 iron_ore, 48 coal")

Phase 2: Smelting (10 min)
HandelBot at furnace:
1. Place furnace if not exists
2. smelt_item("iron_ingot", count=24, fuel="coal")
3. Wait for smelting completion
4. Report: "24 iron ingots ready for crafting"

Phase 3: Tool Crafting
BauBot:
1. craft_item("iron_pickaxe", count=1) → Uses 3 ingots + 2 sticks
2. craft_item("iron_axe", count=1) → Uses 3 ingots + 2 sticks
3. craft_item("iron_shovel", count=1) → Uses 1 ingot + 2 sticks
4. craft_item("iron_sword", count=1) → Uses 2 ingots + 1 stick
Subtotal: 9 ingots used, 15 remain

Phase 4: Armor Crafting
BauBot continues:
1. craft_item("iron_helmet", count=1) → 5 ingots
2. craft_item("iron_chestplate", count=1) → 8 ingots
3. craft_item("iron_leggings", count=1) → 7 ingots (would need 20 ingots for full set)
4. Report: "Tools complete. Armor: helmet + chestplate done, need 7 more ingots for leggings"

Phase 5: Distribution
HandelBot (as trader):
1. Collect crafted items from BauBot
2. Distribute to requesting bots
3. Example: send_bot_message("GräberBot", "Iron pickaxe ready for pickup at base", "normal")
```

**Resource Calculation:**
- Full iron armor set: 24 ingots (helmet 5, chest 8, legs 7, boots 4)
- Full iron tool set: 11 ingots (pick 3, axe 3, shovel 1, sword 2, hoe 2)
- **Total for 1 bot equipped:** 35 iron ingots = 35 iron ore blocks

### Chain 3: Redstone Components

**Materials Needed:**
- Redstone dust: Variable (1-64 per device)
- Iron ingots: For pistons, hoppers
- Cobblestone: For dispensers, droppers
- Wood: For pressure plates, buttons

**Workflow Example: Crafting Hopper System**
```
Goal: Create 5 hoppers for item collection

Materials needed per hopper: 5 iron ingots + 1 chest

Phase 1: Iron Collection
GräberBot: Mine 25 iron ore (for 5 hoppers)
HandelBot: Smelt 25 iron ingots

Phase 2: Wood Collection
SammelBot: Gather 8 oak_logs → Craft 32 planks → Craft 5 chests

Phase 3: Assembly
BauBot:
1. craft_item("chest", count=5) → Already done by SammelBot
2. craft_item("hopper", count=5) → Combines iron + chest
3. Report: "5 hoppers ready for placement"

Phase 4: Installation
BauBot moves to installation location:
1. place_block(hopper_x, hopper_y, hopper_z, "hopper")
2. Repeat for all 5 hoppers in desired configuration
3. send_chat("Hopper system installed at (X, Y, Z)")
```

### Chain 4: Food Production (Bread)

**Materials Needed:**
- Wheat: 3 per bread loaf
- Seeds: For planting next generation

**Workflow:**
```
Phase 1: Farming Setup (if not exists)
SammelBot:
1. Find water source
2. Till soil in 9x9 area near water
3. Plant wheat_seeds
4. Apply bone_meal if available (speeds growth)

Phase 2: Harvesting
SammelBot:
1. Wait for wheat to mature (yellow color, but bot can't see - use timer)
2. Break mature wheat plants
3. collect_nearby_items(["wheat", "wheat_seeds"], 5)
4. Report: "Harvested 48 wheat, 16 wheat_seeds"

Phase 3: Replanting
SammelBot:
1. Immediately replant with collected seeds
2. Keep farming cycle going

Phase 4: Bread Crafting
HandelBot:
1. Receive wheat from SammelBot
2. craft_item("bread", count=16) → Uses 48 wheat
3. Distribute: "16 bread available in central storage"

Bot consumption:
- Each bot uses ~1 food per 30 minutes of work
- Keep 64 bread in central storage as buffer
```

## Multi-Bot Crafting Patterns

### Pattern 1: Assembly Line

**Concept:** Each bot specializes in one stage

**Example: Mass Tool Production**
```
Station 1 - Raw Materials (SammelBot):
- Gathers logs continuously
- Drops 64 logs every 10 minutes at processing station

Station 2 - Processing (HandelBot):
- Picks up logs
- Crafts planks (1 log → 4 planks)
- Crafts sticks (2 planks → 4 sticks)
- Drops processed materials at assembly station

Station 3 - Assembly (BauBot):
- Picks up planks and sticks
- Crafts tools (pickaxe, axe, shovel)
- Stores finished tools in distribution chest

Result: Continuous tool production without bottlenecks
```

### Pattern 2: Batch Processing

**Concept:** Gather large quantities, then mass-craft

**Example: Preparing for Large Build**
```
Goal: Craft 500 torches for underground mining

Phase 1: Resource Calculation
- 500 torches need 500 coal + 500 sticks
- 500 sticks need 250 planks
- 250 planks need 62.5 logs (round up to 64)

Phase 2: Swarm Gathering
send_chat("BATCH JOB: Need 64 logs + 500 coal")
SammelBot: Gather 64 logs (20 min)
GräberBot: Mine 500 coal (30 min)

Phase 3: Mass Crafting
HandelBot receives all materials:
1. craft_item("oak_planks", count=256)
2. craft_item("stick", count=500) → Uses 250 planks
3. craft_item("torch", count=500) → Uses 500 sticks + 500 coal

Phase 4: Distribution
HandelBot: "500 torches ready. GräberBot take 300, keep 200 in storage."
```

### Pattern 3: Parallel Crafting

**Concept:** Multiple bots craft same item simultaneously

**Example: Urgent Armor Production**
```
Emergency: 3 bots need iron armor before boss fight

Materials: 72 iron ingots total (24 per bot)

Parallel workflow:
BauBot: Craft armor set for self (24 ingots)
HandelBot: Craft armor set for SammelBot (24 ingots)
SammelBot: Craft armor set for GräberBot (24 ingots)

All craft simultaneously (5 min):
1. Each bot has iron ingots in inventory
2. Each crafts in parallel: helmet → chestplate → leggings → boots
3. Exchange armors: HandelBot drops armor for SammelBot, etc.

Result: 3 bots fully armored in 5 minutes instead of 15 minutes sequential
```

## Crafting Station Setup

### Basic Crafting Area

**Components:**
- Crafting table (main workstation)
- Chest (input materials)
- Chest (output products)
- Sign (label station purpose)

**Layout:**
```
[Chest: Input]  [Crafting Table]  [Chest: Output]
       ↓              ↓                  ↓
  Place materials  Craft items    Collect products
```

**Setup by BauBot:**
```
1. place_block(base_x, base_y, base_z, "chest") → Input chest
2. place_block(base_x+2, base_y, base_z, "crafting_table")
3. place_block(base_x+4, base_y, base_z, "chest") → Output chest
4. set_waypoint("crafting_station", base_x+2, base_y, base_z, "Main crafting area")
5. send_chat("Crafting station ready at waypoint 'crafting_station'")
```

### Advanced Smelting Setup

**Components:**
- 3+ furnaces (parallel smelting)
- Input chest (raw ores)
- Fuel chest (coal/wood)
- Output chest (ingots)

**Workflow:**
```
HandelBot at smelting station:
1. withdraw_items(input_chest_x, input_chest_y, input_chest_z, "iron_ore", 64)
2. Distribute ore across 3 furnaces:
   - smelt_item("iron_ingot", count=21, fuel="coal") in furnace 1
   - smelt_item("iron_ingot", count=21, fuel="coal") in furnace 2
   - smelt_item("iron_ingot", count=22, fuel="coal") in furnace 3
3. Wait for completion (parallel smelting = 3x faster)
4. Collect ingots from all furnaces
5. deposit_items(output_chest_x, output_chest_y, output_chest_z, "iron_ingot", 64)
6. send_chat("64 iron ingots smelted and stored")
```

## Optimization Strategies

### Strategy 1: Pre-Crafting Components

**Keep these ready at all times:**
- 64 sticks (for tool handles)
- 64 planks (for quick crafting)
- 32 torches (for emergency exploration)
- 16 bread (for food emergencies)

**Maintenance:**
```
HandelBot checks storage every 30 minutes:
1. list_inventory() of central storage chest
2. If sticks < 32: Craft 64 sticks
3. If planks < 32: Craft 64 planks
4. If torches < 16: Craft 32 torches
5. If bread < 8: Craft 16 bread
```

### Strategy 2: Resource Pooling

**Instead of each bot gathering individually:**
```
Bad approach:
BauBot gathers 5 logs for own tools
HandelBot gathers 5 logs for own tools
SammelBot gathers 5 logs for own tools
Total time: 15 minutes (sequential)

Good approach:
SammelBot gathers 15 logs for all bots
HandelBot crafts all tools for all bots
Total time: 6 minutes (specialized + parallel)
```

### Strategy 3: Crafting Queues

**For complex multi-item requests:**
```
Player requests: "I need 10 pickaxes, 5 axes, 20 torches"

HandelBot creates queue:
1. Calculate materials: 30 planks + 25 sticks + 20 coal
2. Request materials: send_bot_message("SammelBot", "Need 8 logs + 20 coal", "normal")
3. Queue crafts in order:
   - Planks first (prerequisite for sticks)
   - Sticks second (prerequisite for tools)
   - Tools third (pickaxes, axes)
   - Torches last (independent)
4. Execute queue automatically
5. Report completion: "Crafted 10 pickaxes, 5 axes, 20 torches - available in central storage"
```

## Troubleshooting

**"Missing crafting table":**
```
Solution: Always craft near a crafting table
- find_block("crafting_table", max_distance=10)
- If not found: craft_item("crafting_table", count=1) from 4 planks
- place_block(near_x, near_y, near_z, "crafting_table")
```

**"Not enough materials":**
```
Check before crafting:
1. list_inventory()
2. For each ingredient, find_item(ingredient_name)
3. If insufficient: send_bot_message("SammelBot", "Need 32 planks for crafting", "normal")
4. Wait for delivery before attempting craft
```

**"Crafting failed":**
```
Common causes:
- Wrong recipe (check Minecraft wiki)
- Missing prerequisite items
- Inventory full (no space for output)

Debug:
1. list_inventory() → Check what you actually have
2. Verify recipe requirements
3. Free up inventory space if needed
```

## Example: Complete Production Chain

**Goal: Equip GräberBot for diamond mining expedition**

**Requirements:**
- 2 iron pickaxes
- 1 iron sword
- Full iron armor (helmet, chestplate, leggings, boots)
- 64 torches
- 32 bread

**Execution:**
```
Coordinator (BauBot) calculates:
- Iron needed: 6 (picks) + 2 (sword) + 24 (armor) = 32 ingots
- Coal needed: 64 (torches) + 10 (smelting fuel) = 74
- Wheat needed: 96 (for 32 bread)
- Logs needed: 16 (for 64 sticks + crafting table)

Phase 1: Resource Gathering (30 min)
send_bot_message("GräberBot", "Mine 32 iron ore + 74 coal", "high")
send_bot_message("SammelBot", "Harvest 96 wheat + gather 16 logs", "high")

Phase 2: Processing (15 min)
HandelBot receives materials:
- Smelt 32 iron_ore → 32 iron_ingots
- Craft 16 logs → 64 planks → 32 sticks
- Craft 96 wheat → 32 bread

Phase 3: Crafting (10 min)
HandelBot crafts equipment set:
- 2 iron_pickaxe, 1 iron_sword
- Full iron armor set
- 64 torches

Phase 4: Delivery (5 min)
HandelBot meets GräberBot:
1. drop_item("iron_pickaxe", 2)
2. drop_item("iron_sword", 1)
3. drop_item("iron_helmet", 1)
4. ... (all armor pieces)
5. drop_item("torch", 64)
6. drop_item("bread", 32)

send_chat("GräberBot fully equipped for diamond mining!")

Total time: 60 minutes coordinated vs. 120+ minutes solo
```

---

**Master these workflows to transform your colony into an efficient production system!**
