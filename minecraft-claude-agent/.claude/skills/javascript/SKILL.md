---
name: javascript
description: This skill should be used for ALL bot control. Write standard JavaScript (ES2023) with async/await. Provides goto() with SimplePathfinder, dig(), place(), craft(), container management, and world queries. Execute via craftscript_start, monitor via craftscript_status/logs.
allowed-tools: craftscript_start, craftscript_status, craftscript_cancel, craftscript_logs, get_vox, block_info, affordances, get_topography, send_chat, get_position, get_inventory, create_craftscript_function, edit_craftscript_function, list_craftscript_functions, get_craftscript_function, list_function_versions, delete_craftscript_function
---

# JavaScript Bot Control

Write **standard JavaScript (ES2023)** with async/await to control the Minecraft bot. This is real JavaScript - not a custom language. Features: world awareness, crafting, persistent custom functions.

## Quick Start

### 1. Scout → 2. Plan → 3. Execute

```javascript
// 1. Scout: Use read-only tools
const pos = await get_position();
const nearbyOre = find_blocks("iron_ore", 32, 10);

// 2. Plan: Check what's available
if (nearbyOre.length > 0 && has_item("iron_pickaxe")) {
  // 3. Execute: Run actions
  for (const orePos of nearbyOre) {
    await goto(orePos.x, orePos.y, orePos.z);
    await dig(orePos.x, orePos.y, orePos.z);
  }
  await pickup_blocks(8);
}
```

---

## Read-Only Scouting Tools

Use these MCP tools to gather information **before** writing scripts:

- `get_position()` → Current bot position { x, y, z }
- `get_inventory()` → All items with counts
- `get_vox(radius, grep?)` → Voxel data around bot
- `get_topography(radius)` → 2D height map
- `block_info({ x, y, z })` → Detailed block metadata
- `affordances({ x, y, z })` → Standability, placeable faces

---

## JavaScript API Reference

All action commands are **async functions** - always use `await`.

### 🚶 Movement & Navigation

```javascript
await goto(x, y, z)             // Navigate to EXACT position (default)
await look_at(x, y, z)          // Aim at coordinates
```

**Examples:**
```javascript
// Navigate to exact coordinates
await goto(100, 64, 50);

// Look at a block before interacting
await look_at(x, y, z);
await dig(x, y, z);
```

**Important:** goto() navigates to the EXACT position. Don't navigate TO a block you want to place - navigate NEXT to it!

### ⛏️ Block Interaction

```javascript
await dig(x, y, z)                          // Mine block (auto-equips best tool)
await place(blockId, x, y, z)               // Place block (finds reference block)
await build_up(blockId)                     // Jump and place block below (pillar jump)
await build_scaffolding(x, y, z, height)    // Build scaffolding tower at position
await equip(itemId)                         // Equip item to hand
```

**Examples:**
```javascript
// Dig a block
await dig(100, 64, 50);

// Place a torch
await place("torch", 100, 65, 50);

// Build up one block (pillar jump)
await build_up("dirt");

// Build scaffolding tower (for climbing)
await build_scaffolding(100, 64, 50, 10);  // 10-block tall scaffolding

// Equip a pickaxe
await equip("iron_pickaxe");
```

**Note:** `goto()` uses SimplePathfinder which supports climbing scaffolding and ladders. It will also drop down up to 3 blocks if safe.

### 💼 Inventory & Items

```javascript
await pickup_blocks(radius)     // Collect dropped items (default: 8 blocks)
await toss(itemId, count)       // Drop items (count optional)
```

**Examples:**
```javascript
// Pick up nearby items
await pickup_blocks(10);

// Drop 32 cobblestone
await toss("cobblestone", 32);

// Drop all dirt
while (has_item("dirt")) {
  await toss("dirt", 64);
}
```

### 📦 Container Management

```javascript
await open_container(x, y, z)   // Open chest/barrel/container
await deposit(itemId, count)    // Put items in (count optional)
await withdraw(itemId, count)   // Take items out (count optional)
await close_container()         // Close current container
```

**Examples:**
```javascript
// Store items in a chest
await open_container(100, 64, 50);
await deposit("cobblestone", 64);
await deposit("dirt");  // Deposits all
await close_container();

// Retrieve items from chest
await open_container(100, 64, 50);
await withdraw("iron_ingot", 10);
await close_container();
```

### 🔨 Crafting

