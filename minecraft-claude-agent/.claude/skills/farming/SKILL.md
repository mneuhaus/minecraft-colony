---
name: farming
description: Plant and harvest crops, breed animals, and manage renewable food sources. Complete farming toolkit including tilling soil, breeding animals, collecting wool, milking cows, and using bone meal to accelerate growth.
allowed-tools: get_position, move_to_position, look_at, list_inventory, find_item, find_entity, dig_block, break_block_and_wait, place_block, collect_nearby_items, find_plantable_ground, place_sapling, wait_for_saplings, send_chat, send_bot_message, till_soil, feed_entity, shear_sheep, milk_cow, use_bone_meal
---

# Farming Skill – Sustainable Resource Production

This skill teaches you how to farm crops, breed animals, and create renewable resource systems.

## Available Tools

### Movement & Navigation
- **get_position()** – know your current coordinates.
- **move_to_position(x, y, z, range)** – navigate to farm location.
- **look_at(x, y, z)** – face blocks/animals you're interacting with.

### Inventory & Items
- **list_inventory()** – check for seeds, food, and tools.
- **find_item(name)** – locate specific items like seeds, wheat, carrots.
- **collect_nearby_items(item_types, radius)** – gather harvested items.

### Block Interaction
- **dig_block(x, y, z)** – harvest crops quickly.
- **break_block_and_wait(x, y, z)** – harvest and ensure item collection.
- **place_block(x, y, z, block_type)** – place farmland, crops, or fences.
- **till_soil(x, y, z)** – convert dirt/grass to farmland (requires hoe in inventory).

### Entity Interaction
- **find_entity(entityType, maxDistance)** – locate animals (cow, pig, sheep, chicken).
- **feed_entity(entity_type, food_item, max_distance)** – feed animals to breed them or speed up baby growth.
- **shear_sheep(max_distance)** – shear sheep to collect 1-3 wool blocks (requires shears in inventory).
- **milk_cow(max_distance)** – milk cows to get milk buckets (requires empty bucket in inventory).
- **use_bone_meal(x, y, z)** – use bone meal on crops/plants to accelerate growth.

### Tree Farming
- **find_plantable_ground(x, y, z, radius)** – find suitable dirt for planting trees.
- **place_sapling(x, y, z, sapling_type)** – plant tree saplings.
- **wait_for_saplings(seconds)** – wait for saplings to potentially grow.

### Communication
- **send_chat(message)** – communicate farming status.
- **send_bot_message(recipient, message, priority)** – coordinate with other bots.

## Crop Farming

### 1. Crop Types and Requirements

| Crop | Seed Item | Growth Time | Water Needed | Light Level | Notes |
|---|---|---|---|---|---|
| **Wheat** | wheat_seeds | 8 stages (~10-30 min) | Yes (4 blocks) | 9+ | Breeds cows, sheep. Makes bread |
| **Carrots** | carrot | 8 stages (~10-30 min) | Yes (4 blocks) | 9+ | Breeds pigs. Edible raw |
| **Potatoes** | potato | 8 stages (~10-30 min) | Yes (4 blocks) | 9+ | Edible when baked |
| **Beetroot** | beetroot_seeds | 4 stages (~10-30 min) | Yes (4 blocks) | 9+ | Makes red dye and soup |
| **Melon** | melon_seeds | Stem + fruit growth | Yes (4 blocks) | 9+ | Fruit grows adjacent to stem |
| **Pumpkin** | pumpkin_seeds | Stem + fruit growth | Yes (4 blocks) | 9+ | Fruit grows adjacent to stem |
| **Sugar Cane** | sugar_cane | Grows 3 blocks tall | Water adjacent | Any | Grows on sand/dirt next to water |
| **Cactus** | cactus | Grows 3 blocks tall | No water | Any | Only grows on sand |

### 2. Creating a Crop Farm

**Step 1: Prepare Farmland**
```
1. Find flat dirt/grass area near water source
2. Create a 9x9 grid with water in the center:
   - Place water block at center (x, y, z)
   - Farmland can be within 4 blocks of water
3. Till the dirt to create farmland:
   a) Ensure you have a hoe: list_inventory() → find_item("wooden_hoe") or any hoe
   b) For each dirt/grass block in your 9x9 grid:
      - till_soil(block_x, block_y, block_z)
      - This converts dirt/grass → farmland
   c) Farmland will stay hydrated if within 4 blocks of water

   Alternative (Creative mode):
   - Use place_block(x, y, z, "farmland") to place farmland directly
```

