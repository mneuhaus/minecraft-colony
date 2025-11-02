---
name: tree-felling
description: Efficiently fell trees in Minecraft, handling different tree types (oak, spruce mega trees, acacia), managing height, preventing floating logs, and replanting. Use when gathering wood or managing forests.
allowed-tools: find_trees, get_tree_structure, check_reachable, break_block_and_wait, collect_nearby_items, wait_for_saplings, find_plantable_ground, place_sapling, build_pillar, descend_pillar_safely, move_to_position, get_position, list_inventory
---

# Tree Felling - Atomic Tools Approach

This skill teaches you HOW to fell trees using atomic tools. Each tool does ONE thing and returns data for YOU to make decisions.

## Available Atomic Tools

### Discovery & Analysis
- **find_trees(radius, types)** - Find all trees, get list with positions/heights/types sorted by distance
- **get_tree_structure(x, y, z)** - Analyze specific tree: 1x1 vs 2x2, height, log positions, leaf count

### Reachability & Navigation
- **check_reachable(x, y, z)** - Can you reach this block? Do you need scaffolding?
- **move_to_position(x, y, z)** - Walk to coordinates
- **build_pillar(height)** - Jump-place blocks beneath to rise
- **descend_pillar_safely()** - Break blocks beneath to descend

### Harvesting & Collection
- **break_block_and_wait(x, y, z)** - Break block and wait for item drops to spawn
- **collect_nearby_items(types, radius)** - Collect dropped item entities
- **wait_for_saplings(x, y, z, timeout)** - Wait for leaves to decay and saplings to drop

### Replanting
- **find_plantable_ground(x, y, z, radius)** - Find suitable dirt/grass for saplings
- **place_sapling(x, y, z, sapling_type)** - Place sapling with validation (checks dirt/grass, light, space)

## Decision-Making Strategy

You make ALL decisions. Tools only provide data and execute simple actions.

### Step 1: Find Trees (Decision: Which tree to fell?)

```
Call: find_trees(50)
Returns: "Found 14 trees. Nearest:
1. oak at (120, 64, 131), height ~7 blocks, ~7 logs, 4 blocks away
2. spruce at (124, 64, 132), height ~15 blocks (MEGA 2x2), ~60 logs, 8 blocks away
..."

YOUR DECISION:
- Close tree? (save travel time)
- High yield? (more logs per effort)
- Easy type? (1x1 is simpler than 2x2)

Example: Choose #1 (oak) - close, simple 1x1, good yield
```

### Step 2: Analyze Tree Structure (Decision: How to fell it?)

```
Call: get_tree_structure(120, 64, 131)
Returns: "OAK tree at (120, 64, 131):
- Base: 1x1 single trunk [(120,64,131)]
- Total logs: 7
- Height: Y=64 to Y=70 (7 blocks tall)
- Highest log: (120, 70, 131)"

YOUR DECISIONS:
- 7 blocks tall = medium height
- Single trunk = simple bottom-up OR top-down
- Highest block at Y=70, I'm at Y=64 = +6 blocks up
```

### Step 3: Check Reachability (Decision: Do I need a pillar?)

```
Call: check_reachable(120, 70, 131)  # Check highest log
Returns: "Block at (120, 70, 131):
- Can reach: NO
- Distance: 6.1 blocks vertical
- Needs scaffolding: YES
- Recommendation: Build pillar 3 blocks high to reach"

YOUR DECISION:
- Top block unreachable from ground
- Options:
  A) Build pillar to top, fell top-down
  B) Fell bottom-up until can't reach, then pillar

Choose: B (more efficient - only pillar if needed)
```

### Step 4: Fell Tree Bottom-Up

```
# Start at base
Call: move_to_position(120, 64, 131, range=3)

# Break base log and wait for drop
Call: break_block_and_wait(120, 64, 131)
Returns: "Broke oak_log at (120, 64, 131). Item drop should now be spawned."

# Move up, break next
Call: break_block_and_wait(120, 65, 131)
Call: break_block_and_wait(120, 66, 131)
Call: break_block_and_wait(120, 67, 131)

# Check if can reach Y=68
Call: check_reachable(120, 68, 131)
Returns: "Can reach: NO, needs scaffolding"

YOUR DECISION: Need to build pillar now
```

### Step 5: Build Pillar for High Blocks

```
Call: build_pillar(3)  # Rise 3 blocks
Returns: "Built pillar to Y=67 (+3 blocks). Used 3x dirt."

# Now can reach remaining logs
Call: break_block_and_wait(120, 68, 131)
Call: break_block_and_wait(120, 69, 131)
Call: break_block_and_wait(120, 70, 131)  # Top log

# Descend safely
Call: descend_pillar_safely()
Returns: "Descended safely to Y=64. Broke 3 blocks."
```

### Step 6: Collect Logs

```
Call: collect_nearby_items(["oak_log"], 10)
Returns: "Collected: 7x oak_log. Time taken: 3.2 seconds."
```

### Step 7: Wait for Saplings

```
Call: wait_for_saplings(120, 64, 131, 30)
Returns: "Waited 18 seconds. All leaves decayed (42 total). Found 2 new saplings in inventory."
```