```javascript
await craft(itemId, count, useCraftingTable)
  // count: items to craft (default: 1)
  // useCraftingTable: auto-find table within 32 blocks (default: false)
```

**Examples:**
```javascript
// Craft sticks (2x2 grid)
await craft("stick", 4);

// Craft pickaxe (needs crafting table)
await craft("iron_pickaxe", 1, true);

// Craft torches
if (has_item("coal") && has_item("stick")) {
  await craft("torch", 64);
}
```

### ⏰ Utilities

```javascript
await wait(ms)                  // Delay (max 300000ms = 5 minutes)
console.log(...args)            // Log to Console tab
```

**Script Timeout:** 5 minutes (300 seconds) maximum execution time.

---

## Query Functions (Read-Only, Instant)

### 🔍 Block Queries

```javascript
is_air(x, y, z)                 // Returns true if air
block_is(x, y, z, blockId)      // Returns true if matches
get_block(x, y, z)              // Returns { name, displayName, position, hardness, type }
find_blocks(blockId, maxDist, count)  // Returns array of {x,y,z} positions
can_see_block(x, y, z)          // Returns true if line-of-sight
```

**Examples:**
```javascript
// Check block type
if (block_is(100, 64, 50, "stone")) {
  await dig(100, 64, 50);
}

// Get block details
const block = get_block(100, 64, 50);
console.log(`Block: ${block.displayName}, hardness: ${block.hardness}`);

// Find nearest diamonds
const diamonds = find_blocks("diamond_ore", 64, 5);
for (const pos of diamonds) {
  console.log(`Diamond at ${pos.x}, ${pos.y}, ${pos.z}`);
}
```

### 👥 Entity Queries

```javascript
get_nearest_entity(type?)       // Find closest entity (optional type filter)
get_entities(type?, maxDist)    // Get all entities (default 32 blocks)
get_players()                   // Get all visible players
```

**Examples:**
```javascript
// Find nearest mob
const mob = get_nearest_entity("zombie");
if (mob && mob.distance < 10) {
  console.log("Zombie nearby at", mob.position);
}

// Find all sheep within 50 blocks
const sheep = get_entities("sheep", 50);
console.log(`Found ${sheep.length} sheep`);

// Check for nearby players
const players = get_players();
if (players.length > 0) {
  console.log(`Players nearby: ${players.map(p => p.username).join(', ')}`);
}
```

### 🎒 Inventory & Recipe Queries

```javascript
has_item(itemId)                // Returns true if in inventory
get_recipes(itemId)             // Returns array of recipes
can_craft(itemId, count?)       // Returns true if craftable now
```

**Examples:**
```javascript
// Check inventory before acting
if (has_item("iron_pickaxe")) {
  await equip("iron_pickaxe");
  await dig(x, y, z);
}

// Check crafting options
if (can_craft("iron_pickaxe")) {
  await craft("iron_pickaxe", 1, true);
} else {
  console.log("Missing materials for iron pickaxe");
  const recipes = get_recipes("iron_pickaxe");
  console.log("Recipe:", recipes[0]);
}
```

---

## Control Flow & Patterns

### Conditionals

```javascript
// Check before digging
if (!is_air(x, y, z)) {
  await dig(x, y, z);
}

// Conditional crafting
if (has_item("coal") && has_item("stick")) {
  await craft("torch", 16);
}
```

### Loops

```javascript
// Mine a row
for (let x = 100; x < 110; x++) {
  if (!is_air(x, 64, 50)) {
    await dig(x, 64, 50);
  }
}

// Mine until inventory full
const blocks = find_blocks("iron_ore", 64, 100);
for (const pos of blocks) {
  await goto(pos.x, pos.y, pos.z);
  await dig(pos.x, pos.y, pos.z);
}
await pickup_blocks(10);
```

### Error Handling

```javascript
try {
  await goto(x, y, z);
  await dig(x, y, z);
} catch (error) {
  console.log("Operation failed:", error.message);
  // Fallback behavior
}
```

---

## Custom Reusable Functions 🎯

Create persistent, versioned functions for common patterns!

### Creating Functions

Use the `create_craftscript_function` tool:

```javascript
create_craftscript_function({
  name: "mine_vein",
  description: "Mine all connected ore blocks of same type",
  args: [
    { name: "ore_type", type: "string" },
    { name: "start_x", type: "int" },
    { name: "start_y", type: "int" },
    { name: "start_z", type: "int" }
  ],
  body: `
    const mined = new Set();
    const queue = [[start_x, start_y, start_z]];

    while (queue.length > 0 && mined.size < 50) {
      const [x, y, z] = queue.shift();
      const key = \`\${x},\${y},\${z}\`;

      if (mined.has(key)) continue;
      if (!block_is(x, y, z, ore_type)) continue;

      await goto(x, y, z);
      await dig(x, y, z);
      mined.add(key);

      // Check adjacent blocks
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dy === 0 && dz === 0) continue;
            queue.push([x + dx, y + dy, z + dz]);
          }
        }
      }
    }

    console.log(\`Mined \${mined.size} \${ore_type} blocks\`);
    await pickup_blocks(10);
  `
});
```

### Using Custom Functions

Functions auto-load in all scripts:

```javascript
// Find and mine iron veins
const ores = find_blocks("iron_ore", 32, 10);
for (const ore of ores) {
  await mine_vein("iron_ore", ore.x, ore.y, ore.z);
}
```

### More Function Examples

**Safe building helper:**
```javascript
create_craftscript_function({
  name: "safe_place",
  description: "Place block only if space is empty",
  args: [
    { name: "block_id", type: "string" },
    { name: "x", type: "int" },
    { name: "y", type: "int" },
    { name: "z", type: "int" }
  ],
  body: `
    if (is_air(x, y, z) && has_item(block_id)) {
      await place(block_id, x, y, z);
      return true;
    }
    return false;
  `
});
```

**Inventory management:**
```javascript
create_craftscript_function({
  name: "store_items",
  description: "Store specified items in nearest chest",
  args: [
    { name: "item_id", type: "string" },
    { name: "keep_count", type: "int", optional: true, default: 0 }
  ],
  body: `
    if (!has_item(item_id)) return;

    // Find nearest chest
    const chests = find_blocks("chest", 32, 1);
    if (chests.length === 0) {
      console.log("No chest found nearby");
      return;
    }

    const chest = chests[0];
    await goto(chest.x, chest.y, chest.z);
    await open_container(chest.x, chest.y, chest.z);

    // Deposit all except keep_count
    await deposit(item_id);
    if (keep_count > 0) {
      await withdraw(item_id, keep_count);
    }

    await close_container();
    console.log(\`Stored \${item_id}, kept \${keep_count}\`);
  `
});
```

### Function Features

- 📦 **Persistent**: Saved in database, available across sessions
- 🔄 **Versioned**: Full edit history with rollback
- ✅ **Type-safe**: Args validated (int, bool, string)
- 📊 **Logged**: Calls shown in Console with 📦 icon
- 🔒 **Scoped**: Each bot has its own functions
- 🧩 **Composable**: Can call other functions and bot commands
- ⏱️ **Timeout**: 30 seconds per function call

### Managing Functions

```javascript
list_craftscript_functions()    // See all your functions
edit_craftscript_function({     // Update function (new version)
  name: "mine_vein",
  body: "...",
  change_summary: "Added max limit check"
})
get_craftscript_function({ name: "mine_vein" })
list_function_versions({ name: "mine_vein" })
delete_craftscript_function({ name: "mine_vein" })
```

---

## Practical Examples

### Example 1: Auto-Mining with Tool Crafting

```javascript
// Find iron ore and mine it, crafting tools as needed
const ores = find_blocks("iron_ore", 64, 50);
console.log(`Found ${ores.length} iron ore blocks`);

for (const ore of ores) {
  // Check tool durability, craft new one if needed
  if (!has_item("iron_pickaxe")) {
    if (can_craft("iron_pickaxe")) {
      await craft("iron_pickaxe", 1, true);
      console.log("Crafted new pickaxe");
    } else {
      console.log("No pickaxe available, stopping");
      break;
    }
  }

  await goto(ore.x, ore.y, ore.z);
  await dig(ore.x, ore.y, ore.z);
}

await pickup_blocks(10);
```

### Example 2: Smart Chest Organization

```javascript
// Store all mined items, keeping tools
const chestPos = { x: 100, y: 64, z: 50 };

await goto(chestPos.x, chestPos.y, chestPos.z);
await open_container(chestPos.x, chestPos.y, chestPos.z);

// Deposit ores and cobblestone
const depositable = ["cobblestone", "iron_ore", "coal", "dirt"];
for (const item of depositable) {
  if (has_item(item)) {
    await deposit(item);
  }
}

