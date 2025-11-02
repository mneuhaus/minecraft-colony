# Starter Shelter - Phase 1 Essential

A Phase 1 starter shelter provides **basic survival infrastructure**: safe spawn point (bed), crafting station, smelting capability, and storage.

## Requirements

### Minimum Viable Shelter (Phase 1 Complete)
- **Bed** - Sets spawn point, skips night
- **Crafting Table** - 3x3 crafting grid for tools/items
- **Furnace** - Smelt ores, cook food
- **Chest** - Centralized storage for colony resources

### Optional Enhancements
- **Torches** - Prevent mob spawning (need coal/charcoal)
- **Door** - Controlled entry (6 planks)
- **Walls/Roof** - Weather protection and mob barrier

## Material Requirements

### Absolute Minimum (Furnishings Only)
```
Bed: 3 wool + 3 planks
Crafting Table: 4 planks
Furnace: 8 cobblestone
Chest: 8 planks
TOTAL: 15 planks + 3 wool + 8 cobblestone
```

### With Simple 5x5x3 Structure
```
Floor (5x5): 25 blocks (dirt/cobblestone/planks)
Walls (4 sides, 3 high, minus door): ~50 blocks
Roof (5x5): 25 blocks
Door: 6 planks
Furnishings: 15 planks + 3 wool + 8 cobblestone
TOTAL: ~100 blocks + 21 planks + 3 wool + 8 cobblestone
```

## Build Strategy

### Option A: Furnishings First (Fastest to Phase 1 Complete)
**Use this when:** You have materials ready and need immediate functionality.

```
1. Find/clear flat 3x3 space
2. Craft & place crafting table at (X, Y, Z)
3. Craft & place furnace at (X+1, Y, Z)
4. Craft & place chest at (X+2, Y, Z)
5. Craft & place bed at (X, Y, Z+1)
6. DONE - Phase 1 shelter complete!
```

**Advantages:**
- Operational in 5 minutes
- Can sleep through night immediately
- Can craft/smelt/store right away
- Walls optional (add later)

**Disadvantages:**
- No mob protection
- No weather protection
- Items exposed to other players

### Option B: Structure First, Then Furnishings
**Use this when:** You want proper protection and have time/materials.

```
1. Clear & flatten 5x5 area
2. Build floor platform (5x5, Y=64)
3. Build 4 walls (leave 2-block door gap on south side)
4. Build roof (5x5, Y=67)
5. Place door in gap
6. Place furnishings inside:
   - Crafting table: Southwest corner (X, Y+1, Z)
   - Furnace: Next to crafting table (X+1, Y+1, Z)
   - Chest: Against north wall (X+2, Y+1, Z+3)
   - Bed: Against east wall (X+3, Y+1, Z+1)
7. Add torches if coal/charcoal available
```

**Advantages:**
- Full mob protection
- Weather protection
- Organized layout
- Professional appearance

**Disadvantages:**
- Takes 30-60 minutes
- Requires more materials
- Needs more tools (shovel, axe)

## Placement Strategy

### Finding a Good Location

**Use detect_biome and scan_biomes_in_area:**
```
Ideal biome characteristics:
- Flat terrain (plains, savanna) = less terraforming
- Trees nearby = wood supply
- Water nearby = fishing, farming potential
- Avoid: deep ocean, mountain peaks, desert (hard to build)
```

**Use get_nearby_blocks to assess site:**
```
Good signs:
- Mostly grass_block, dirt = flat, buildable
- Few stone blocks = minimal clearing needed
- No water/lava = safe foundation

Bad signs:
- Lots of stone = steep terrain
- Water blocks nearby = flooding risk
- Gravel/sand = unstable, falls when mined
```

### Layout Planning (5x5 Interior)

