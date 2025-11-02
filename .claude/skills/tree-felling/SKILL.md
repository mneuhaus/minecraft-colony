---
name: tree-felling
description: Efficiently fell trees in Minecraft, handling different tree types (oak, spruce mega trees, acacia), managing height, preventing floating logs, and replanting. Use when gathering wood or managing forests.
allowed-tools: find_tree, fell_tree, find_block, dig_block, place_block, move_to_position, get_position, list_inventory
---

# Tree Felling

Comprehensive guide for efficiently harvesting trees in Minecraft while following best practices.

## Tree Type Identification

Different trees require different felling strategies:

### Single Log Trees (Oak, Birch, Jungle)
- **Pattern**: Single vertical column of logs
- **Base**: 1x1 log block
- **Strategy**: Simple bottom-up or top-down felling
- **Tools**: find_tree returns these with single coordinates

### Mega Trees (Spruce, Jungle, Dark Oak)
- **Pattern**: 2x2 base of logs
- **Base**: 4 log blocks in a square formation
- **Strategy**: Must clear all 4 trunk positions at each height
- **Detection**: Use find_block to check for 2x2 pattern at base

### Branching Trees (Acacia)
- **Pattern**: Diagonal logs, multiple branches
- **Base**: Single log, but branches extend horizontally
- **Strategy**: Follow each branch, clear all diagonal connections
- **Challenge**: Logs may be offset in X/Z coordinates

## Height Assessment

Before felling, assess tree height to choose strategy:

### Measuring Height
1. Use find_tree to get base coordinates (x, y, z)
2. Use find_block repeatedly to count vertical logs above base
3. Count by checking blocks at (x, y+1, z), (x, y+2, z), etc.
4. Stop counting when block is not a log type

### Height Categories
- **Short (< 5 blocks)**: Reachable without pillar, simple felling
- **Medium (5-10 blocks)**: May need pillar-jumping or scaffolding
- **Tall (> 10 blocks)**: Requires scaffolding or pillar technique

## Felling Procedures

### Bottom-Up Strategy (Recommended for Short Trees)
1. Start at base level (lowest log block)
2. Dig block at base
3. Move up one level
4. Repeat until all logs cleared
5. **Advantage**: Natural, no floating logs
6. **Disadvantage**: Hard to reach high blocks

### Top-Down Strategy (For Tall Trees)
1. Build pillar or scaffold to top
2. Stand on top log
3. Dig downward through all logs
4. Break pillar/scaffold on way down
5. **Advantage**: Can reach any height
6. **Disadvantage**: Requires building materials

### Pillar-Jumping Technique (For Medium Trees)
1. Jump and place block beneath feet mid-air
2. Repeat to build vertical pillar
3. Dig side logs while standing on pillar
4. Break pillar on descent
5. **Materials**: dirt or cobblestone (cheap, disposable)

## Reaching High Blocks

### When to Pillar vs Scaffold

**Use Pillar (Jump-Place) When**:
- Tree height 5-10 blocks
- Flat ground around tree
- Have cheap blocks (dirt, cobblestone)

**Use Scaffolding When**:
- Tree height > 10 blocks
- Uneven terrain
- Need to move horizontally (branches)
- Have scaffolding material

### Pillar Building Steps
1. list_inventory - check for dirt/cobblestone
2. Stand next to tree base
3. Look straight down
4. Jump + place_block beneath feet
5. Repeat until at desired height
6. Dig logs from elevated position
7. Break pillar blocks on way down

## Sapling Management

Proper sapling management ensures sustainable wood supply:

### Leaf Decay Process
1. After felling logs, leaves remain temporarily
2. Wait 30-60 seconds for natural decay
3. Saplings drop automatically as leaves decay
4. Also drops sticks and sometimes apples (oak)

###Collecting Saplings
1. After tree felled, wait for leaves to decay
2. Use find_entity or check ground nearby
3. Walk over dropped items to collect
4. list_inventory to verify sapling collection