await close_container();
console.log("Items stored in chest");
```

### Example 3: Building with Awareness

```javascript
// Build a platform, checking each block first
const buildY = 64;
const size = 5;

for (let x = 0; x < size; x++) {
  for (let z = 0; z < size; z++) {
    const worldX = 100 + x;
    const worldZ = 50 + z;

    // Only place if empty
    if (is_air(worldX, buildY, worldZ)) {
      await goto(worldX, buildY, worldZ);
      await place("stone", worldX, buildY, worldZ);
    }
  }
}

console.log(`Built ${size}x${size} platform`);
```

### Example 4: Building a Tower (Pillar Jump)

```javascript
// Build a vertical tower using build_up
const targetHeight = 10; // blocks to climb
const blockType = "dirt";

console.log(`Building ${targetHeight}-block tower with ${blockType}`);

// Check we have enough blocks
const dirtItem = bot.inventory.items().find(i => i.name === blockType);
if (!dirtItem || dirtItem.count < targetHeight) {
  console.log(`Need ${targetHeight} ${blockType}, only have ${dirtItem?.count || 0}`);
} else {
  const startY = bot.entity.position.y;

  for (let i = 0; i < targetHeight; i++) {
    await build_up(blockType);
    const currentHeight = Math.floor(bot.entity.position.y - startY);
    console.log(`Height: ${currentHeight}/${targetHeight}`);
  }

  console.log(`Reached height ${Math.floor(bot.entity.position.y - startY)}!`);
}
```

### Example 5: Vertical Navigation with Pathfinder

```javascript
// Navigate to higher ground - pathfinder handles the climb
const hillTop = { x: 150, y: 80, z: 200 };
console.log(`Navigating to hilltop at y=${hillTop.y}`);

await goto(hillTop.x, hillTop.y, hillTop.z);
console.log("Reached hilltop!");

// Do something at the top...
await place("banner", hillTop.x, hillTop.y, hillTop.z);

// Navigate back down - pathfinder automatically drops down (up to 8 blocks)
const groundLevel = { x: 145, y: 64, z: 195 };
console.log("Returning to ground level...");

await goto(groundLevel.x, groundLevel.y, groundLevel.z);
console.log("Back on ground!");

// Note: Pathfinder can drop up to 8 blocks safely
// For taller structures, use build_up() or stairs
```

---

## Best Practices

### ✅ DO:
- Scout with read-only tools before executing
- Use world coordinates (absolute x, y, z)
- Check inventory before crafting/placing
- Handle errors with try/catch
- Log progress with console.log()
- Create custom functions for repeated patterns
- Use queries to make informed decisions

### ❌ DON'T:
- Use `nav` or `nearest` tools (use JavaScript instead)
- Assume commands succeed (always check/handle errors)
- Create giant monolithic scripts (break into small steps)
- Ignore inventory state (check with has_item())
- Forget to pickup items after mining

---

## Available Globals

**Actions:** goto, look_at, dig, place, build_up, build_scaffolding, equip, pickup_blocks, toss, open_container, deposit, withdraw, close_container, craft, wait

**Queries:** is_air, block_is, get_block, find_blocks, can_see_block, get_nearest_entity, get_entities, get_players, has_item, get_recipes, can_craft

**Custom:** Your bot's custom functions (auto-loaded)

**Standard JS:** Math, JSON, Array, Object, String, Number, Date, Promise, console.log(), setTimeout, setInterval

**Disabled:** eval, Function, require, process, global

---

## Debugging & Monitoring

### Console Tab
All script output appears in the **Console tab** with:
- 📦 Custom function calls
- 🚶 Movement logs
- ⛏️ Block interactions
- 🔨 Crafting operations
- ✓/✗ Success/failure indicators
- Expandable details with positions, inventory changes

### Logging Tips
```javascript
// Log important state
console.log("Starting mining operation");
console.log(`Inventory: ${has_item("iron_pickaxe") ? "Has pickaxe" : "No pickaxe"}`);

// Log progress in loops
for (let i = 0; i < blocks.length; i++) {
  console.log(`Mining block ${i+1}/${blocks.length}`);
  await dig(blocks[i].x, blocks[i].y, blocks[i].z);
}

// Log decisions
if (ores.length > 0) {
  console.log(`Found ${ores.length} ores, starting mining`);
} else {
  console.log("No ores found, stopping");
}
```

---

**Remember**: Scout → Plan → Execute. Use queries to understand the world, then take precise actions with confidence!