**Example - Tilling a 3x3 Farm**:
```
# Assuming center water at (100, 64, 200)
# Till surrounding 8 blocks
till_soil(99, 64, 199)   # Northwest
till_soil(100, 64, 199)  # North
till_soil(101, 64, 199)  # Northeast
till_soil(99, 64, 200)   # West
# (100, 64, 200) is water
till_soil(101, 64, 200)  # East
till_soil(99, 64, 201)   # Southwest
till_soil(100, 64, 201)  # South
till_soil(101, 64, 201)  # Southeast
```

**Step 2: Plant Seeds**
```
1. Check inventory: list_inventory()
2. Confirm you have seeds: find_item("wheat_seeds")
3. For each farmland block:
   - Stand next to it
   - look_at(farmland_x, farmland_y, farmland_z)
   - place_block(farmland_x, farmland_y+1, farmland_z, "wheat")
   - Note: This places the crop on top of farmland
4. Repeat for all farmland blocks
```

**Step 3: Wait for Growth**
```
- Crops grow through 8 stages (wheat, carrots, potatoes)
- Growth requires:
  - Light level 9+ (torches or sunlight)
  - Farmland within 4 blocks of water
  - Time (10-30 minutes real-time)
- Bone meal can accelerate growth (not yet implemented in tools)
```

**Step 4: Harvest Crops**
```
1. Identify fully grown crops (stage 7/7):
   - Wheat: Golden/tan color
   - Carrots/Potatoes: Visible vegetables on plant
2. For each mature crop:
   - Stand next to it
   - break_block_and_wait(crop_x, crop_y, crop_z)
   - collect_nearby_items(["wheat", "wheat_seeds"], 3)
3. Save some drops for replanting:
   - Wheat: Drops wheat + seeds (replant seeds)
   - Carrots/Potatoes: Drop more carrots/potatoes (replant 1)
```

**Step 5: Replant**
```
1. After harvesting, farmland remains
2. Place new seeds/crops on the farmland
3. Repeat cycle
```

### 3. Special Crops

**Sugar Cane Farming:**
```
- Grows on dirt/grass/sand adjacent to water
- Grows up to 3 blocks tall
- Harvest from top down (leave bottom block to regrow)
- No replanting needed
- Example:
  1. Find sugar cane near water
  2. break_block_and_wait(x, y+2, z) # Top block
  3. break_block_and_wait(x, y+1, z) # Middle block
  4. Leave bottom block (y) intact
  5. Will regrow over time
```

**Cactus Farming:**
```
- Only grows on sand
- Damages entities that touch it
- Grows up to 3 blocks tall
- Harvest from top down (leave bottom block)
- Place with 1 block gap around it (will break if blocks touch sides)
```

**Melon/Pumpkin Farming:**
```
- Plant seeds on farmland
- Stem grows first (4 stages)
- Fruit spawns on adjacent dirt/grass blocks
- Harvest fruit (breaks into slices/whole pumpkin)
- Stem remains and produces more fruit over time
```

### 4. Farming Tips

**Efficient Farm Layout:**
```
9x9 farm with water in center:
  W W W W W W W W W
  W W W W W W W W W
  W W W W W W W W W
  W W W W W W W W W
  W W W W # W W W W  # = Water block
  W W W W W W W W W  W = Wheat/crops
  W W W W W W W W W
  W W W W W W W W W
  W W W W W W W W W

Total: 80 farmland blocks per water source
```

**Lighting:**
- Place torches every 8 blocks to maintain light level 9+
- Prevents mob spawning
- Allows crops to grow at night

**Inventory Management:**
- Keep enough seeds for replanting (at least 64)
- Store excess wheat/carrots/potatoes in chests
- Stack torches for lighting (64 per stack)

## Animal Farming (Breeding & Food)

### 1. Animal Types and Requirements

| Animal | Found | Breeding Item | Products | Notes |
|---|---|---|---|---|
| **Cow** | Grass plains | wheat | Leather, raw beef | Can milk with bucket |
| **Pig** | Grass plains | carrot/potato/beetroot | Raw porkchop | Ride with saddle + carrot on stick |
| **Sheep** | Grass plains | wheat | Wool (shear), mutton | Wool regrows if sheep eats grass |
| **Chicken** | Grass plains | seeds (wheat/melon/pumpkin/beetroot) | Feathers, raw chicken, eggs | Lays eggs periodically |
| **Rabbit** | Various biomes | carrot/golden carrot/dandelion | Rabbit hide, raw rabbit | Fast, hard to catch |
| **Horse** | Plains/savanna | golden apple/golden carrot | Transportation | Tame first, then breed |

