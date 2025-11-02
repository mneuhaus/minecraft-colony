---
name: crafting
description: Craft tools, items, and equipment. Smelt ores and cook food using furnaces. Essential for tool progression and self-sufficiency.
allowed-tools: craft_item, smelt_item, check_inventory, send_chat, send_bot_message, read_bot_messages
---

# Crafting Skill – Item Creation and Smelting

This skill teaches you how to craft items using crafting tables, smelt ores in furnaces, and progress through Minecraft's tool tiers for maximum efficiency.

## Available Tools

### Crafting
- **craft_item(item_name, count)** – craft items using inventory grid or crafting table
- **smelt_item(item_name, count, fuel)** – smelt ores, cook food, process items in furnace

### Support
- **check_inventory()** – view current inventory contents and counts
- **send_chat(message)** – communicate crafting status
- **send_bot_message(recipient, message, priority)** – request materials from other bots
- **read_bot_messages()** – receive crafting requests

## Core Crafting Concepts

### Crafting Grids

**Inventory Crafting (2x2)**:
- Available always, no crafting table needed
- Limited to simple recipes: planks, sticks, torches, crafting table
- Maximum recipe size: 2 rows × 2 columns

**Crafting Table (3x3)**:
- Required for most recipes (tools, weapons, armor, etc.)
- Full 3×3 grid allows complex patterns
- Can craft everything the 2×2 grid can, plus more

### Tool Tiers and Progression

Minecraft tools follow a progression system. Each tier is faster and more durable:

| Tier | Material | Durability | Speed | Mining Level |
|------|----------|------------|-------|--------------|
| **Wood** | Planks | 59 uses | 2x | Stone, Coal |
| **Stone** | Cobblestone | 131 uses | 4x | Iron, Lapis |
| **Iron** | Iron Ingots | 250 uses | 6x | Diamond, Gold, Redstone |
| **Diamond** | Diamonds | 1561 uses | 8x | Obsidian, all ores |
| **Netherite** | Netherite Ingots | 2031 uses | 9x | All blocks |

**Key Insight**: Always progress to the next tier as soon as possible. Iron tools are 3x faster and 4x more durable than stone!

## Crafting Workflows

### 1. Starting From Scratch (Wood → Stone → Iron)

**Step 1: Wood Tools** (first 2 minutes of gameplay)
```
# Punch 4 logs, craft planks
craft_item(item_name="oak_planks", count=16)

# Craft crafting table
craft_item(item_name="crafting_table", count=1)

# Place crafting table nearby (using building tools)

# Craft sticks
craft_item(item_name="stick", count=8)

# Craft wooden pickaxe (PRIORITY!)
craft_item(item_name="wooden_pickaxe", count=1)

# Craft wooden axe (faster wood gathering)
craft_item(item_name="wooden_axe", count=1)
```

**Step 2: Stone Tools** (next 5 minutes)
```
# Mine 11 cobblestone with wooden pickaxe
# (3 for furnace, 8 for stone tools)

# Craft furnace
craft_item(item_name="furnace", count=1)

# Craft stone pickaxe IMMEDIATELY
craft_item(item_name="stone_pickaxe", count=1)

# Craft stone axe
craft_item(item_name="stone_axe", count=1)

# Craft stone sword (for defense)
craft_item(item_name="stone_sword", count=1)

# Craft stone shovel (faster digging)
craft_item(item_name="stone_shovel", count=1)
```

**Step 3: Iron Tools** (after finding iron ore)
```
# Mine iron ore with stone pickaxe (requires Y < 64)
# Need minimum 3 iron ore (1 for pickaxe, rest for other tools)

# Smelt iron ore → iron ingots
smelt_item(item_name="raw_iron", count=3, fuel="coal")
# OR if you have iron_ore from older version:
smelt_item(item_name="iron_ore", count=3, fuel="coal")

# Craft iron pickaxe FIRST (unlock diamonds!)
craft_item(item_name="iron_pickaxe", count=1)

# Continue iron tool progression:
craft_item(item_name="iron_sword", count=1)
craft_item(item_name="iron_axe", count=1)
craft_item(item_name="iron_shovel", count=1)
```

