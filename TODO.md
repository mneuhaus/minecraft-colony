# TODO - Claude Minecraft Bot

## Priority 1 - Core Survival Skills (IN PROGRESS)

### Tree Felling - Atomic Tools Approach

**SKILL.md**: `.claude/skills/tree-felling/SKILL.md` teaches strategy and decision-making

**Required Atomic Tools** (each does ONE thing):
- [ ] `find_trees(radius, types)` - Find all trees, return positions/heights/types sorted by distance
- [ ] `get_tree_structure(base_position)` - Analyze a specific tree (1x1 vs 2x2, height, log positions)
- [ ] `check_reachable(block_position)` - Can bot reach this block? Need scaffolding?
- [ ] `break_block_and_wait(x, y, z)` - Break block and wait for drops
- [ ] `collect_nearby_items(item_types, radius)` - Collect dropped items
- [ ] `wait_for_saplings(position, timeout)` - Wait for leaf decay near tree base
- [ ] `find_plantable_ground(near_position, radius)` - Find suitable dirt/grass for saplings
- [ ] `place_sapling(x, y, z, type)` - Plant a sapling
- [ ] `build_pillar(height)` - Jump-place blocks to rise vertically
- [ ] `descend_pillar_safely()` - Break blocks beneath to descend

**Testing Checklist**:
- [ ] Bot can find nearest trees with find_trees
- [ ] Bot analyzes tree structure (1x1 oak vs 2x2 mega spruce)
- [ ] Bot fells short tree (< 5 blocks) without scaffolding
- [ ] Bot builds pillar for tall tree (> 10 blocks)
- [ ] Bot descends pillar safely
- [ ] No floating logs left behind
- [ ] Bot waits for and collects saplings
- [ ] Bot replants saplings at original location
- [ ] Works with different tree types (oak, spruce, birch, jungle)
