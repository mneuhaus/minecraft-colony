# Acacia Trees

## Overview
Acacia trees are distinctive, branching trees found in savanna biomes. They have a unique angular, twisted appearance with multiple branches. Acacia is one of the more challenging trees to fell due to its irregular branching pattern.

## Tree Characteristics

### Standard Acacia Trees (1x1 only)
- **Base pattern**: Single acacia_log at ground level
- **Height**: 5-8 blocks total (varies with branches)
- **Trunk**: Short (2-3 blocks), then branches diagonally
- **Branches**: YES - 2-4 diagonal branches at 45° angles
- **Canopy**: Flat-topped, umbrella-like
- **Difficulty**: MEDIUM - branching requires careful navigation
- **No mega variant**: Acacia does NOT have 2x2 mega trees

## Identification

### Visual Cues
- **Orange-gray bark**: Distinctive reddish-brown/gray striped texture
- **Angular shape**: Branches extend diagonally, not vertically
- **Flat canopy**: Wide, umbrella-shaped leaf platform
- **Savanna biomes**: Only spawn in savanna and savanna plateau
- **Twisted appearance**: No straight vertical trunk beyond base

### Check Base Pattern
```yaml
Position (x, y, z):
  Check: (x, y, z)  # Single acacia_log

If only 1 acacia_log at base: ACACIA TREE (always 1x1)
```

## Felling Strategy

### Phase 1: Assessment
1. **Identify branching pattern**
   - Use `get_tree_structure(x, y, z)` to see full tree
   - Acacia branches start at height 2-4
   - Branches extend diagonally (not straight up)
   - Typical pattern: 1 trunk + 2-4 diagonal branches

2. **Estimate log count**
   - Trunk: 2-3 logs (vertical portion)
   - Branches: 1-2 logs each, 2-4 branches total
   - **Total yield**: 6-12 acacia logs per tree

### Phase 2: Trunk Removal
1. **Break base logs first**
   - Start at ground level (x, y, z)
   - Break upward until branches start (usually 2-3 blocks)
   - Use `break_block_and_wait(x, y, z)` for each trunk log

### Phase 3: Branch Removal
This is the challenging part - branches extend diagonally!

**Understanding Diagonal Branches:**
```
Acacia branch patterns (top-down view):
     [leaf]
    /     \
[branch] [trunk] [branch]
    \     /
     [leaf]

Each branch extends 1-2 blocks at 45° angle from trunk
```

**Branch removal strategy:**
1. **Circle the tree**
   - Move around trunk base in cardinal directions (N, S, E, W)
   - Look for acacia_log blocks extending diagonally

2. **Break each branch**
   - Use `check_reachable(x, y, z)` for each branch log
   - If reachable: `break_block_and_wait(x, y, z)`
   - If not reachable: move closer or pillar up 1-2 blocks

3. **Scan for missed logs**
   - Acacia branches can be at offsets like (x+1, y+3, z+1)
   - Check all adjacent positions at branch height
   - Use `find_block("acacia_log", max_distance=10)` to find any floating logs

### Phase 4: Collection & Replanting
1. **Collect logs**
   - `collect_nearby_items(item_types=["acacia_log"], radius=10)`
   - Acacia logs scatter more due to diagonal branches
   - Expect 6-12 logs

2. **Wait for leaf decay**
   - `wait_for_saplings(x, y, z, timeout=40)`
   - Flat canopy takes longer to decay (more leaves)

3. **Collect saplings**
   - `collect_nearby_items(item_types=["acacia_sapling"], radius=12)`
   - Expect 1-3 saplings

4. **Replant**
   - `place_sapling(x, y, z, "acacia_sapling")`

## Branch Removal Patterns

### Typical Acacia Branch Positions
Assuming trunk base at (x=100, y=64, z=100):

**Trunk logs** (vertical):
- (100, 64, 100) - base
- (100, 65, 100) - middle
- (100, 66, 100) - top of trunk

**Branch logs** (diagonal from trunk top):
- (101, 67, 101) - northeast branch, 1 block up + diagonal
- (99, 67, 101) - northwest branch
- (101, 67, 99) - southeast branch
- (99, 67, 99) - southwest branch

**Extended branches** (some branches are 2 logs long):
- (102, 68, 102) - if northeast branch extends further

### Visual Approach
Instead of calculating positions, use visual scanning:

1. Stand at trunk base
2. Look up and around trunk
3. Use `find_block("acacia_log", max_distance=8)` repeatedly
4. Break each found log
5. Repeat until no acacia_log blocks found nearby

## Special Considerations

### Branching Complexity
- **No two acacia trees identical**: Branch patterns vary randomly
- **Diagonal coordinates tricky**: Branches at (x±1, y+2-4, z±1) positions
- **Floating logs common**: If you miss a branch, logs float in mid-air