### 2. Bulk Crafting

When crafting multiple items:
```
# Craft 16 torches at once
craft_item(item_name="torch", count=16)

# Smelt a full stack of iron
smelt_item(item_name="raw_iron", count=64, fuel="coal")

# Craft multiple tools for backup
craft_item(item_name="iron_pickaxe", count=3)
```

**Benefits**:
- Saves time (one function call vs many)
- Efficient material usage
- Better for mass production

### 3. Smelting Ores

**Common Smeltable Ores**:
```
# Iron (most common, most useful)
smelt_item(item_name="raw_iron", count=32, fuel="coal")
# Output: 32 iron_ingot

# Gold (for powered rails, golden apples)
smelt_item(item_name="raw_gold", count=8, fuel="coal")
# Output: 8 gold_ingot

# Copper (for lightning rods, spyglass - Minecraft 1.17+)
smelt_item(item_name="raw_copper", count=16, fuel="coal")
# Output: 16 copper_ingot
```

**Smelting Other Materials**:
```
# Cobblestone → Stone (for building)
smelt_item(item_name="cobblestone", count=64)

# Sand → Glass (for windows)
smelt_item(item_name="sand", count=32)

# Raw food → Cooked food (restore more hunger)
smelt_item(item_name="raw_beef", count=10)
# Output: 10 cooked_beef (4 hunger vs 1.5 for raw)
```

### 4. Fuel Management

The `smelt_item` tool auto-selects fuel if not specified:

**Fuel Efficiency** (items smelted per fuel):
1. **Coal Block**: 80 items (most efficient!)
2. **Blaze Rod**: 12 items
3. **Coal/Charcoal**: 8 items
4. **Dried Kelp Block**: 20 items
5. **Log**: 1.5 items
6. **Planks**: 1.5 items
7. **Stick**: 0.5 items (worst - avoid!)

**Pro Tips**:
- Use coal for ores (common, efficient)
- Use logs/planks for food (less valuable fuel)
- Craft coal blocks for mass smelting (9 coal → 1 coal block = 80 items)
- Kelp farms provide renewable fuel

### 5. Essential Crafting Recipes

**Survival Essentials**:
```
# Torches (light, prevent mob spawns)
craft_item(item_name="torch", count=64)
# Requires: 1 coal/charcoal + 1 stick each

# Chest (storage)
craft_item(item_name="chest", count=8)
# Requires: 8 planks each

# Bed (skip night, set spawn)
craft_item(item_name="white_bed", count=1)
# Requires: 3 wool + 3 planks

# Bucket (water transport, milk collection)
craft_item(item_name="bucket", count=3)
# Requires: 3 iron ingots each
```

**Tool Maintenance**:
```
# Always have backup tools!
craft_item(item_name="iron_pickaxe", count=2)

# Or carry materials to craft on the go:
# Keep 3 iron ingots + 2 sticks in inventory
```

## Advanced Crafting Techniques

### Crafting Table Proximity

The `craft_item` tool automatically finds nearby crafting tables:
- Searches within 32 blocks
- Uses closest available table
- Falls back to 2×2 inventory if recipe allows

**Best Practice**:
```
# Place crafting table at base central location
# All bots can share one crafting table
# Or place tables near work areas (mine entrance, farm, etc.)
```

### Material Preparation

Before crafting, ensure you have materials:
```
# Check current inventory
check_inventory()

# Request materials from another bot if needed
send_bot_message("SammelBot", "Need 16 iron ingots for tools", "normal")

# Wait for delivery
read_bot_messages()
```

### Efficient Progression Path

**Optimal first-hour crafting order**:
1. Wooden Pickaxe (mine stone)
2. Crafting Table (unlock 3×3 recipes)
3. Furnace (smelt ores)
4. Stone Pickaxe (mine iron)
5. Stone Axe (faster wood)
6. Torches (light caves while mining)
7. Iron Pickaxe (mine diamonds!)
8. Iron Sword (combat)
9. Shield (defense)
10. Chest (storage)

## Multi-Bot Crafting Scenarios