### 2. Breeding Workflow

**Step 1: Locate Animals**
```
1. Use find_entity("cow", maxDistance=30)
   - Returns: List of cows with positions and distances
2. Choose two nearby animals of the same type
3. Navigate to them: move_to_position(cow_x, cow_y, cow_z, range=3)
```

**Step 2: Feed Animals (Breeding Mode)**
```
1. Ensure you have the correct breeding item in inventory:
   - Cows/Sheep: wheat
   - Pigs: carrot, potato, or beetroot
   - Chickens: wheat_seeds, beetroot_seeds, melon_seeds, or pumpkin_seeds
   - Horses: golden_apple or golden_carrot

2. Feed first animal:
   feed_entity(entity_type="cow", food_item="wheat", max_distance=16)
   → Animal enters "love mode" (hearts appear)

3. Feed second nearby animal of same type:
   feed_entity(entity_type="cow", food_item="wheat", max_distance=16)
   → Second animal enters "love mode"

4. Animals will approach each other and produce a baby
5. Baby grows to adult in 20 minutes real-time
6. Can speed up baby growth by feeding it more breeding food
```

**Example - Breeding Two Cows**:
```
# Step 1: Find cows
find_entity("cow", 30) → Returns list of nearby cows

# Step 2: Check you have wheat
list_inventory() → Verify wheat available

# Step 3: Feed first cow
feed_entity(entity_type="cow", food_item="wheat")
→ "Successfully fed cow with wheat. Animal should enter love mode (hearts)"

# Step 4: Feed second cow nearby
feed_entity(entity_type="cow", food_item="wheat")
→ "Successfully fed cow with wheat. Animal should enter love mode (hearts)"

# Step 5: Wait for breeding
# The two cows will move toward each other and produce a baby calf
# Baby will be smaller and grow over 20 minutes
```

**Step 3: Build Animal Pens**
```
- Use building skill to create fenced enclosure
- Minimum 5x5 area per pair of animals
- Use fence blocks (can't jump over)
- Add gate for entry/exit
- Keep animals contained for easy breeding
```

### 3. Animal Products

**Milking Cows:**
- Requires bucket (not yet implemented in tools)
- Right-click cow with bucket → milk bucket
- Used for: cake, cookies, potions

**Shearing Sheep:**
- Requires shears (not yet implemented in tools)
- Right-click sheep with shears → 1-3 wool
- Wool regrows when sheep eats grass

**Egg Collection:**
- Chickens lay eggs periodically
- Eggs drop as items on ground
- Use collect_nearby_items(["egg"], 5)
- Eggs can be thrown or used in recipes

## Tree Farming (Renewable Wood)

### 1. Tree Farm Setup

**Using Existing Tools:**
```
1. Find suitable planting area:
   myPos = get_position()  # Get current location
   grounds = find_plantable_ground(myPos.x, myPos.y, myPos.z, radius=10)

2. Select best locations from results (sorted by distance)

3. Plant saplings:
   place_sapling(x, y, z, "oak_sapling")
   - Types: oak, spruce, birch, jungle, acacia, dark_oak

4. Wait for growth:
   wait_for_saplings(300)  # Wait 5 minutes
   - Trees require light level 9+
   - Need 1-2 block vertical clearance (oak/birch: 6, spruce: 8, jungle: 10+)
   - Growth is random (can take 1-30 minutes)

5. Harvest when grown using tree-felling skill
```

**Spacing for Tree Farms:**
```
Oak/Birch: 5x5 spacing (tree + clearance)
Spruce: 5x5 spacing
Jungle: 2x2 saplings for large tree, or 5x5 for small
Dark Oak: Must be 2x2 saplings
```

### 2. Automated Tree Farming

**Simple Cycle:**
```
1. Plant saplings in grid pattern
2. wait_for_saplings(600) # Check every 10 minutes
3. Use tree-felling skill to harvest grown trees
4. Replant saplings from drops
5. Repeat

Example:
- Plant 16 oak saplings in 4x4 grid (spaced 5 blocks apart)
- Wait 10 minutes
- Harvest any that grew
- Replant immediately
- Continuous wood supply
```

## Farming Coordination with Other Bots

### Example: Wheat Farm Operation