### Comparison to Jungle Trees
Both acacia and jungle have branches, but:
- **Acacia**: Diagonal branches at 45° angles, shorter tree
- **Jungle mega**: Horizontal branches extending 3-5 blocks, very tall
- **Difficulty**: Acacia MEDIUM, Jungle mega VERY HARD

### Savanna Biome Advantages
- Acacia trees scattered widely (not dense forest)
- Easy to identify and isolate single trees
- Flat terrain (no cliffs) makes navigation easier
- Good visibility for branch detection

## Efficiency Tips

### Simplified Approach
For faster (but slightly wasteful) felling:
1. Break trunk base (2-3 logs)
2. Move on to next tree
3. Accept some floating branch logs
4. **Rationale**: 6-12 logs per tree, losing 1-2 floating logs acceptable

### Thorough Approach
For complete felling (no waste):
1. Use `get_tree_structure` to map all logs
2. Break every log systematically
3. Use `find_block` to verify no logs remain
4. **Time cost**: +30-60 seconds per tree, but 100% yield

### Best Biome for Acacia
- **Savanna plateau**: Flat terrain, good visibility
- **Avoid**: Shattered savanna (cliffs make branch access harder)

## Common Mistakes

### ❌ Expecting straight vertical trunk
- Acacia is NOT like oak/birch (straight up)
- Trunk is only 2-3 blocks, then branches

### ❌ Breaking only base and leaving branches
- Trunk removal alone leaves 4-8 logs floating in branches
- Must actively remove each branch

### ❌ Not circling the tree
- Standing in one spot, you can't see all branches
- Walk around tree to spot all diagonal branches

### ❌ Forgetting to check for floating logs
- After collection, look up and around trunk area
- Use `find_block("acacia_log")` to verify none remain

## When to Fell Acacia

### Good Reasons
- **Aesthetic wood**: Orange-gray color unique and attractive
- **Savanna biome exploration**: You're in savanna, acacia available
- **Building project**: Specifically need acacia wood color
- **Variety**: Mix acacia with other wood types

### Bad Reasons
- **Fast wood gathering**: Birch/oak are faster (simpler)
- **Bulk wood**: Spruce/jungle mega trees yield more
- **Learning tree-felling**: Start with oak/birch (easier)

## Multi-Bot Coordination

**Acacia gathering mission:**
1. **SpähBot**: Scout for savanna biome, mark acacia forest waypoint
2. **SammelBot**: Navigate to waypoint
3. **SammelBot**: Fell 5-8 acacia trees (aim for 50-80 logs)
4. **SammelBot**: Report: "Gathered 72 acacia logs from 8 trees"
5. **HandelBot**: Meet SammelBot, receive logs
6. **BauBot**: Use acacia planks for building (distinctive color)

**Time estimate**: 8-12 minutes for 8 acacia trees (includes branch removal)

## Example Workflow

**Scenario: Fell single acacia tree at (100, 64, 100)**

1. `get_tree_structure(100, 64, 100)`
   → "Acacia tree, 1x1 base, height 7 blocks, estimated 9 logs (trunk + branches)"

2. Break trunk (bottom-up):
   - `break_block_and_wait(100, 64, 100)` → base
   - `break_block_and_wait(100, 65, 100)` → middle
   - `break_block_and_wait(100, 66, 100)` → top of trunk

3. Find and break branches:
   - `find_block("acacia_log", max_distance=8)`
     → "Found acacia_log at (101, 67, 101) - 3 blocks away"
   - `break_block_and_wait(101, 67, 101)` → northeast branch

   - `find_block("acacia_log", max_distance=8)`
     → "Found acacia_log at (99, 67, 101) - 3 blocks away"
   - `break_block_and_wait(99, 67, 101)` → northwest branch

   - Repeat until `find_block` returns "No acacia_log found within 8 blocks"

4. `collect_nearby_items(item_types=["acacia_log"], radius=10)`
   → "9 acacia logs collected"

5. `wait_for_saplings(100, 64, 100, timeout=40)`

6. `collect_nearby_items(item_types=["acacia_sapling"], radius=12)`
   → "2 acacia saplings collected"

7. `place_sapling(100, 64, 100, "acacia_sapling")`

8. `send_chat("Felled acacia tree: 9 logs collected, 1 sapling replanted.")`

## Summary

- **Height**: 5-8 blocks total (short trunk + diagonal branches)
- **Pattern**: Always 1x1 (no mega variant)
- **Difficulty**: MEDIUM (branching requires navigation)
- **Speed**: 50-80 seconds per tree
- **Yield**: 6-12 logs per tree
- **Saplings**: 1-3 per tree
- **Strategy**: Trunk first, then circle tree to remove branches
- **Best for**: Aesthetic builds (unique orange-gray wood)
- **Challenge**: Diagonal branches require checking multiple positions
- **Key tool**: Use `find_block("acacia_log")` repeatedly to find all branches