### Scenario 1: Division of Labor

```
# GräberBot mines ores
GräberBot: Mining 64 iron ore at coordinates (X, Y, Z)

# HandelBot collects and smelts
HandelBot:
1. read_bot_messages() → Get pickup coordinates
2. Navigate to mine
3. Collect 64 raw_iron
4. Return to base
5. smelt_item(item_name="raw_iron", count=64, fuel="coal")
6. send_bot_message("BauBot", "64 iron ingots smelted, ready for crafting", "normal")

# BauBot crafts tools
BauBot:
1. read_bot_messages() → Iron ingots available
2. craft_item(item_name="iron_pickaxe", count=5)
3. craft_item(item_name="iron_axe", count=3)
4. send_chat("Tool production complete: 5 pickaxes, 3 axes")
```

### Scenario 2: Emergency Tool Crafting

```
# SammelBot breaks pickaxe while mining
SammelBot:
1. check_inventory() → Verify materials: 3 iron, 2 sticks ✓
2. craft_item(item_name="iron_pickaxe", count=1)
3. send_chat("Crafted replacement pickaxe, resuming mining")

# OR if no materials:
SammelBot:
1. send_bot_message("BauBot", "URGENT: Need iron pickaxe, mine is at (X, Y, Z)", "high")
2. Wait at safe location
```

### Scenario 3: Mass Production

```
# Base needs 100 torches, 20 chests, 10 tools

HandelBot (coordinator):
1. send_bot_message("BauBot", "Craft 10 iron pickaxes", "normal")
2. send_bot_message("SammelBot", "Craft 100 torches", "normal")

BauBot:
1. smelt_item(item_name="raw_iron", count=30)  # 30 iron for 10 pickaxes
2. craft_item(item_name="iron_pickaxe", count=10)
3. send_bot_message("HandelBot", "10 pickaxes ready", "normal")

SammelBot:
1. craft_item(item_name="torch", count=100)
2. craft_item(item_name="chest", count=20)
3. send_bot_message("HandelBot", "Torches and chests ready", "normal")
```

## Common Crafting Recipes

### Tools (Tier Templates)

All tools follow same pattern, just different materials:

**Pickaxe** (mine stone/ore):
```
craft_item(item_name="<material>_pickaxe", count=1)
# Materials: wooden, stone, iron, diamond, netherite
# Recipe: 3 material + 2 sticks
```

**Axe** (chop wood fast):
```
craft_item(item_name="<material>_axe", count=1)
# Recipe: 3 material + 2 sticks
```

**Sword** (combat):
```
craft_item(item_name="<material>_sword", count=1)
# Recipe: 2 material + 1 stick
```

**Shovel** (dig dirt/sand/gravel):
```
craft_item(item_name="<material>_shovel", count=1)
# Recipe: 1 material + 2 sticks
```

**Hoe** (till farmland):
```
craft_item(item_name="<material>_hoe", count=1)
# Recipe: 2 material + 2 sticks
```

### Building Blocks

```
# Planks from logs
craft_item(item_name="oak_planks", count=64)
# Variants: spruce, birch, jungle, acacia, dark_oak

# Sticks from planks
craft_item(item_name="stick", count=64)

# Crafting table
craft_item(item_name="crafting_table", count=1)

# Furnace
craft_item(item_name="furnace", count=1)

# Chest (storage)
craft_item(item_name="chest", count=8)
```

### Utility Items

```
# Torches (light)
craft_item(item_name="torch", count=64)
# Requires coal/charcoal + sticks

# Bucket (water transport)
craft_item(item_name="bucket", count=3)
# Requires 3 iron ingots each

# Shears (sheep, leaves)
craft_item(item_name="shears", count=1)
# Requires 2 iron ingots

# Ladder (vertical movement)
craft_item(item_name="ladder", count=16)
# Requires 7 sticks

# Boat (water travel - very fast!)
craft_item(item_name="oak_boat", count=1)
# Requires 5 planks
```

## Troubleshooting

