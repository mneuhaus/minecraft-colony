---
name: crafting
description: This skill should be used for crafting tools, items, and equipment using JavaScript. Covers the craft() function for 2x2 and 3x3 recipes, tool tier progression, and recipe queries.
allowed-tools: get_position, get_status, get_inventory, craftscript_start, craftscript_status, craftscript_logs
---

# Crafting Skill – Item Creation via JavaScript

Use JavaScript executed via `craftscript_start(script)` for all crafting operations.

## JavaScript Commands

### Recipe Queries (instant, read-only)
```javascript
get_recipes("iron_pickaxe");            // Get available recipes for item
can_craft("iron_pickaxe", 1);           // Check if craftable with current inventory
has_item("iron_ingot");                 // Check inventory for materials
```

### Crafting Operations
```javascript
await craft("stick", 4);                // Craft using 2x2 inventory grid
await craft("iron_pickaxe", 1, true);   // Craft using 3x3 crafting table
```

### Position & Finding Crafting Tables
```javascript
get_position();                         // Get your position { x, y, z, exact }
find_blocks("crafting_table", 32, 1);   // Find nearby crafting tables (sorted by distance)
find_nearest_block("crafting_table", 32); // Find single nearest table { x, y, z, distance }
await goto(x, y, z);                    // Navigate to crafting table
```

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

**Step 1: Wood Tools**
```javascript
// Punch logs first (use dig() on oak_log), then craft planks
await craft("oak_planks", 16);

// Craft crafting table
await craft("crafting_table", 1);

// Place crafting table (using place() command)
await place("crafting_table", x, y, z);

// Craft sticks
await craft("stick", 8);

// Craft wooden pickaxe (PRIORITY!) - needs crafting table
await craft("wooden_pickaxe", 1, true);

// Craft wooden axe (faster wood gathering)
await craft("wooden_axe", 1, true);
```

**Step 2: Stone Tools**
```javascript
// After mining 11+ cobblestone with wooden pickaxe:

// Craft furnace (3x3 recipe)
await craft("furnace", 1, true);

// Craft stone pickaxe IMMEDIATELY
await craft("stone_pickaxe", 1, true);

// Craft stone tools
await craft("stone_axe", 1, true);
await craft("stone_sword", 1, true);
await craft("stone_shovel", 1, true);
```

**Step 3: Iron Tools**
```javascript
// After smelting iron ore in furnace:

// Craft iron pickaxe FIRST (unlock diamonds!)
await craft("iron_pickaxe", 1, true);

// Continue iron tool progression
await craft("iron_sword", 1, true);
await craft("iron_axe", 1, true);
await craft("iron_shovel", 1, true);
```

### 2. Bulk Crafting

When crafting multiple items:
```javascript
// Craft 16 torches at once
await craft("torch", 16);

// Craft multiple tools for backup
await craft("iron_pickaxe", 3, true);

// Craft building materials
await craft("oak_planks", 64);
await craft("stick", 32);
```

**Benefits**:
- Saves time (one function call vs many)
- Efficient material usage
- Better for mass production

### 3. Smelting Note

**Important**: Smelting is not yet available as a JavaScript command. To smelt ores:
1. Find or craft a furnace: `await craft("furnace", 1, true)`
2. Place the furnace: `await place("furnace", x, y, z)`
3. Manually interact with furnace (future feature)

For now, focus on crafting recipes that don't require smelted materials, or pre-smelt materials manually.

### 4. Essential Crafting Recipes

**Survival Essentials**:
```javascript
// Torches (light, prevent mob spawns) - 1 coal + 1 stick each
await craft("torch", 64);

// Chest (storage) - 8 planks each
await craft("chest", 8, true);

// Bed (skip night, set spawn) - 3 wool + 3 planks
await craft("white_bed", 1, true);

// Bucket (water transport) - 3 iron ingots each
await craft("bucket", 3, true);
```

**Tool Maintenance**:
```javascript
// Always have backup tools!
await craft("iron_pickaxe", 2, true);

// Check if you can craft replacement
if (can_craft("iron_pickaxe", 1)) {
  await craft("iron_pickaxe", 1, true);
}
```

## Advanced Crafting Techniques

### Crafting Table Proximity

The `craft()` command with `true` as third parameter automatically finds nearby crafting tables:
- Searches within 32 blocks
- Uses closest available table
- Fails if no crafting table found for 3x3 recipes

**Best Practice**:
```javascript
// Find crafting table
const tables = find_blocks("crafting_table", 32, 1);
if (tables.length === 0) {
  // Place one if you have it
  if (has_item("crafting_table")) {
    const pos = bot.entity.position;
    await place("crafting_table", pos.x + 1, pos.y, pos.z);
  }
}
```

