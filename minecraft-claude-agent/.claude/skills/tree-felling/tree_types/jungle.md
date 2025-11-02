# Jungle Trees

## Overview
Jungle trees are the tallest trees in Minecraft and come in both small (1x1) and massive (2x2) variants. They have distinctive vines and large canopies.

## Tree Characteristics

### Small Jungle Trees (1x1)
- **Base pattern**: Single jungle_log at ground level
- **Height**: 4-6 blocks (shortest jungle variant)
- **Canopy**: Small, similar to oak trees
- **Difficulty**: Easy - standard bottom-up felling
- **Vines**: Few or none

### Large Jungle Trees (2x2 Mega)
- **Base pattern**: 2x2 square of jungle_log blocks
- **Height**: 10-30+ blocks (tallest trees in game!)
- **Trunk width**: Maintains 2x2 all the way up
- **Canopy**: Massive, spreading 5-7 blocks in all directions
- **Branches**: YES - large branches extend from main trunk
- **Vines**: Extensively covered with vines
- **Difficulty**: VERY HARD - requires pillaring and careful branch removal

## Identification

### Check for Mega Tree (2x2)
```yaml
Position (x, y, z):
  Check: (x, y, z)       # Northwest log
  Check: (x+1, y, z)     # Northeast log
  Check: (x, y, z+1)     # Southwest log
  Check: (x+1, y, z+1)   # Southeast log

If all 4 are jungle_log: MEGA TREE
If only 1 is jungle_log: SMALL TREE
```

### Visual Cues
- **Mega tree**: Very tall, thick trunk visible from distance, covered in vines
- **Small tree**: Similar height to oak, thin trunk, fewer vines
- **Branches**: Only mega jungle trees have branches (unlike spruce)

## Felling Strategy

### Small Jungle Trees (1x1)
Use standard bottom-up approach:
1. Stand at base
2. Break logs from bottom to top (dig_block or break_block_and_wait)
3. Collect logs (4-6 logs expected)
4. Wait for leaves to decay
5. Collect saplings
6. Replant 1 sapling at original position

### Mega Jungle Trees (2x2) - COMPLEX!

**Phase 1: Assessment**
1. Use `get_tree_structure` to get full height
2. Expect 10-30 logs PER COLUMN = 40-120 total logs!
3. Check inventory space (may need multiple trips)
4. Identify branch locations (logs extending horizontally)

**Phase 2: Branch Removal**
1. Build pillar using `build_pillar(height)`
2. Navigate around canopy at branch level
3. Break all branches extending from main trunk
   - Branches are horizontal jungle_log blocks
   - May extend 3-5 blocks from trunk
   - Use `check_reachable` for each branch log
4. Collect branch logs with `collect_nearby_items`

**Phase 3: Main Trunk Felling**
Two approaches:

**Approach A: Top-Down (Safer)**
1. Pillar to top of tree
2. Break 2x2 layer at top
3. Descend 1 block, break 2x2 layer
4. Repeat until ground level
5. Use `descend_pillar_safely` or break your pillar as you go

**Approach B: Bottom-Up (Faster but riskier)**
1. Clear ALL branches first (critical!)
2. Break all 4 base logs (NW, NE, SW, SE)
3. Tree will NOT fall - logs float
4. Pillar up and break floating logs from bottom up
5. Vines will remain - ignore or break separately

**Phase 4: Collection & Cleanup**
1. Collect logs from ground: `collect_nearby_items(item_types=["jungle_log"], radius=20)`
2. Wait for leaves to decay: `wait_for_saplings(x, y, z, timeout=60)`
   - Jungle leaves take LONGER to decay (large canopy)
   - May need multiple wait cycles
3. Collect saplings: `collect_nearby_items(item_types=["jungle_sapling"], radius=15)`
4. Expect 0-3 saplings (jungle saplings are rarer than oak!)

**Phase 5: Replanting**
1. Find suitable 2x2 planting area: `find_plantable_ground`
2. Plant 4 jungle saplings in 2x2 pattern to regrow mega tree:
   - Place sapling at (x, y, z)
   - Place sapling at (x+1, y, z)
   - Place sapling at (x, y, z+1)
   - Place sapling at (x+1, y, z+1)