**"Cannot craft X - no recipe found"**:
- Item might be uncraftable (must find/mine)
- Check item name spelling (use underscores: "iron_pickaxe" not "iron pickaxe")
- Some items require special conditions (brewing, enchanting, etc.)

**"Error: Recipe requires a crafting table"**:
- Move within 32 blocks of crafting table
- Or place a new crafting table: `craft_item(item_name="crafting_table", count=1)`

**"Failed to craft - missing required materials"**:
- Run `check_inventory()` to see what you have
- Request materials: `send_bot_message("SammelBot", "Need 3 iron ingots", "normal")`
- Gather missing materials using mining/farming skills

**"No furnace found within 32 blocks"**:
- Move closer to furnace
- Or craft one: `craft_item(item_name="furnace", count=1)` and place it

**"No fuel found in inventory"**:
- Mine coal (Y < 64, common in caves)
- Or use wood/planks as fuel (less efficient)
- Or create charcoal: `smelt_item(item_name="oak_log", count=8, fuel="oak_planks")`

## Integration with Other Skills

- **Mining Skill**: Gather ores → smelt in furnaces → craft better tools
- **Tree Felling Skill**: Collect wood → craft planks/sticks → craft wooden tools
- **Building Skill**: Craft building blocks (stone, planks, glass) → construct structures
- **Farming Skill**: Craft hoes, shears → farm crops and animals
- **Combat Skill**: Craft swords, armor → defend against mobs
- **Trading Skill**: Craft items → trade with villagers or other bots

## Best Practices

✅ **Do:**
- Craft tools in increasing tier order (wood → stone → iron → diamond)
- Always craft a pickaxe FIRST when reaching new tier (unlocks next tier)
- Smelt ore in batches (more efficient)
- Keep backup tools in inventory or storage
- Use coal for fuel when smelting ores
- Check inventory before crafting to verify materials

❌ **Don't:**
- Don't craft wood/stone tools after getting iron (waste of materials)
- Don't use sticks as furnace fuel (very inefficient: 0.5 items per stick)
- Don't smelt one item at a time (slow and inefficient)
- Don't forget to craft a crafting table early (needed for most recipes)
- Don't craft items you don't need (inventory space is limited)

## Example Tasks

**Task: "Craft an iron pickaxe"**
```
1. check_inventory() → Verify: 3 iron ingots + 2 sticks
2. craft_item(item_name="iron_pickaxe", count=1)
3. send_chat("Crafted iron pickaxe, ready to mine diamonds!")
```

**Task: "Smelt all raw iron in inventory"**
```
1. check_inventory() → Count raw_iron
2. smelt_item(item_name="raw_iron", count=<amount>)  # Uses auto fuel selection
3. send_chat("Smelted <amount> iron ingots")
```

**Task: "Prepare for diamond mining expedition"**
```
1. craft_item(item_name="iron_pickaxe", count=3)  # Backups!
2. craft_item(item_name="iron_sword", count=1)  # Combat
3. craft_item(item_name="torch", count=64)  # Light caves
4. craft_item(item_name="ladder", count=32)  # Vertical movement
5. check_inventory() → Verify food supplies
6. send_chat("Ready for diamond mining: 3 pickaxes, sword, 64 torches")
```

**Task: "Set up furnace smelting station"**
```
1. craft_item(item_name="furnace", count=4)  # Multiple furnaces
2. Place furnaces in a row (using building skill)
3. smelt_item(item_name="raw_iron", count=64)  # Furnace 1
4. smelt_item(item_name="raw_gold", count=16)  # Furnace 2
5. smelt_item(item_name="cobblestone", count=64)  # Furnace 3
6. smelt_item(item_name="raw_beef", count=20)  # Furnace 4
7. send_chat("Smelting station operational: processing ores and food")
```

## When NOT to Use This Skill

- **For gathering materials** → Use mining, tree-felling, or farming skills
- **For placing crafted items** → Use building skill
- **For repairing tools** → Use anvil (separate mechanic, not covered)
- **For enchanting** → Use enchanting table (separate skill)
- **For brewing** → Use brewing stand (separate skill)

This skill is specifically for **crafting items** and **smelting in furnaces**.
