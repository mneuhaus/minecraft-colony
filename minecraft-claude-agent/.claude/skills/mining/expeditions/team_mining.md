# Team Mining Expeditions – Multi-Bot Coordination

## Overview

Team mining expeditions allow multiple bots to efficiently gather large quantities of resources through coordinated underground operations. This guide covers safety protocols, role assignments, and communication strategies for successful group mining.

## Team Roles

### Primary Miner (GräberBot)
**Responsibilities:**
- Lead the expedition, choose mining location
- Dig main tunnels and shafts
- Identify ore veins and mark locations
- Set the mining pattern (strip mine, branch mine, quarry)

**Equipment needed:**
- 2-3 pickaxes (appropriate tier for target ores)
- 64 torches minimum
- Food (20+ units)
- Spare tools/materials

### Support Miner (SammelBot/SpähBot)
**Responsibilities:**
- Dig secondary tunnels parallel to primary
- Collect dropped items from both miners
- Place torches and maintain lighting
- Watch for hazards (lava, caves, mobs)

**Equipment needed:**
- 1-2 pickaxes
- 32 torches
- Food (10+ units)
- Emergency blocks (cobblestone for plugging lava)

### Surface Coordinator (HandelBot/BauBot)
**Responsibilities:**
- Remain at surface near mine entrance
- Receive mined materials from returning miners
- Store materials in chests
- Craft replacement tools if needed
- Monitor team status via messages

**Equipment needed:**
- Chests for storage
- Crafting table
- Spare tool materials (sticks, planks, cobblestone)

## Expedition Workflow

### Phase 1: Preparation (5-10 minutes)

**1. Coordinator assembles team:**
```
send_chat("Mining expedition forming: Need 2 miners + 1 coordinator")
send_bot_message("GräberBot", "Lead mining expedition to Y=11 for diamonds", "normal")
send_bot_message("SammelBot", "Support GräberBot on mining expedition", "normal")
send_bot_message("HandelBot", "Coordinate from surface, manage materials", "normal")
```

**2. Equipment check:**
```
All miners:
- list_inventory()
- Confirm pickaxes, torches, food
- Report if missing any essentials

Example:
GräberBot: "Ready: 2 iron pickaxes, 64 torches, 20 bread"
SammelBot: "Ready: 1 iron pickaxe, 32 torches, 15 cooked_beef"
HandelBot: "At surface with 3 chests and crafting table"
```

**3. Set waypoints:**
```
Coordinator:
set_waypoint("mine_entrance", 150, 64, 200)
send_chat("Mine entrance marked at (150, 64, 200)")
```

### Phase 2: Descent (10-15 minutes)

**Method: Safe Staircase**

**Primary Miner leads:**
```
GräberBot:
1. Start at entrance waypoint (150, 64, 200)
2. Dig staircase pattern:
   - Dig block at feet
   - Move forward
   - Dig diagonally down
   - Place torch every 8 blocks
3. Continue to target Y-level (Y=11 for diamonds)
4. Announce depth every 10 levels:
   send_chat("Depth check: Currently at Y=50")
   send_chat("Depth check: Currently at Y=40")
   send_chat("Depth check: Currently at Y=30")
   send_chat("Depth check: Currently at Y=20")
   send_chat("Reached target depth Y=11")
```

**Support Miner follows:**
```
SammelBot:
1. Wait 30 seconds after GräberBot starts
2. Follow the lit tunnel down
3. Collect any missed drops
4. Add extra torches if needed
5. Watch for hazards GräberBot might have missed
6. Report status: send_chat("Following main tunnel, currently at Y=35")
```

**Surface Coordinator monitors:**
```
HandelBot:
1. Stay at entrance
2. Check messages every 2 minutes: read_bot_messages(only_unread=true)
3. If emergency reported, prepare rescue (potions, food, tools)
```

### Phase 3: Mining Operations (30-60 minutes)

**Pattern: Branch Mining (Most Efficient)**

**Primary Miner (main tunnel):**
```
GräberBot at Y=11:
1. Dig main corridor 2 blocks wide, 3 blocks tall
2. Extend for 100 blocks in one direction
3. Mark distances every 20 blocks with torch clusters
4. Announce progress:
   send_chat("Main tunnel 50% complete (50/100 blocks)")
   send_chat("Main tunnel complete - 100 blocks")
```

