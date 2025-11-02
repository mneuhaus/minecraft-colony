---
name: resource-collection
description: Coordinate resource gathering, storage, and distribution between bots. Use when gathering materials, storing in chests, or requesting resources from other bots. Ensures efficient colony-wide resource management.
allowed-tools: find_block, find_ores, find_trees, find_water, dig_block, break_block_and_wait, collect_nearby_items, list_inventory, drop_item, open_chest, deposit_items, withdraw_items, get_position, move_to_position, set_waypoint, list_waypoints, send_bot_message
---

# Resource Collection Skill – Coordinated Gathering & Storage

Efficiently gather, store, and share resources across the bot colony.

## Overview

Resource collection involves:
1. **Finding** resources using exploration tools
2. **Gathering** materials through mining, tree-felling, etc.
3. **Transporting** items to storage locations
4. **Storing** in organized chest systems
5. **Sharing** with other bots via messaging

## Core Workflow

### Phase 1: Identify Resource Need
```
Goal: "Gather 64 cobblestone"
1. Check inventory: list_inventory()
2. Calculate needed: 64 - current_amount
3. Announce intent: send_bot_message("Kubo: Gathering 64 cobblestone")
```

### Phase 2: Locate Resource
```
4. Find resource: find_block(blockType="stone", maxDistance=50, count=10)
5. Select nearest accessible target
6. Navigate: move_to_position(nearest.x, nearest.y, nearest.z)
```

### Phase 3: Gather Resource
```
7. Mine blocks: dig_block(x, y, z) OR break_block_and_wait(x, y, z)
8. Collect drops: collect_nearby_items(radius=5)
9. Verify inventory: list_inventory()
10. Repeat until target amount reached
```

### Phase 4: Store Resource
```
11. Navigate to storage: move_to_position(chest_x, chest_y, chest_z)
12. Open chest: open_chest(chest_x, chest_y, chest_z)
13. Deposit items: deposit_items(chest_x, chest_y, chest_z, "cobblestone", 64)
14. Announce: send_bot_message("Kubo: Stored 64 cobblestone at base chest")
```

## Storage System Strategy

### Waypoint Organization
Create waypoints for all storage locations:
```
set_waypoint("storage_main", x, y, z, "Main storage chest with common materials")
set_waypoint("storage_ores", x, y, z, "Ore storage chest")
set_waypoint("storage_wood", x, y, z, "Wood and plant materials")
set_waypoint("storage_food", x, y, z, "Food and farming supplies")
```

### Chest Categories
Organize chests by resource type:
- **Building Materials**: cobblestone, planks, glass, bricks
- **Ores & Minerals**: coal, iron, gold, diamond, redstone
- **Wood & Plants**: logs, planks, saplings, leaves
- **Food & Farming**: wheat, bread, seeds, bone meal
- **Tools & Equipment**: pickaxes, axes, swords, armor
- **Misc**: dirt, sand, gravel, misc items

## Bot-to-Bot Resource Sharing

### Requesting Resources
```
send_bot_message("Kubo needs: 10 iron_ingot at (100, 64, 50)")
# Wait for response
# Another bot: withdraw_items(chest_x, chest_y, chest_z, "iron_ingot", 10)
# Another bot: move_to_position(100, 64, 50)
# Another bot: drop_item("iron_ingot", 10)
```

### Offering Resources
```
send_bot_message("Pixo: I have 32 oak_log to share at base chest")
# Other bots can withdraw as needed
```

### Direct Handoff (Trading Skill)
For immediate transfers, use the trading skill to coordinate drop/pickup at a specific location.

## Resource Types & Gathering Methods

### Stone & Ores
- **Tool**: find_ores, find_block
- **Method**: dig_block with pickaxe equipped
- **Collection**: break_block_and_wait ensures drops spawn
- **Storage**: "storage_ores" waypoint

### Wood & Trees
- **Tool**: find_trees
- **Method**: Use tree-felling skill (break_block_and_wait for each log)
- **Collection**: wait_for_saplings, collect_nearby_items
- **Replanting**: place_sapling for sustainability
- **Storage**: "storage_wood" waypoint

### Water
- **Tool**: find_water
- **Method**: Collect with bucket (if implemented)
- **Purpose**: Farming, brewing, transportation

### Food
- **Tool**: farming skill tools
- **Method**: Harvest crops, kill animals
- **Storage**: "storage_food" waypoint