### Step 8: Collect Saplings

```
Call: collect_nearby_items(["oak_sapling"], 10)
Returns: "Collected: 2x oak_sapling, 1x stick. Time taken: 2.1 seconds."
```

### Step 9: Find Replanting Location

```
Call: find_plantable_ground(120, 64, 131, 10)
Returns: "Found 8 plantable spots. Nearest:
1. grass_block at (120, 64, 131), light 12, 15 blocks air above, 0 blocks away [GOOD]
..."

YOUR DECISION: Original location (120, 64, 131) is perfect
```

### Step 10: Replant Sapling

```
Call: place_sapling(120, 65, 131, "oak_sapling")  # Y+1 because placing ON TOP of grass
Returns: "Successfully placed oak_sapling at (120, 65, 131)"
```

## Handling Different Tree Types

### Mega Trees (2x2 Spruce/Jungle/Dark Oak)

When `get_tree_structure` returns "MEGA 2x2":

```
Base blocks: [(120,64,131), (121,64,131), (120,64,132), (121,64,132)]
```

**YOUR STRATEGY**:
1. Fell logs at ALL 4 positions at each height
2. Build pillar (mega trees are tall, 15-30 blocks)
3. Top-down is easier for mega trees
4. Replant requires 4 saplings in 2x2 pattern

**Example Felling Loop** (for each Y-level):
```
for Y in range(70, 64, -1):  # Top to bottom
    break_block_and_wait(120, Y, 131)
    break_block_and_wait(121, Y, 131)
    break_block_and_wait(120, Y, 132)
    break_block_and_wait(121, Y, 132)
```

### Branching Trees (Acacia)

Acacia logs can be diagonal. Use `get_tree_structure` to see ALL log positions, then dig each one.

## Complete Example Workflow

```
GOAL: Gather 20 oak logs

1. find_trees(50, ["oak"])
   → Choose nearest oak

2. get_tree_structure(x, y, z)
   → Learn height, positions

3. Loop through logs bottom-up:
   FOR each log position:
     check_reachable(log_x, log_y, log_z)
     IF not reachable:
       build_pillar(needed_height)
     break_block_and_wait(log_x, log_y, log_z)

4. IF built pillar:
     descend_pillar_safely()

5. collect_nearby_items(["oak_log"])

6. wait_for_saplings(base_x, base_y, base_z)

7. collect_nearby_items(["oak_sapling"])

8. find_plantable_ground(base_x, base_y, base_z)
   → Choose best spot

9. place_sapling(spot_x, spot_y+1, spot_z, "oak_sapling")

10. REPEAT until have 20 logs
```

## Key Principles

1. **You decide everything** - Tools only report data and do actions
2. **Check before acting** - Use check_reachable before trying to dig high blocks
3. **No floating logs** - Always clear entire tree to ground level
4. **Always replant** - Sustainable forestry prevents deforestation
5. **Batch operations** - Fell multiple trees, then replant all at once for efficiency

## Common Decision Points

### "Should I build a pillar?"
- Call check_reachable on highest log
- If "needs scaffolding: YES" → build pillar
- If "can reach: YES" → no pillar needed

### "Which tree should I fell?"
- Close distance = less travel time
- High yield = more logs per tree
- Simple type (1x1) = easier than mega (2x2)
- Balance these factors based on goal

### "How high should I build the pillar?"
- check_reachable tells you: "Build pillar X blocks high"
- Add 1-2 extra blocks for safety margin

### "When do I stop waiting for saplings?"
- wait_for_saplings has timeout (default 30 seconds)
- If "all leaves decayed" → safe to move on
- If "timed out" → manually collect or wait longer

## Error Recovery

**If tree felling fails mid-way:**
1. get_tree_structure again to see remaining logs
2. Use find_block to locate floating logs
3. check_reachable to see if you can reach them
4. build_pillar if needed to finish job

**If sapling collection fails:**
1. wait_for_saplings may timeout
2. Try collect_nearby_items manually
3. Check list_inventory to see if you have any saplings
4. Can replant even with 0 saplings (just won't regrow)

## Tools Cheat Sheet

| Task | Tool | Returns |
|------|------|---------|
| Find trees nearby | `find_trees(radius)` | List of trees with positions/heights |
| Analyze one tree | `get_tree_structure(x,y,z)` | Base type, height, all log positions |
| Can I reach block? | `check_reachable(x,y,z)` | Yes/No + recommendations |
| Break one log | `break_block_and_wait(x,y,z)` | Success/failure |
| Rise up | `build_pillar(height)` | Final height, blocks used |
| Come down | `descend_pillar_safely()` | Final position, blocks broken |
| Get logs/saplings | `collect_nearby_items(types)` | What collected, what missed |
| Wait for decay | `wait_for_saplings(x,y,z)` | Saplings found, leaves remaining |
| Find planting spot | `find_plantable_ground(x,y,z)` | Suitable locations sorted by distance |
| Plant sapling | `place_sapling(x,y+1,z, "oak_sapling")` | Success/failure |
