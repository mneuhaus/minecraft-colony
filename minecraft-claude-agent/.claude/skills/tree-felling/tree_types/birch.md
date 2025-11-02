# Birch Trees

## Overview
Birch trees are simple, elegant trees with distinctive white bark. They are one of the easiest trees to fell and provide a clean, light-colored wood perfect for building.

## Tree Characteristics

### Standard Birch Trees (1x1 only)
- **Base pattern**: Single birch_log at ground level
- **Height**: 5-7 blocks (consistent, medium height)
- **Trunk**: Straight, no branches
- **Canopy**: Small, neat, symmetrical
- **Difficulty**: EASY - simplest tree type to fell
- **No variants**: Birch does NOT have mega (2x2) trees

## Identification

### Visual Cues
- **White bark**: Distinctive white/light gray log texture
- **Straight trunk**: No branches, clean vertical column
- **Small leaves**: Compact canopy, minimal overhang
- **Common biomes**: Birch forest, plains, flower forest

### Check Base Pattern
```yaml
Position (x, y, z):
  Check: (x, y, z)  # Single birch_log

If only 1 birch_log at base: BIRCH TREE (always 1x1)
```

## Felling Strategy

### Bottom-Up Approach (Recommended)
Birch trees are perfect for simple bottom-up felling:

1. **Position at base**
   - Stand next to birch_log at ground level
   - No need to assess height (always 5-7 blocks)

2. **Break logs from bottom to top**
   - Use `dig_block(x, y, z)` or `break_block_and_wait(x, y, z)`
   - Start at base (y), work upward (y+1, y+2, etc.)
   - Break each log in sequence: base → middle → top

3. **Collect logs**
   - `collect_nearby_items(item_types=["birch_log"], radius=5)`
   - Expect 5-7 birch logs

4. **Wait for leaf decay**
   - `wait_for_saplings(x, y, z, timeout=30)`
   - Birch leaves decay quickly (small canopy)

5. **Collect saplings**
   - `collect_nearby_items(item_types=["birch_sapling"], radius=10)`
   - Expect 1-2 saplings (good drop rate)

6. **Replant**
   - `find_plantable_ground(x, y, z, radius=5)`
   - `place_sapling(x, y, z, "birch_sapling")`

## Efficiency Notes

### Why Birch is Easy
- **No height uncertainty**: Always 5-7 blocks (reachable without pillaring)
- **No branches**: Straight trunk means no floating logs
- **Fast decay**: Small canopy means quick sapling drops
- **Good sapling rate**: 1-2 saplings per tree (reliable replanting)
- **No mega variant**: Never encounter complex 2x2 birch trees

### Speed Run Strategy
For quick wood gathering:
1. No need for `get_tree_structure` (birch is always simple)
2. No need for pillaring (always reachable from ground)
3. Break 5-7 logs bottom-up (takes ~15-20 seconds)
4. Collect and replant (takes ~10 seconds)
5. **Total time**: ~30 seconds per birch tree

### Comparison to Other Trees
| Tree Type | Height | Complexity | Time to Fell |
|-----------|--------|------------|--------------|
| Birch | 5-7 | EASY | 30 sec |
| Oak | 4-7 | EASY | 30-40 sec |
| Spruce (small) | 7-10 | MEDIUM | 40-60 sec |
| Jungle (small) | 4-6 | EASY | 30-40 sec |
| Acacia | 5-8 | MEDIUM | 50-80 sec (branches) |
| Spruce (mega) | 20-30 | HARD | 5-10 min |
| Jungle (mega) | 20-30 | VERY HARD | 5-10 min |

**Birch is tied with oak as the easiest tree to fell!**

## Special Considerations

### Birch Forest Biomes
- Dense clusters of birch trees
- Ideal for bulk wood gathering
- Trees often close together (4-8 blocks apart)
- Can fell multiple trees quickly in sequence