## Efficiency Best Practices

### 1. Batch Collection
Don't gather 1 item at a time - collect full stacks:
- Stone: 64 blocks
- Logs: 32-64 logs
- Ores: Until inventory near full

### 2. Tool Durability
- Check tool condition before starting
- Bring backup tools or materials to craft more
- Return to base if tool breaks

### 3. Inventory Management
- Keep inventory organized
- Deposit excess materials before continuing
- Reserve slots for new resources

### 4. Safety Awareness
- Check time_of_day before long expeditions
- Return to shelter if night approaches
- Mark dangerous areas with waypoints

## Multi-Bot Coordination Patterns

### Pattern 1: Dedicated Gatherer
```
SammelBot (resource bot):
- Specializes in gathering specific resources
- Regularly deposits to storage
- Announces availability via send_bot_message
```

### Pattern 2: Builder Requesting Materials
```
BauBot (building bot):
1. Check storage: open_chest(storage_x, storage_y, storage_z)
2. If insufficient materials:
   send_bot_message("BauBot needs: 100 cobblestone for project")
3. Wait for SammelBot to gather and deposit
4. Withdraw materials: withdraw_items(...)
5. Begin construction
```

### Pattern 3: Emergency Resource Rush
```
All bots: "Need iron for tools urgently!"
1. Multiple bots use find_ores("iron_ore")
2. Each mines different iron deposits (coordinate locations)
3. All deposit to central storage
4. Crafting bot creates tools for all
```

## Common Mistakes

❌ **Don't over-gather** - Only collect what's needed
❌ **Don't skip communication** - Always announce large gathering operations
❌ **Don't leave resources on ground** - Use collect_nearby_items
❌ **Don't forget to replant** - Saplings ensure renewable wood
❌ **Don't ignore storage organization** - Messy chests waste time

✅ **Do coordinate locations** - Multiple bots shouldn't mine the same spot
✅ **Do mark new resource deposits** - Create waypoints for future use
✅ **Do batch transport** - Full inventory trips are more efficient
✅ **Do verify storage** - Check chest contents before claiming shortage
✅ **Do maintain sustainability** - Replant, avoid depleting nearby resources

## Example: Complete Cobblestone Gathering Operation

```
=== Initial State ===
Kubo at position (95, 64, 42)
Inventory: empty
Goal: 128 cobblestone for BauBot's construction project

=== Execution ===
1. send_bot_message("Kubo: Gathering 128 cobblestone for BauBot")
2. list_inventory() → confirms empty, 36 free slots
3. find_block(blockType="stone", maxDistance=50, count=10)
   → Found 10 stone locations, nearest at (95, 48, 42) - 16 blocks
4. move_to_position(95, 48, 42)
5. equip_item("wooden_pickaxe") OR use empty hand for stone
6. Loop 128 times (or until inventory full):
   - dig_block(95, 48, 42) → mine 1 stone block
   - collect_nearby_items(radius=3)
7. list_inventory() → 128 cobblestone (2 stacks)
8. list_waypoints() → "storage_main" at (100, 65, 50)
9. move_to_position(100, 65, 50)
10. open_chest(100, 65, 49) → verify chest location
11. deposit_items(100, 65, 49, "cobblestone", 128)
12. send_bot_message("Kubo: Deposited 128 cobblestone at storage_main")
13. send_bot_message("BauBot: Materials ready for your project!")

=== Final State ===
Kubo at position (100, 65, 50)
Inventory: empty
Storage chest: +128 cobblestone
BauBot can now: withdraw_items and start building
```

## Integration with Other Skills

- **Exploration**: Find new resource deposits
- **Mining**: Extract stone and ores efficiently
- **Tree-Felling**: Gather wood sustainably
- **Building**: Provide materials for construction
- **Crafting**: Supply ingredients for tool/item creation
- **Trading**: Direct bot-to-bot item transfers

## Testing Checklist

- [ ] Bot finds resources correctly
- [ ] Bot gathers resources without getting stuck
- [ ] Bot deposits to correct chest
- [ ] Bot announces operations via send_bot_message
- [ ] Bot coordinates with other bots successfully
- [ ] Storage waypoints created and used
- [ ] Inventory doesn't overflow
- [ ] Resources organized by category

---

**Remember**: "Teamwork makes the dream work - communicate, coordinate, succeed!"