3. If only 1-3 saplings available, plant them individually (will grow as small trees)

## Special Considerations

### Vines
- Vines cover jungle trees extensively
- Vines are separate blocks from logs
- Can ignore vines (they don't drop items)
- Or break with shears for decorative vines (not priority)

### Height Management
- Mega jungle trees are THE TALLEST in Minecraft
- Pillaring to 30 blocks is common
- Always use `build_pillar` and `descend_pillar_safely`
- Keep dirt/cobblestone in inventory for pillars

### Sapling Rarity
- Jungle saplings are RARER than other types
- Jungle leaves have lower sapling drop rate
- May only get 0-2 saplings from mega tree
- Consider keeping jungle saplings as valuable resource
- May need to fell multiple small jungle trees to get 4 saplings for replanting mega

### Inventory Management
- Mega jungle tree = 40-120 logs!
- Each log occupies 1 inventory slot (stacks to 64)
- May need 2-3 inventory slots just for logs
- Consider depositing logs mid-harvest if near chest
- Or craft into planks to save space (1 log = 4 planks, better storage)

## Common Mistakes

### ❌ Attempting mega tree without height assessment
- Mega trees can be 30+ blocks tall
- Always use `get_tree_structure` first
- Ensure you have pillar-building materials

### ❌ Forgetting to remove branches
- Jungle tree branches extend 3-5 blocks horizontally
- Unreachable logs will remain floating
- Clear branches BEFORE felling main trunk

### ❌ Breaking base without pillar materials
- If you break the base and can't reach upper logs, you're stuck
- Always have 20-30 dirt/cobblestone for pillaring
- Better: use top-down approach for mega trees

### ❌ Expecting many saplings
- Jungle saplings are rare
- 0-2 saplings from mega tree is normal
- Don't replant mega (2x2) unless you have all 4 saplings

### ❌ Underestimating time required
- Mega jungle tree can take 5-10 minutes
- Many tool uses required (50-100+)
- Plan accordingly for long operations

## Efficiency Tips

### For Small Jungle Trees
- Treat like oak trees (simple bottom-up)
- Fast operation (2-3 minutes)
- Good for quick log gathering

### For Mega Jungle Trees
- Only fell mega trees when you need MANY logs (40-120)
- Bring extra pillar materials (30+ blocks)
- Consider bringing chest to deposit mid-harvest
- Top-down approach is safer but slower
- Bottom-up is faster but leaves floating logs initially

### Leaf Decay Patience
- Jungle tree canopies are HUGE
- Leaf decay can take 60-90 seconds
- Use `wait_for_saplings(timeout=60)` or even 90
- Or move on and return later for saplings

## Example Coordinates & Workflow

**Scenario: Mega Jungle Tree at (200, 64, -150)**

1. `get_tree_structure(200, 64, -150)`
   → Returns: 2x2 mega tree, 28 blocks tall, ~90 logs

2. `list_inventory()`
   → Check for 30+ dirt/cobblestone for pillaring

3. `move_to_position(200, 64, -150, range=1)`

4. `build_pillar(height=28)`

5. Break branch logs at height 20-28 while at canopy level

6. Descend and break all trunk logs (2x2 pattern, 28 layers)

7. `descend_pillar_safely()`

8. `collect_nearby_items(item_types=["jungle_log"], radius=20)`
   → Expect ~90 logs collected

9. `wait_for_saplings(200, 64, -150, timeout=90)`

10. `collect_nearby_items(item_types=["jungle_sapling"], radius=15)`
    → Expect 0-3 saplings

11. If 4 saplings: replant 2x2 pattern
    If 1-3 saplings: plant individually or save for later

12. Report completion with log count

## Summary

- **Small jungle trees**: Easy, 4-6 logs, treat like oak
- **Mega jungle trees**: Very hard, 40-120 logs, requires pillaring and branch removal
- **Key difference from spruce mega**: Jungle has extensive BRANCHES that must be cleared
- **Sapling rarity**: Don't expect many saplings, jungle saplings are valuable
- **Time investment**: Mega jungle = 5-10 minutes of work
- **Reward**: Massive log yield (best logs-per-tree ratio in game)