```
     N
     ↑
W ← [5x5] → E
     ↓
     S

Coordinates example (if SW corner = 100, 64, 100):
- Floor: X=100-104, Y=64, Z=100-104
- Walls: Y=65-66 (2 blocks high + roof)
- Door: South wall, center (X=102, Y=65, Z=100)

Interior furnishings:
  Z=104 [Chest] [    ] [    ] [    ] [    ]
  Z=103 [     ] [    ] [    ] [    ] [    ]
  Z=102 [     ] [    ] [    ] [    ] [Bed]
  Z=101 [     ] [    ] [    ] [    ] [Bed]
  Z=100 [Craft][Furn] [Door] [    ] [    ]
        X=100  X=101  X=102  X=103  X=104
```

## Tool-Based Workflow

### Step 1: Site Selection
```
1. get_position() → note current location
2. detect_biome() → confirm biome suitability
3. get_nearby_blocks(radius=10) → check terrain flatness
4. scan_biomes_in_area(radius=50) → confirm no better spots nearby
5. Decision: Build here or scout better location?
```

### Step 2: Material Verification
```
1. list_inventory() → check materials
2. find_item("planks") → need 15+ for furnishings (21+ with door)
3. find_item("cobblestone") → need 8 for furnace
4. find_item("wool") → need 3 for bed
5. If insufficient: gather more OR scale down (Option A)
```

### Step 3: Site Preparation
```
1. move_to_position(build_x, build_y, build_z, range=1)
2. get_nearby_blocks(radius=5) → identify obstructions
3. For each obstruction (tree, tall grass):
   break_block_and_wait(x, y, z) → clear & collect
4. Verify flat 5x5 area clear
```

### Step 4A: Furnishings-Only Build (Option A)
```
1. craft_item("crafting_table", 1)
2. place_block(X, Y, Z, "crafting_table")
3. craft_item("furnace", 1) → uses crafting table
4. place_block(X+1, Y, Z, "furnace")
5. craft_item("chest", 1)
6. place_block(X+2, Y, Z, "chest")
7. craft_item("bed", 1) → requires wool
8. place_block(X, Y, Z+1, "bed")
9. send_chat("Phase 1 shelter complete! Bed, crafting, furnace, chest operational.")
```

### Step 4B: Full Structure Build (Option B)
```
# Floor
for x in range(X, X+5):
  for z in range(Z, Z+5):
    place_block(x, Y, z, "cobblestone")

# Walls (skip door gap at Z=100, X=102)
for wall_y in [Y+1, Y+2]:
  # North wall (Z=104)
  for x in range(X, X+5):
    place_block(x, wall_y, Z+4, "planks")

  # South wall (Z=100), leave door gap
  for x in [X, X+1, X+3, X+4]:  # Skip X+2 for door
    place_block(x, wall_y, Z, "planks")

  # East wall (X=104)
  for z in range(Z+1, Z+4):
    place_block(X+4, wall_y, z, "planks")

  # West wall (X=100)
  for z in range(Z+1, Z+4):
    place_block(X, wall_y, z, "planks")

# Roof (Y+3)
for x in range(X, X+5):
  for z in range(Z, Z+5):
    place_block(x, Y+3, z, "planks")

# Door
craft_item("door", 1)
place_block(X+2, Y+1, Z, "oak_door")

# Furnishings (same as Option A, but inside)
place_block(X, Y+1, Z, "crafting_table")
place_block(X+1, Y+1, Z, "furnace")
place_block(X+2, Y+1, Z+4, "chest")
place_block(X+3, Y+1, Z+1, "bed")

send_chat("Full shelter complete with furnishings!")
```

## Success Verification

After building, verify Phase 1 completion:

```
1. get_block_info(crafting_table_x, y, z) → confirm "crafting_table"
2. get_block_info(furnace_x, y, z) → confirm "furnace"
3. get_block_info(chest_x, y, z) → confirm "chest"
4. get_block_info(bed_x, y, z) → confirm "bed"
5. list_inventory() → check remaining materials
6. send_chat("Phase 1 shelter verified. All 4 essentials placed and operational.")
```