### Wood Properties
- **Planks**: Light color, clean aesthetic
- **Logs**: White bark with dark wood grain
- **Use cases**: Modern builds, floors, clean interiors
- **Crafting**: Same as all wood types (4 planks per log)

### Sapling Management
- Birch saplings: Common drop (1-2 per tree)
- No need to stockpile (easy to get more)
- Replant 1 sapling per tree felled
- Excess saplings: Use as furnace fuel or composting

## Common Mistakes

### ❌ Over-preparing for birch trees
- No need to check for mega variant (doesn't exist)
- No need to pillar (always reachable)
- No need for complex strategy (simple bottom-up works)

### ❌ Forgetting birch is 1x1 only
- Don't search for 2x2 pattern
- Don't expect tall trees like spruce/jungle mega
- Birch is always simple

### ❌ Breaking from top-down
- Bottom-up is safer and faster for birch
- No falling hazard since trees are only 5-7 blocks
- No need to pillar and descend

## Best Practices

### When to Choose Birch
- **Need fast wood**: Birch is quickest to fell
- **Limited time**: Short, simple trees
- **Learning**: Practice tree-felling with birch (easiest)
- **Aesthetic building**: White wood for clean builds

### When NOT to Choose Birch
- **Need bulk wood**: Jungle/spruce mega trees yield more (40-120 logs vs 5-7)
- **Rare wood aesthetics**: Dark oak, acacia, cherry for variety
- **No birch biome nearby**: Use whatever trees are available

### Multi-Bot Coordination
**Simple delegation pattern:**
1. SammelBot: Find birch forest biome
2. SammelBot: Fell 10 birch trees in sequence
3. SammelBot: Collect 50-70 birch logs total
4. SammelBot: Replant 10 saplings
5. HandelBot: Meet SammelBot, receive birch logs
6. BauBot: Use birch planks for building project

**Time estimate**: 5-6 minutes for 10 birch trees (very efficient)

## Example Workflow

**Scenario: Gather 60 birch logs for building project**

1. `find_trees(radius=50, types=["birch"])`
   → "Found 15 birch trees. Nearest: birch at (140, 64, 95), height ~6 blocks, ~6 logs, 25 blocks away"

2. `move_to_position(140, 64, 95, range=1)`
   → Navigate to first tree

3. Break logs bottom-up (6 logs):
   - `break_block_and_wait(140, 64, 95)` → base
   - `break_block_and_wait(140, 65, 95)` → layer 2
   - `break_block_and_wait(140, 66, 95)` → layer 3
   - `break_block_and_wait(140, 67, 95)` → layer 4
   - `break_block_and_wait(140, 68, 95)` → layer 5
   - `break_block_and_wait(140, 69, 95)` → top

4. `collect_nearby_items(item_types=["birch_log"], radius=5)`
   → 6 birch logs collected

5. `wait_for_saplings(140, 64, 95, timeout=30)`
   → Leaves decay

6. `collect_nearby_items(item_types=["birch_sapling"], radius=10)`
   → 2 saplings collected

7. `place_sapling(140, 64, 95, "birch_sapling")`
   → Replant 1 sapling

8. Repeat steps 2-7 for trees #2-10 (9 more trees)

9. Total yield: 60 birch logs, 9-18 saplings
10. Time: ~5 minutes
11. Report: `send_chat("Gathered 60 birch logs from 10 trees. Ready for building!")`

## Summary

- **Height**: 5-7 blocks (always reachable)
- **Pattern**: Always 1x1 (no mega variant)
- **Difficulty**: EASY (easiest with oak)
- **Speed**: 30 seconds per tree
- **Yield**: 5-7 logs per tree
- **Saplings**: 1-2 per tree (reliable)
- **Strategy**: Simple bottom-up felling
- **Best for**: Fast wood gathering, learning tree-felling, clean aesthetic builds
- **No special tools needed**: No pillaring, no branch removal, no complex assessment
