# Stone Gathering - Phase 2 Essential Resource

## Overview
Stone gathering is critical for early-game progression. Stone allows crafting stone tools (5x durability of wood), furnaces, and basic building blocks. This skill teaches efficient stone acquisition from surface deposits.

## Prerequisites
- Wooden pickaxe (craft from: 3 planks + 2 sticks)
- Empty inventory space (stone stacks to 64)
- Awareness of fall dangers near cliffs

## Available Tools
- **find_stone(radius?, stone_types?)** - Locate accessible stone deposits (surface, cliff, cave)
- **get_position()** - Know current location
- **move_to_position(x, y, z, range)** - Navigate to deposit
- **list_inventory()** - Check pickaxe and space
- **find_item(name)** - Verify pickaxe in inventory
- **equip_item(name, destination="hand")** - Equip pickaxe
- **dig_block(x, y, z)** or **break_block_and_wait(x, y, z)** - Mine stone
- **collect_nearby_items(item_types, radius)** - Pick up cobblestone drops
- **send_chat(message)** - Report progress

## Stone Gathering Workflow

### Phase 1: Preparation
1. **Check for pickaxe**
   - `list_inventory()` - look for wooden_pickaxe (or better)
   - If no pickaxe: craft one first (requires crafting table, planks, sticks)
   - Stone REQUIRES pickaxe - cannot be mined by hand!

2. **Equip pickaxe**
   - `find_item("pickaxe")` - locate any pickaxe type
   - `equip_item("wooden_pickaxe", "hand")` - ready for mining

3. **Check inventory space**
   - Need at least 5-10 empty slots
   - Stone drops as "cobblestone" (stacks to 64)
   - Each stone block → 1 cobblestone

### Phase 2: Locate Stone Deposit
1. **Find accessible stone**
   - `find_stone(radius=32)` - search within 32 blocks
   - Returns sorted list: surface, cliff, cave deposits
   - Prioritize **surface** deposits (safest, easiest access)

2. **Assess options**
   - Surface: Ideal - flat ground, no fall risk
   - Cliff: Moderate - watch for edges, potential fall damage
   - Cave: Risky - may have mobs, darkness, multiple levels

3. **Select target deposit**
   - Choose nearest **surface** deposit if available
   - If only cliff/cave: proceed with caution
   - Note coordinates and estimated yield

### Phase 3: Navigate to Deposit
1. **Move to mining location**
   - `move_to_position(x, y, z, range=1)` - get within reach
   - Range 1 = right next to stone block

2. **Position safely**
   - For cliff deposits: stay back from edge
   - For cave deposits: ensure lighting (place torches if available)
   - `get_position()` - confirm safe position

### Phase 4: Mine Stone
1. **Mine blocks systematically**
   - Start from top layer if multi-layer deposit
   - Work downward to avoid blocks falling on you (if sand/gravel nearby)
   - Use `dig_block(x, y, z)` for each block
   - Alternative: `break_block_and_wait(x, y, z)` if you need to ensure drops spawn

2. **Mining pattern for clusters**
   ```
   Horizontal layer approach:
   1. Mine front row (3-5 blocks)
   2. Step forward
   3. Mine next row
   4. Collect drops periodically (don't let cobblestone despawn after 5 min)
   ```

3. **Monitor pickaxe durability**
   - Wooden pickaxe: 59 uses
   - Stone blocks count toward durability
   - If pickaxe breaks mid-mining, craft replacement before continuing

### Phase 5: Collection
1. **Gather cobblestone drops**
   - `collect_nearby_items(item_types=["cobblestone"], radius=10)`
   - Stone blocks drop as "cobblestone" items
   - Drops spawn at block location, may scatter slightly

2. **Verify yield**
   - `list_inventory()` - count cobblestone collected
   - Compare to estimated yield from find_stone
   - If short, search area for missed drops

### Phase 6: Return and Craft
1. **Navigate back to base/crafting area**
   - `move_to_position(base_x, base_y, base_z)` - return home
   - Or navigate to waypoint if set

2. **Immediate crafting priorities**
   - Furnace (8 cobblestone) - essential for smelting
   - Stone pickaxe (3 cobblestone + 2 sticks) - better than wood
   - Stone axe (3 cobblestone + 2 sticks) - faster tree felling
   - Stone sword (2 cobblestone + 1 stick) - basic defense

3. **Report completion**
   - `send_chat("Collected [X] cobblestone. Crafted furnace and stone tools.")`

## Common Patterns

### Small Surface Deposit (10-15 blocks)
- Quick operation (2-3 minutes)
- Ideal for first stone acquisition
- Enough for furnace + 1-2 stone tools

### Cliff Face (20-40 blocks)
- Moderate operation (5-7 minutes)
- Watch for fall damage
- May require building safety platforms
- Good for large stone needs

### Cave Entrance (30-80 blocks)
- Longer operation (8-12 minutes)
- Requires lighting (torches)
- Potential mob encounters
- Best for bulk stone gathering

## Safety Considerations