**SammelBot (Farmer) Tasks:**
```
1. Plant wheat seeds across 80 farmland blocks
2. Wait 20 minutes for growth
3. Harvest mature wheat
4. Replant seeds
5. Notify HandelBot when wheat is available:
   send_bot_message("HandelBot", "Harvested 128 wheat, available for trade", "normal")
```

**HandelBot (Trader) Tasks:**
```
1. Receive message from SammelBot
2. Coordinate pickup:
   send_bot_message("SammelBot", "Meeting at farm for wheat pickup", "normal")
3. Navigate to farm
4. Receive wheat via trading skill
5. Distribute to other bots or store
```

**BauBot (Builder) Tasks:**
```
1. Build animal pens using building skill:
   - 10x10 fence enclosure
   - Gates for access
   - Lighting (torches)
2. Notify SammelBot when ready:
   send_bot_message("SammelBot", "Animal pen ready at (200, 64, 150)", "normal")
```

## Limitations & Workarounds

### Current Tool Limitations

**Not Yet Implemented:**
- ❌ Tilling dirt to create farmland (requires hoe)
- ❌ Feeding animals for breeding
- ❌ Shearing sheep for wool
- ❌ Milking cows for milk
- ❌ Using bone meal to accelerate crop growth
- ❌ Detecting crop growth stage programmatically

**Workarounds:**
- Manual tilling: Ask user to till farmland, then bot plants seeds
- Creative mode: Use `place_block(x, y, z, "farmland")` directly
- Animal breeding: Ask user to breed manually, bot manages pens
- Focus on crops that drop items (wheat, carrots, potatoes)

### Future Tool Ideas

To enable full farming automation, these tools would be helpful:
```
- till_soil(x, y, z): Convert dirt to farmland
- feed_entity(entityId, itemName): Feed animals for breeding
- shear_sheep(entityId): Shear sheep for wool
- milk_cow(entityId): Milk cow with bucket
- use_bone_meal(x, y, z): Accelerate crop growth
- get_block_state(x, y, z): Check crop growth stage
```

## Example Farming Tasks

**Task: "Create a wheat farm"**
```
1. Find 9x9 flat area near water
2. If in creative: place_block(center_x, y, center_z, "water")
3. Inform user: "Please till the 80 blocks around the water"
4. Wait for user confirmation
5. Check inventory for wheat_seeds: find_item("wheat_seeds")
6. Plant seeds on all 80 farmland blocks
7. Place torches every 8 blocks for lighting
8. send_chat("Wheat farm established, will harvest in 20 minutes")
9. Wait ~20 minutes
10. Harvest mature wheat using break_block_and_wait
11. Collect drops: collect_nearby_items(["wheat", "wheat_seeds"], 3)
12. Replant seeds
13. send_chat("Harvested X wheat, farm replanted")
```

**Task: "Build an animal pen and locate cows"**
```
1. Use building skill to create 10x10 fence enclosure
2. Add fence gates
3. Place torches for lighting
4. Search for cows: find_entity("cow", maxDistance=100)
5. Report findings: send_chat("Found 3 cows at (X, Y, Z), (X2, Y2, Z2), (X3, Y3, Z3)")
6. Inform user: "Please lead cows into pen and breed them with wheat"
7. Monitor pen periodically
```

**Task: "Plant a tree farm"**
```
1. Get position: myPos = get_position()
2. Find planting spots: find_plantable_ground(myPos.x, myPos.y, myPos.z, 20)
3. Select 16 locations in grid pattern (5 blocks apart)
4. Check for saplings: find_item("oak_sapling")
5. Plant each sapling: place_sapling(x, y, z, "oak_sapling")
6. send_chat("Planted 16 oak saplings, checking growth in 10 minutes")
7. wait_for_saplings(600)
8. Check for grown trees (they'll be visible as full trees)
9. Harvest using tree-felling skill
10. Replant saplings from drops
```

## When NOT to Use This Skill

- **If you need wood immediately** → Use tree-felling skill on existing trees
- **If you need minerals/stone** → Use mining skill instead
- **If you need to build** → Use building skill instead
- **For instant food** → Hunt animals or find natural crops first

## Best Practices

✅ **Do:**
- Maintain seed reserves (at least 64 per crop type)
- Light farms to prevent mob spawning
- Plant near water sources for efficiency
- Space tree farms correctly for growth
- Replant immediately after harvesting

❌ **Don't:**
- Plant crops on non-farmland (they'll break)
- Forget to light farms (crops won't grow in darkness)
- Harvest before crops are mature (lower yields)
- Plant trees too close together (won't grow)
- Let animals despawn (keep them in pens)
