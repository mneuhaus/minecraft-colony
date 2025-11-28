---
name: house-building
description: This skill should be used when building houses or structures. Core principles for successful construction using the layer-by-layer technique.
allowed-tools: get_position, get_status, get_vox, look_at_map, look_at_map_image, craftscript_start, craftscript_status, craftscript_logs, create_craftscript_function, edit_craftscript_function, list_craftscript_functions
---

# House Building - Core Principles

## The Golden Rule: Layer by Layer

**Build walls layer by layer (Y-level by Y-level), walking ON the previous layer.**

Why this works:
- You're always at the right height to place the next layer
- You can reach all blocks around you
- No scaffolding or climbing needed
- Easy to continue after interruption

## Basic Workflow

1. **Pick a flat spot** - Use `get_vox()` to find clear ground
2. **Build first layer** - Place wall blocks at ground level, walking around the perimeter
3. **Step onto the wall** - Use `goto(x, y+1, z)` to stand on your wall
4. **Build next layer** - Walk around on the wall, placing blocks beside you
5. **Repeat** until desired height
6. **Add roof** - Walk on top of walls, place roof blocks

## Key Constraints

- **You CANNOT place blocks where you stand** - always place beside/around you
- **Block reach is ~4.5 blocks** - stay close to where you're building
- **Check your position** - use `get_position()` before and after navigation
- **Verify your work** - use `get_vox()` to confirm blocks were placed

## JavaScript Pattern

```javascript
// Build one layer of walls (simplified)
const wallY = 64;  // Current layer height
const corners = [
  {x: 100, z: 100}, {x: 105, z: 100},  // South wall
  {x: 105, z: 105}, {x: 100, z: 105}   // North wall (back to start)
];

for (const corner of corners) {
  // Walk on the previous layer (or ground for first layer)
  await goto(corner.x, wallY, corner.z, { tolerance: 1 });

  // Place blocks around you (not where you stand!)
  // ... place logic depends on wall direction
}

// Move up for next layer
await goto(corners[0].x, wallY + 1, corners[0].z);
```

## Tips

- **Start small** - 5x5 house is easier than 10x10
- **Use colored blocks** - easier to see what you've built
- **Log your progress** - `console.log()` after each layer
- **Check symmetry** - use `look_at_map()` to verify shape

## Develop Your Own Functions!

**Important:** Don't just follow this skill blindly.

1. **Create reusable functions** using `create_craftscript_function`
2. **Test them on simple cases** first (single wall, one layer)
3. **Fix issues** as you discover them
4. **Extend gradually** - add features one at a time

Example function to develop:
- `buildWallLayer(x1, z1, x2, z2, y, blockType)` - builds one layer of walls
- `buildRoof(x1, z1, x2, z2, y, blockType)` - fills in a flat roof

The best building functions come from YOUR experimentation, not from pre-written code.

## Common Mistakes

- Trying to place a block where you're standing
- Building from the ground up without moving to higher layers
- Not checking if blocks were actually placed
- Making walls too far apart to reach

## When Things Go Wrong

1. Check position: `get_position()`
2. Check surroundings: `get_vox(5)`
3. Check inventory: `get_inventory()`
4. Try a simpler approach
5. Log more, assume less