### Replanting Protocol
1. **IMPORTANT**: Replant before leaving area
2. place_block sapling at original tree base coordinates
3. Ensure 5x5 clear space around sapling (for growth)
4. For 2x2 trees: place 4 saplings in 2x2 pattern

### Minimum Sapling Count
- Keep at least 2 saplings per tree type in inventory
- This ensures can always replant
- Excess saplings can be composted or stored

## Efficiency Tips

### Batch Felling
Instead of: fell → replant → fell → replant
**Do**: fell → fell → fell → replant all

**Steps**:
1. find_tree to locate 3-5 nearby trees
2. Note all coordinates
3. Fell all trees in sequence
4. Collect all saplings from leaf decay
5. Replant all positions at once

### Tool Management
- **Axe**: Always use axe for faster wood harvesting
- **Hand**: OK for leaves if waiting for decay
- **Efficiency**: Axe breaks logs 5x faster than hand

### Inventory Management
- Keep 1-2 stacks of dirt for pillaring
- Always reserve 2+ slots for wood
- Don't fill inventory before felling (need space for logs)

## Stump Prevention

Floating logs are ugly and problematic:

### Complete Clearing Rules
1. **Always dig to ground level (y = 60-64 typically)**
2. Check block below last log - should be dirt/grass
3. For 2x2 trees: Clear all 4 base positions completely
4. Use find_block to verify no logs remain

### Handling 2x2 Mega Trees
A 2x2 tree base at (x, y, z) has logs at:
- (x, y, z)
- (x+1, y, z)
- (x, y, z+1)
- (x+1, y, z+1)

**Must clear all 4 positions at EACH height level**

### Verification Checklist
- [ ] No logs remain above ground
- [ ] Ground level cleared to dirt/grass
- [ ] No floating leaf blocks
- [ ] Saplings replanted
- [ ] Area cleaned of debris

## Example: Complete Felling Procedure

```
GOAL: Fell oak tree at (100, 64, 200)

1. find_tree -> Confirms oak_log at (100, 64, 200)

2. HEIGHT CHECK:
   - find_block oak_log around (100, 65, 200) -> found
   - find_block oak_log around (100, 66, 200) -> found
   - find_block oak_log around (100, 67, 200) -> found
   - find_block oak_log around (100, 68, 200) -> not found
   - Result: Tree is 4 blocks tall (short)

3. FELLING (Bottom-Up):
   - move_to_position (100, 64, 200)
   - dig_block (100, 64, 200) - base log
   - move_to_position (100, 65, 200) - jump up
   - dig_block (100, 65, 200)
   - dig_block (100, 66, 200)
   - dig_block (100, 67, 200)

4. SAPLING MANAGEMENT:
   - Wait 60 seconds for leaves to decay
   - Collect saplings automatically (walk over them)
   - list_inventory - confirm have oak_sapling

5. REPLANTING:
   - place_block oak_sapling at (100, 64, 200)

6. VERIFICATION:
   - find_block oak_log at (100, 64+, 200) -> none found ✓
   - Sapling placed ✓
```

## Common Mistakes to Avoid

1. **Leaving floating logs**: Always clear to ground level
2. **Forgetting to replant**: Depletes forest resources
3. **Not checking height**: Waste time trying to reach unreachable blocks
4. **Wrong strategy for tree type**: 2x2 trees need 4x the clearing
5. **Breaking pillar too early**: Get stuck mid-air
6. **Not waiting for leaves**: Miss sapling drops

## Tools Reference

**Primary**:
- `find_tree` - Locate nearby trees with coordinates
- `fell_tree` - Cut down specific tree by coordinates and type
- `dig_block` - Remove individual log blocks
- `place_block` - Place saplings, build pillars

**Support**:
- `find_block` - Check for logs at specific heights, verify clearing
- `move_to_position` - Navigate to tree base or pillar height
- `get_position` - Track current location during felling
- `list_inventory` - Check saplings, building materials
