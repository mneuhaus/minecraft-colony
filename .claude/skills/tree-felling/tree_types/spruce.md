# Spruce Trees

## General Layout

- **Block type**: `spruce_log`
- **Base pattern**: Can be 1x1 OR 2x2 (mega spruce)
- **Height**: 7-15 blocks (normal), 15-30 blocks (mega)
- **Canopy**: Conical, tapered to top
- **Branches**: None (straight trunk(s))

## Identification

### Normal Spruce (1x1)
```
find_tree returns: spruce_log at (x, y, z)
Base check: Single log
```

### Mega Spruce (2x2)
```
find_tree may return one of 4 base positions
MUST check all 4 positions:
  (x, y, z)
  (x+1, y, z)
  (x, y, z+1)
  (x+1, y, z+1)
```

## Felling Strategy

### Normal Spruce (1x1)
- **Approach**: Bottom-up or pillar
- Same as oak, but taller

### Mega Spruce (2x2) - IMPORTANT
**Critical**: Must clear ALL 4 trunk positions at EACH height

1. **Verify 2x2 base pattern**:
   ```
   find_block spruce_log at (x, y, z) -> YES
   find_block spruce_log at (x+1, y, z) -> YES
   find_block spruce_log at (x, y, z+1) -> YES
   find_block spruce_log at (x+1, y, z+1) -> YES
   ```

2. **Build pillar** (tree is tall, 15-30 blocks)

3. **Top-down felling**:
   - Start at top
   - At each level, dig all 4 positions
   - Work down level by level
   - Break pillar on descent

4. **Level-by-level clearing**:
   ```
   Height Y:
   - dig_block (x, Y, z)
   - dig_block (x+1, Y, z)
   - dig_block (x, Y, z+1)
   - dig_block (x+1, Y, z+1)
   Move down to Y-1, repeat
   ```

## Typical Dimensions

### Normal
```
Height: 7-15 blocks
Width: 1 block
```

### Mega
```
Height: 15-30 blocks
Width: 2x2 blocks
Volume: 4x the logs of normal tree
```

## Caveats

- **Mega detection critical**: Missing even 1 log at base means it's a mega tree
- **Tall height**: Almost always need pillaring for mega trees
- **4x logs**: Mega gives massive wood yield
- **2x2 canopy**: Leaves extend from all 4 trunk positions

## Difficulties

**Normal**: ⚠️ **Medium** (tall, need pillar)
**Mega**: 🔴 **Hard**:
- Extreme height (20+ blocks common)
- Must track 4 trunk positions
- Easy to leave floating logs if miss a position
- Requires significant pillar building

## Sapling Management

### Normal Spruce
- Plant 1 sapling at base position
- **Growth**: Needs 5x5 clear space

### Mega Spruce
- **Requires 4 saplings in 2x2 pattern**
- All 4 must be placed to grow mega tree
- **Growth**: Needs 11x11 clear space
- **Bone meal**: Can speed up (use on any of 4 saplings)

**Important**: If only 1-3 saplings, will grow as normal spruce, not mega!

## Example Coordinates (Mega)

```
Base at (100, 64, 200)

Base level (Y=64):
  (100, 64, 200) - SW log
  (101, 64, 200) - SE log
  (100, 64, 201) - NW log
  (101, 64, 201) - NE log

Next level (Y=65):
  (100, 65, 200)
  (101, 65, 200)
  (100, 65, 201)
  (101, 65, 201)

... continues for 20+ levels
```

## Common Mistakes

1. **Assuming 1x1**: Find one log, assume it's normal tree → miss other 3 bases
2. **Incomplete clearing**: Clear 3 of 4 positions → floating log column remains
3. **Wrong replanting**: Place 1 sapling for mega tree → grows as normal
4. **Canopy confusion**: Leaves from all 4 trunks overlap, hard to see structure