**Support Miner (branch tunnels):**
```
SammelBot at Y=11:
1. Start at main tunnel position 0
2. Dig branch tunnel to the side (1 block wide, 2 blocks tall)
3. Extend branch for 20 blocks
4. Return to main tunnel
5. Move forward 3 blocks in main tunnel
6. Dig another branch on opposite side
7. Repeat pattern
8. Announce ore findings:
   send_chat("Found iron ore vein in branch at (145, 11, 180)")
   send_chat("Found DIAMONDS at (150, 11, 185)! 4 blocks visible")
```

**Coordination during mining:**
```
Every 10 minutes:
GräberBot: "Status: Main tunnel progress 70%, inventory 60% full"
SammelBot: "Status: 8 branches complete, found 12 iron ore, 32 coal"

When inventory fills:
SammelBot: "Inventory 90% full, returning to surface"
GräberBot: "Continue mining, I'll keep working"
```

### Phase 4: Resource Collection

**Miner with full inventory:**
```
1. Announce return:
   send_chat("Inventory full, returning to surface with materials")

2. Navigate back via main staircase:
   - Follow torches upward
   - get_position() periodically to track progress
   - Announce when reaching surface

3. Deliver to coordinator:
   find_entity(type="player", name="HandelBot")
   move_to_position(HandelBot_x, HandelBot_y, HandelBot_z, range=2)

4. Report haul:
   send_chat("Delivered: 48 iron_ore, 64 coal, 16 gold_ore, 3 diamonds")

5. Return to mine or rest if needed
```

**Surface Coordinator receives:**
```
HandelBot:
1. Wait for miner to approach
2. Collect dropped items or open chest transaction
3. Store in organized chests:
   - Chest 1: Iron and gold ores
   - Chest 2: Coal and other common materials
   - Chest 3: Rare materials (diamonds, emeralds, lapis)

4. Confirm receipt:
   send_bot_message("SammelBot", "Materials stored. You can return to mining.", "normal")

5. Craft replacement tools if requested:
   "GräberBot needs new pickaxe" → Craft iron pickaxe → Drop for pickup
```

### Phase 5: Hazard Response

**Lava encountered:**
```
Miner who found it:
send_bot_message("ALL", "LAVA at (145, 11, 190) - marking area dangerous", "high")

Actions:
1. place_block(lava_x, lava_y, lava_z, "cobblestone") to plug source
2. Back away slowly
3. Mark area with extra torches
4. Continue mining in different direction
```

**Cave breakthrough:**
```
Miner:
send_chat("WARNING: Broke into natural cave at (148, 11, 195)")

Actions:
1. Do NOT enter cave (may have mobs)
2. Place blocks to seal breach temporarily
3. Mark location for future exploration
4. Continue planned mining pattern
```

**Mob encounter underground:**
```
Miner under attack:
send_bot_message("ALL", "MOBS attacking at my position! Health at 12/20", "high")

Other miner response:
send_bot_message("GräberBot", "On my way to assist, 20 blocks away", "high")

OR retreat:
"Retreating to main tunnel, too many mobs to fight"
```

### Phase 6: Expedition Conclusion

**When to end expedition:**
- All miners' inventories full
- Target resource quota met (e.g., "100 iron ore collected")
- Time limit reached (planned 1 hour expedition)
- Emergency situation (low health, no food, tools breaking)

**Closing procedures:**
```
1. Primary Miner announces:
   send_chat("Expedition concluding. All miners return to surface.")

2. Both miners navigate up staircase

3. Final delivery to coordinator:
   Both miners drop remaining materials

4. Coordinator tallies total haul:
   send_chat("Expedition results: 128 iron_ore, 96 coal, 24 gold_ore, 7 diamonds, 16 lapis")

5. Mark mine location for future use:
   set_waypoint("diamond_mine_01", 150, 11, 200)
   send_chat("Mine saved as waypoint: diamond_mine_01")

6. Distribute rewards (if needed):
   "Each bot takes 2 diamonds for their own use"
```

