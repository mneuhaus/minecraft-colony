# Oak Trees

## General Layout

- **Block type**: `oak_log`
- **Base pattern**: 1x1 single log
- **Height**: 4-7 blocks typically
- **Canopy**: Round, leafy top
- **Branches**: None (straight vertical trunk)

## Identification

```
find_tree returns: oak_log at (x, y, z)
Base check: Single log block, not 2x2
```

## Felling Strategy

**Best approach**: Bottom-up (no pillar needed for short oaks)

1. **Start at base** (y level from find_tree)
2. Dig bottom log with `break_block_and_wait`
3. **Jump up** and dig next log
4. Continue until all logs cleared
5. **No special handling needed** - straight vertical

## Typical Dimensions

```
Height: 4-7 blocks
Width: 1 block
Canopy radius: 3 blocks
```

## Caveats

- **Apple drops**: Oak leaves can drop apples (rare, bonus food)
- **Dense canopy**: Leaves take longer to decay than other trees
- **Common**: Oak is most frequent tree type in many biomes

## Difficulties

✅ **Easy**:
- Straight trunk
- Reachable height
- No branches to miss
- Simple 1x1 pattern

## Sapling Management

- **Drop rate**: Good (oak saplings common from leaf decay)
- **Growth**: Needs 5x5 clear space, any light level
- **Time**: 1-3 Minecraft days to full size

## Example Coordinates

```
Base at (100, 64, 200)
Logs at:
  (100, 64, 200) - base
  (100, 65, 200)
  (100, 66, 200)
  (100, 67, 200) - top
Canopy centers around (100, 68, 200)
```