### Fall Damage
- Cliff mining: stay 2+ blocks from edge
- Don't mine block you're standing on (unless safe ground below)
- Build cobblestone platform if mining cliff side

### Tool Durability
- Wooden pickaxe: 59 uses total
- Track blocks mined (rough count)
- Craft stone pickaxe ASAP (165 uses - much better)

### Mob Awareness
- Cave mining: place torches every 5 blocks
- Listen for mob sounds (hiss = creeper danger!)
- Retreat if low health

### Don't Get Stuck
- Cave mining: leave breadcrumb trail (cobblestone pillars, torches)
- Mark cave entrance coordinates
- Keep escape route clear

## Efficiency Tips

### Prioritize Upgrades
1. First 8 cobblestone → furnace
2. Next 5 cobblestone → stone pickaxe (3) + extra (2)
3. Continue mining with stone pickaxe (3x faster, better durability)

### Batch Mining
- Don't mine 8 cobblestone and return
- Mine 30-60 cobblestone in one trip
- Enough for all basic stone tools + building blocks

### Combine with Exploration
- SpähBot: scout for stone deposits during exploration
- Mark large deposits as waypoints
- Share coordinates with mining bot (GräberBot)

## Tool Comparison

| Tool | Durability | Speed | Can Mine Stone? |
|------|------------|-------|-----------------|
| Bare hands | ∞ | VERY SLOW | ❌ NO |
| Wooden pickaxe | 59 uses | Slow | ✅ YES |
| Stone pickaxe | 131 uses | Medium | ✅ YES |
| Iron pickaxe | 250 uses | Fast | ✅ YES + ores |

**Key insight**: Upgrade to stone pickaxe immediately after first 8 cobblestone!

## Crafting Recipes

### Furnace (8 cobblestone)
```
[cobble] [cobble] [cobble]
[cobble]  [empty] [cobble]
[cobble] [cobble] [cobble]
```

### Stone Pickaxe (3 cobblestone + 2 sticks)
```
[cobble] [cobble] [cobble]
 [empty]  [stick]  [empty]
 [empty]  [stick]  [empty]
```

### Stone Axe (3 cobblestone + 2 sticks)
```
[cobble] [cobble] [empty]
[cobble]  [stick]  [empty]
 [empty]  [stick]  [empty]
```

### Stone Sword (2 cobblestone + 1 stick)
```
 [empty] [cobble]  [empty]
 [empty] [cobble]  [empty]
 [empty]  [stick]  [empty]
```

## Multi-Bot Coordination

### Scenario: Efficient Stone Acquisition
1. **SpähBot** (Exploration Bot)
   - Scouts area, finds large stone deposit
   - Creates waypoint: "StoneDeposit1"
   - `send_bot_message("GräberBot", "Found 40-block stone deposit at (250, 64, -120)", "normal")`

2. **GräberBot** (Mining Bot)
   - Receives message automatically
   - Navigates to coordinates
   - Mines 60 cobblestone
   - Returns to base

3. **HandelBot** (Trading Bot)
   - Receives drop-off request
   - Meets GräberBot at base
   - Receives cobblestone via trading skill

4. **BauBot** (Building Bot)
   - Uses cobblestone for construction projects

## When to Use This Skill
- Need cobblestone for furnace (first priority!)
- Need cobblestone for stone tools
- Need cobblestone for building projects
- Transitioning from Phase 1 (wood) to Phase 2 (stone tools)

## When NOT to Use This Skill
- Already have 200+ cobblestone stockpiled
- Need ores (iron, coal) → use mining skill instead
- Need smooth stone → gather cobblestone, then smelt in furnace
- Deep underground mining → requires different strategy (not Phase 2)

## Success Metrics
- ✅ Collected 30+ cobblestone in one trip
- ✅ Crafted furnace from collected stone
- ✅ Crafted stone pickaxe (immediate upgrade)
- ✅ No fall damage or deaths during mining
- ✅ Pickaxe durability tracked and managed

## Example Scenario

**Goal**: Acquire first stone for furnace + tools

1. `craft_item("wooden_pickaxe", count=1)` → craft pickaxe
2. `equip_item("wooden_pickaxe", "hand")` → ready tool
3. `find_stone(radius=32)` → "Found 3 deposits. Nearest: stone (surface) at (125, 64, 95), cluster ~15 blocks, yield ~10 blocks, 18 blocks away"
4. `move_to_position(125, 64, 95, range=1)` → navigate to deposit
5. `dig_block(125, 64, 95)` → mine first block
6. (Repeat dig_block for adjacent blocks: 10 blocks total)
7. `collect_nearby_items(item_types=["cobblestone"], radius=10)` → gather drops
8. `list_inventory()` → "10 cobblestone collected"
9. `move_to_position(base_x, base_y, base_z)` → return home
10. `craft_item("furnace", count=1)` → use 8 cobblestone
11. `craft_item("stone_pickaxe", count=1)` → use remaining 2 + get more
12. `send_chat("Furnace and stone pickaxe crafted! Phase 2 tools ready.")` → report success

---

**Phase 2 Milestone**: With furnace + stone tools, bot can now progress to iron tools and Phase 3!