## Common Mistakes

### 1. Wrong Bed Placement Height
```
❌ WRONG: place_block(X, Y, Z, "bed") → places bed INSIDE floor block
✅ RIGHT: place_block(X, Y+1, Z, "bed") → places bed ON TOP of floor
```

### 2. Door Gap Too Small
```
❌ WRONG: 1-block door gap → player can't enter
✅ RIGHT: 2-block high door gap (Y+1 and Y+2 clear)
```

### 3. Forgetting to Craft First
```
❌ WRONG: place_block(x, y, z, "crafting_table") → fails, item not in inventory
✅ RIGHT: craft_item("crafting_table") THEN place_block(...)
```

### 4. Insufficient Wool for Bed
```
Wool sources:
- Sheep: find_entity("mob"), look for sheep, shear_sheep (need shears = 2 iron)
- String: Kill spiders (3 string = 1 wool via crafting)
- Alternative: Sleep on ground (dangerous) until wool acquired
```

## Multi-Bot Coordination

For faster shelter construction, assign roles:

```
SammelBot: Gather 21 planks + 8 cobblestone + 3 wool
BauBot: Clear site + build structure
HandelBot: Craft & place furnishings

Workflow:
1. SammelBot: send_bot_message("BauBot", "Gathering materials, ETA 10 min", "normal")
2. BauBot: Clear site, wait for materials
3. SammelBot: deposit_items(chest_x, chest_y, chest_z, "planks", 21)
4. SammelBot: send_bot_message("BauBot", "Materials delivered to chest", "high")
5. BauBot: withdraw_items(chest_x, chest_y, chest_z, "planks", 21)
6. BauBot: Build structure
7. HandelBot: Craft furnishings using BauBot's materials
8. All: send_chat("Shelter complete! Team effort!")
```

## Upgrade Path (Post-Phase 1)

Once Phase 1 complete, enhance shelter:

```
Phase 1.5 (Security):
- Add torches (coal from mining)
- Add second chest (organization)
- Add crafting area lighting

Phase 2 (Functionality):
- Expand to 7x7 (more storage)
- Add furnace array (2-4 furnaces)
- Add anvil (tool repair)
- Add enchanting table (requires diamonds)

Phase 3 (Aesthetics):
- Windows (glass panes)
- Improved materials (stone bricks, not cobblestone)
- Decorative blocks (carpet, paintings)
- Farm plot outside
```

## Estimated Time & Resources

### Option A (Furnishings Only)
- **Time**: 5-10 minutes
- **Materials**: 15 planks + 3 wool + 8 cobblestone
- **Tools needed**: Axe (for planks), pickaxe (for cobblestone)
- **Result**: Functional, no protection

### Option B (Full Structure)
- **Time**: 30-60 minutes (single bot)
- **Time**: 15-30 minutes (2-3 bots coordinated)
- **Materials**: ~100 blocks + 21 planks + 3 wool + 8 cobblestone
- **Tools needed**: Axe, pickaxe, shovel
- **Result**: Protected, professional

## When to Build Shelter

**Immediate Priority (Day 1):**
- If night approaching and no bed → Option A (crafting table + bed minimum)
- If mobs nearby → Find existing structure or dig 3-deep hole temporarily

**Standard Priority (Days 2-3):**
- Option B (full structure) once materials gathered
- Coordinate with SammelBot for material supply

**Deferred (Days 4+):**
- If using existing structure (village house, abandoned mineshaft)
- If focusing on different Phase 1 task (tree farm, mining)

## Phase 1 Completion Criteria

Shelter satisfies Phase 1 when:
- ✅ Bed placed and functional (can set spawn, sleep)
- ✅ Crafting table placed (can craft tools)
- ✅ Furnace placed (can smelt ores)
- ✅ Chest placed (can store items)

Walls/roof/door optional but recommended for Phase 1.5.