### Material Preparation

Before crafting, verify materials via MCP tools:
```javascript
// Check if craftable (uses inventory check)
if (can_craft("iron_pickaxe", 1)) {
  await craft("iron_pickaxe", 1, true);
} else {
  console.log("Missing materials for iron pickaxe");
}

// Check specific items
if (has_item("iron_ingot") && has_item("stick")) {
  await craft("iron_sword", 1, true);
}
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

## Common Crafting Recipes

### Tools (Tier Templates)

All tools follow same pattern, just different materials:

```javascript
// Pickaxe (mine stone/ore) - 3 material + 2 sticks
await craft("wooden_pickaxe", 1, true);  // or stone_, iron_, diamond_
await craft("stone_pickaxe", 1, true);
await craft("iron_pickaxe", 1, true);
await craft("diamond_pickaxe", 1, true);

// Axe (chop wood) - 3 material + 2 sticks
await craft("iron_axe", 1, true);

// Sword (combat) - 2 material + 1 stick
await craft("iron_sword", 1, true);

// Shovel (dig dirt/sand) - 1 material + 2 sticks
await craft("iron_shovel", 1, true);

// Hoe (till farmland) - 2 material + 2 sticks
await craft("iron_hoe", 1, true);
```

### Building Blocks

```javascript
// Planks from logs (2x2)
await craft("oak_planks", 64);  // spruce, birch, jungle, acacia, dark_oak

// Sticks from planks (2x2)
await craft("stick", 64);

// Crafting table - 4 planks (2x2)
await craft("crafting_table", 1);

// Furnace - 8 cobblestone (3x3)
await craft("furnace", 1, true);

// Chest - 8 planks (3x3)
await craft("chest", 8, true);
```

### Utility Items

```javascript
// Torches - coal/charcoal + sticks
await craft("torch", 64);

// Bucket - 3 iron ingots (3x3)
await craft("bucket", 3, true);

// Shears - 2 iron ingots (2x2)
await craft("shears", 1);

// Ladder - 7 sticks (3x3)
await craft("ladder", 16, true);

// Boat - 5 planks (3x3)
await craft("oak_boat", 1, true);
```

## Troubleshooting

**"Cannot craft X - no recipe found"**:
- Check item name spelling (use underscores: `"iron_pickaxe"` not `"iron pickaxe"`)
- Use `get_recipes("item_name")` to see available recipes
- Some items require special conditions (brewing, enchanting, etc.)

**"Crafting failed - no crafting table nearby"**:
- Pass `true` as third parameter only for 3x3 recipes
- Find table: `find_blocks("crafting_table", 32, 1)`
- Place one: `await place("crafting_table", x, y, z)`

**"Missing required materials"**:
- Use `can_craft("item_name", 1)` to check before crafting
- Use `has_item("iron_ingot")` to check specific items
- Gather missing materials using mining/farming skills

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
- Keep backup tools in inventory or storage
- Use `can_craft()` before crafting to verify materials
- Place crafting table near work areas (mine entrance, base, etc.)

❌ **Don't:**
- Don't craft wood/stone tools after getting iron (waste of materials)
- Don't forget to craft a crafting table early (needed for most recipes)
- Don't craft items you don't need (inventory space is limited)
- Don't forget the third parameter `true` for 3x3 recipes

## Example Tasks

**Task: "Craft an iron pickaxe"**
```javascript
// First check if we have materials
if (can_craft("iron_pickaxe", 1)) {
  await craft("iron_pickaxe", 1, true);
  console.log("Crafted iron pickaxe, ready to mine diamonds!");
} else {
  console.log("Need 3 iron ingots + 2 sticks");
}
```

**Task: "Prepare for diamond mining expedition"**
```javascript
// Craft backup tools and supplies
await craft("iron_pickaxe", 3, true);  // Backups!
await craft("iron_sword", 1, true);    // Combat
await craft("torch", 64);               // Light caves
await craft("ladder", 32, true);        // Vertical movement

console.log("Ready for diamond mining: 3 pickaxes, sword, 64 torches");
```

**Task: "Quick crafting session"**
```javascript
// Craft planks from logs
await craft("oak_planks", 32);

// Craft sticks
await craft("stick", 16);

// Craft torches
await craft("torch", 32);

// Craft storage
await craft("chest", 4, true);

console.log("Basic supplies crafted!");
```

## When NOT to Use This Skill

- **For gathering materials** → Use mining, tree-felling, or farming skills
- **For placing crafted items** → Use building skill
- **For repairing tools** → Use anvil (separate mechanic, not covered)
- **For enchanting** → Use enchanting table (separate skill)
- **For brewing** → Use brewing stand (separate skill)

This skill is specifically for **crafting items** and **smelting in furnaces**.