## Safety Protocols

### Rule 1: Never Split Up Without Communication
```
Bad: GräberBot wanders off exploring cave without telling anyone
Good: send_chat("Going to explore side passage, back in 5 minutes")
```

### Rule 2: Always Keep Escape Route Lit
```
Primary miner places torches every 8 blocks
Support miner adds extra torches on corners
Never remove torches while still underground
```

### Rule 3: Emergency Recall System
```
If coordinator needs to recall team urgently:
send_bot_message("ALL", "EMERGENCY RECALL: Return to surface immediately", "high")

All miners:
- Stop current activity
- Navigate to surface
- Report status when safe
```

### Rule 4: Health Monitoring
```
Check health every 10 minutes:
get_health()

If health < 10/20:
- Stop mining
- Eat food
- If health doesn't recover, return to surface
- send_chat("Health critical, returning to surface")
```

### Rule 5: Tool Management
```
Before tool breaks (durability low):
- Craft replacement if materials available
- OR return to surface for new tools
- Never continue without working pickaxe

Monitor:
"My iron pickaxe durability is low, need replacement soon"
```

## Efficiency Tips

### Tip 1: Parallel Mining
```
Instead of both miners in same tunnel:
- Primary miner digs main tunnel north
- Support miner digs parallel tunnel 10 blocks east
- Cover 2x the area in same time
```

### Tip 2: Item Collection Optimization
```
Support miner focuses on collection:
- collect_nearby_items(["iron_ore", "diamond", "gold_ore", "lapis_lazuli"], radius=10)
- Let primary miner focus purely on digging
- Reduces primary miner's inventory management
```

### Tip 3: Shift Changes
```
For extended mining (2+ hours):
- Miners rotate in shifts
- Fresh miner goes down, tired miner returns
- Maintains constant mining operation
- Prevents bot fatigue/stuck states
```

### Tip 4: Ore Vein Exploitation
```
When large ore vein found:
send_bot_message("GräberBot", "Large iron vein at (145, 11, 190), need help mining", "normal")

Both miners converge on location:
- Mine all visible ore
- Check adjacent blocks for hidden ore
- Maximizes yield from discovery
```

## Common Mistakes to Avoid

❌ **Digging straight down**
- Risk: Fall into cave, lava, void
- Solution: Always use staircase method

❌ **Not announcing depth**
- Risk: Team loses coordination, miners at different levels
- Solution: Call out Y-level every 10 blocks

❌ **Ignoring inventory space**
- Risk: Items despawn, ore wasted
- Solution: Return to surface at 80% full

❌ **Poor torch placement**
- Risk: Mobs spawn, team gets lost
- Solution: Torch every 8 blocks, extra torches at intersections

❌ **No emergency plan**
- Risk: Deaths, lost equipment, mission failure
- Solution: Always know route to surface, keep food ready

## Example Full Expedition

**Target: Gather 64 iron ore and search for diamonds**

**Team: GräberBot (primary), SammelBot (support), HandelBot (surface)**

**Timeline:**
- 0:00 - Team assembles at (150, 64, 200), equipment check
- 0:05 - GräberBot starts digging staircase down
- 0:10 - SammelBot follows down staircase
- 0:20 - Both miners reach Y=11
- 0:25 - GräberBot starts main tunnel, SammelBot starts branch #1
- 0:35 - First iron ore found, 8 blocks collected
- 0:50 - SammelBot inventory 70% full, mostly iron and coal
- 1:00 - SammelBot returns to surface, delivers 32 iron ore, 48 coal
- 1:05 - SammelBot returns to mine, continues branches
- 1:15 - GräberBot finds diamonds! 4 blocks
- 1:20 - Both miners converge on diamond location, mine carefully
- 1:30 - Total collected: 64 iron ore (goal met!), 96 coal, 6 diamonds
- 1:35 - Team returns to surface
- 1:40 - Expedition complete, waypoint saved, materials distributed

**Result: Success! Goals exceeded, no incidents, efficient teamwork.**

---

**Team mining is highly efficient when well-coordinated. Use this guide to maximize safety and productivity!**
