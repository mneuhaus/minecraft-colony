---
name: combat
description: Defend against hostile mobs, manage health and safety, and employ survival tactics. Use for threat assessment, defensive building, mob avoidance, direct combat, and health management.
allowed-tools: equip_item, get_position, move_to_position, find_entity, place_block, dig_block, build_pillar, list_inventory, send_chat, send_bot_message, get_health, eat_food, attack_entity
---

# Combat Skill – Defense and Survival

This skill teaches you how to defend against hostile mobs, manage survival situations, employ tactical strategies for safety, engage in direct combat, and manage health in Minecraft.

## Available Tools

### Movement & Detection
- **get_position()** – know your location for tactical decisions
- **move_to_position(x, y, z, range)** – flee or reposition tactically
- **find_entity(entityType, maxDistance)** – detect nearby mobs or players

### Equipment & Inventory
- **equip_item(name)** – equip weapons, armor, or tools
- **list_inventory()** – check available weapons and armor

### Defensive Building
- **place_block(x, y, z, block_type)** – create defensive structures
- **dig_block(x, y, z)** – create escape routes or traps
- **build_pillar(height)** – quickly gain height advantage

### Combat & Survival
- **get_health()** – check current health, hunger, and saturation status
- **eat_food(food_item)** – eat food to restore health and hunger (optional food_item parameter)
- **attack_entity(entity_type, max_distance)** – attack a nearby hostile mob within specified distance

### Communication
- **send_chat(message)** – call for help
- **send_bot_message(recipient, message, priority)** – request backup

## Hostile Mobs and Threats

### Common Hostile Mobs

| Mob | Spawns | Range | Damage | Special Abilities |
|---|---|---|---|---|
| **Zombie** | Dark areas, night | Melee | Low-Medium | Can break doors (hard mode) |
| **Skeleton** | Dark areas, night | 15 blocks | Medium | Shoots arrows, burns in daylight |
| **Creeper** | Dark areas, night | 3 blocks | Explosion | Silent, destroys blocks |
| **Spider** | Dark areas, night | Melee | Low | Can climb walls |
| **Enderman** | Anywhere, night | Melee | High | Teleports, don't look at eyes |
| **Witch** | Swamps, night | 10 blocks | Potions | Throws splash potions |
| **Zombie Piglin** | Nether | Melee | Medium | Neutral until provoked, pack mentality |
| **Blaze** | Nether fortresses | 16 blocks | Fire | Shoots fireballs, flies |
| **Cave Spider** | Mineshafts | Melee | Low | Poison effect, small hitbox |

### Environmental Hazards

- **Lava**: Instant damage, destroys items
- **Cacti**: Contact damage
- **Fall damage**: >3 blocks causes damage
- **Drowning**: No air underwater after ~15 seconds
- **Fire**: Burning entities take damage over time
- **Suffocation**: Being inside blocks

## Combat Readiness

### Equipment Check

**Before venturing out**:
```
1. list_inventory() → Check what you have
2. Verify armor (helmet, chestplate, leggings, boots)
3. Verify weapons (sword, bow, arrows)
4. Verify food (healing/hunger management)
5. Verify tools (pickaxe for emergency escape)
```

**Optimal Loadout** (survival mode):
- **Armor**: Full set (iron or diamond preferred)
- **Primary weapon**: Diamond/Iron Sword
- **Ranged weapon**: Bow + 64 arrows
- **Food**: 32+ cooked meat or bread
- **Blocks**: 64 cobblestone (defensive building)
- **Tools**: Iron pickaxe (emergency mining)
- **Torch**: 32+ torches (light prevents spawns)

**Equipping Items**:
```
# Equip sword before combat
equip_item("iron_sword")

# Equip bow for ranged combat
equip_item("bow")

# Equip armor
equip_item("iron_helmet")
equip_item("iron_chestplate")
equip_item("iron_leggings")
equip_item("iron_boots")
```

## Defensive Strategies

### Strategy 1: Avoidance (Recommended for Bots)

**Threat Detection**:
```
1. find_entity("zombie", maxDistance=20)
   → Returns positions of all zombies within 20 blocks

2. If mob detected:
   - Calculate distance
   - If distance < 10 blocks → Take defensive action

3. Defensive action:
   - move_to_position(safe_x, safe_y, safe_z) → Flee
   - OR build_pillar(5) → Get out of reach
```

**Example - Flee from Creeper**:
```
1. find_entity("creeper", 15) → Detect creeper
2. If creeper found:
   my_pos = get_position()
   # Move 20 blocks away in opposite direction
   move_to_position(my_pos.x + 20, my_pos.y, my_pos.z)
   send_chat("Creeper detected, retreating!")
```

### Strategy 2: Pillaring (Height Advantage)

**Quick Escape**:
```
1. Mob approaching
2. build_pillar(5) → Jump up 5 blocks
3. Mob cannot reach you
4. Wait for:
   - Day (skeletons/zombies burn)
   - Mob to wander away
5. Descend safely when clear
```

**Limitations**:
- Spiders can climb (not effective against spiders)
- Endermen can teleport
- Skeletons can still shoot you

### Strategy 3: Defensive Structure

**Quick Wall**:
```
1. Mob detected
2. Get current position: pos = get_position()
3. Build wall between you and mob:
   place_block(pos.x + 1, pos.y, pos.z, "cobblestone")
   place_block(pos.x + 1, pos.y + 1, pos.z, "cobblestone")
   place_block(pos.x + 1, pos.y + 2, pos.z, "cobblestone")
4. Mob cannot pass through wall
```

**Shelter Construction** (if surrounded):
```
1. pos = get_position()
2. Build 3-block tall walls on all sides:
   North: place_block(pos.x, pos.y, pos.z - 1, "cobblestone") [+2 more blocks up]
   South: place_block(pos.x, pos.y, pos.z + 1, "cobblestone") [+2 more blocks up]
   East: place_block(pos.x + 1, pos.y, pos.z, "cobblestone") [+2 more blocks up]
   West: place_block(pos.x - 1, pos.y, pos.z, "cobblestone") [+2 more blocks up]
3. Add roof: place_block(pos.x, pos.y + 3, pos.z, "cobblestone")
4. Wait inside until safe
```

### Strategy 4: Environmental Manipulation

**Use terrain to your advantage**:

**Water Bucket** (if available):
```
- Place water between you and mob
- Mobs slow down in water
- Extinguishes fire
- Negates fall damage
```

**Lava Moat** (creative mode or if lava bucket available):
```
- Place lava between you and mobs
- Most mobs burn in lava
- Caution: Items also burn in lava!
```

**Door Barrier**:
```
- Zombies cannot open doors (on normal difficulty)
- Close door behind you when entering building
- Safe spot to wait out night
```

## Mob-Specific Tactics

### Creepers (Explosive Threat)

**Behavior**:
- Silent approach
- Hisses when within 3 blocks
- Explodes after 1.5 second fuse

**Defense**:
```
1. find_entity("creeper", 20) → Early detection is key!
2. If creeper within 10 blocks:
   - Immediately move_to_position() away
   - Minimum 8 block distance recommended
3. If creeper hissing (too close):
   - Sprint away immediately
   - OR build_pillar(3) to get out of explosion radius
```

### Skeletons (Ranged Threat)

**Behavior**:
- Shoots arrows from 15 blocks away
- Burns in daylight
- Pathfinds toward player

**Defense**:
```
1. Detection: find_entity("skeleton", 20)
2. Options:
   A) Flee: move_to_position() behind cover
   B) Block: Build wall with place_block()
   C) Wait: If daytime, skeleton will burn soon
```

**Cover Construction**:
```
pos = get_position()
# Build wall between you and skeleton
place_block(pos.x + direction, pos.y, pos.z, "cobblestone")
place_block(pos.x + direction, pos.y + 1, pos.z, "cobblestone")
# Peek over wall to check if skeleton is still there
```

### Endermen (Teleporting Threat)

**Behavior**:
- Neutral until provoked
- Provoked by: Looking at face, attacking
- Teleports when attacked or touched by water
- Very high damage

**Defense**:
```
1. DO NOT look directly at Endermen (avoid find_entity on them)
2. If accidentally provoked:
   Option A: Build 2-block-tall shelter (Endermen are 3 blocks tall, cannot enter)
   Option B: Stand in water (they teleport away from water)
3. Shelter:
   - 2 blocks tall ceiling
   - Enderman cannot fit
```

### Zombies (Melee Threat)

**Behavior**:
- Slow movement
- Melee range only
- Burns in daylight
- Can break doors (hard difficulty)

**Defense**:
```
1. Easy to outrun: move_to_position() away
2. Wait for day: Zombies burn in sunlight
3. Height advantage: build_pillar(3)
```

## Survival Situations

### Surrounded by Mobs

**Emergency Protocol**:
```
1. send_chat("Under attack! Multiple mobs!")
2. send_bot_message("ALL_BOTS", f"Emergency at {get_position()}, need help!", "high")
3. build_pillar(10) → Get height immediately
4. Wait on top of pillar
5. Options:
   - Wait for day (zombies/skeletons burn)
   - Build bridge to safety
   - Wait for backup
```

### Low Health (Survival Mode)

**Priority**: Get to safety and heal
```
1. get_health() → Assess current HP status
2. If health < 50%:
   a) find_entity("*", 30) → Check for nearby threats
   b) If threats present:
      - Flee: move_to_position() to safe location
      - Or Shelter: Build defensive structure with place_block()
   c) Once safe:
      - list_inventory() → Check for food
      - eat_food() → Restore health and hunger
      - get_health() → Verify health is improving
   d) Wait for health regeneration (requires full hunger bar)
   e) Do NOT re-engage until health > 80%
```

**Health regeneration mechanics**:
- Hunger bar must be at least 18/20 (90%) for health to regenerate
- Health regenerates 1 HP every 0.5 seconds when hunger is full
- Eating food restores hunger, enabling regeneration

### Lost in Cave with Mobs

**Cave Escape Protocol**:
```
1. get_position() → Note your Y-coordinate
2. Light up immediate area:
   - place_block() torches around you
   - Prevents new mob spawns
3. Build safe room:
   - 3x3x3 cobblestone box
   - Door or entrance hole
4. Wait inside until health is stable
5. Dig staircase to surface (never straight up!):
   - Diagonal staircase pattern
   - Place torches as you go
6. Once at surface (Y > 60), flee to base
```

### Night Caught Outside

**Nighttime Survival**:
```
1. send_chat("Night falling, seeking shelter")
2. Options (in order of preference):
   A) Navigate to known safe base: move_to_position(base_x, base_y, base_z)
   B) Find natural shelter (cave, building)
   C) Build emergency shelter:
      - 3x3 cobblestone box
      - Roof
      - Light interior with torches
   D) If surrounded: build_pillar(10) and wait out the night
```

## Multi-Bot Combat Coordination

### Requesting Backup

```
# When under attack
my_pos = get_position()
send_bot_message("BauBot", f"Under attack at ({my_pos.x}, {my_pos.y}, {my_pos.z}), need rescue!", "high")
send_bot_message("GräberBot", f"Mobs at ({my_pos.x}, {my_pos.y}, {my_pos.z}), bringing weapons", "high")

# Build emergency shelter while waiting
build_pillar(5)
send_chat("Built emergency pillar, waiting for backup")
```

### Rescue Operations

```
# Rescuing bot receives distress call
1. read_bot_messages() → Get coordinates
2. Prepare:
   - equip_item("iron_sword")
   - equip_item("iron_helmet")  # All armor pieces
3. Navigate to location: move_to_position(distress_x, distress_y, distress_z)
4. Build protective wall around distressed bot
5. Escort back to safety
```

## Health Management

### Checking Your Status

Use `get_health()` to get a complete health report:
```
get_health() → Returns:
- Health: 18.5/20 HP (93%) - Healthy
- Hunger: 15/20 (75%) - Satisfied
- Saturation: 3.2
- Status Assessment with recommendations
```

**When to check health**:
- After taking damage
- Before engaging in combat
- When planning dangerous activities (mining, exploration)
- Periodically during long sessions

### Eating Food

Use `eat_food()` to restore health and hunger:
```
# Eat any available food
eat_food()

# Eat specific food item
eat_food(food_item="cooked_beef")
```

**Common food items**:
- **Cooked meats**: cooked_beef, cooked_porkchop, cooked_chicken, cooked_mutton
- **Bread & baked goods**: bread, baked_potato, cookie, pumpkin_pie
- **Fish**: cooked_cod, cooked_salmon
- **Fruits & vegetables**: apple, golden_apple, carrot, beetroot, melon_slice

**Health regeneration**:
- With full hunger bar (20/20): Health regenerates automatically
- Eating restores hunger, which enables health regeneration
- Golden apples provide instant health boost

### Direct Combat

Use `attack_entity()` to engage hostile mobs:
```
# Attack nearest zombie within 10 blocks
attack_entity(entity_type="zombie", max_distance=10)

# Attack nearest skeleton within 15 blocks
attack_entity(entity_type="skeleton", max_distance=15)
```

**Combat workflow**:
```
1. get_health() → Check if ready for combat (>80% HP recommended)
2. equip_item("iron_sword") → Equip best weapon
3. find_entity("zombie", 20) → Locate target
4. attack_entity(entity_type="zombie", max_distance=10) → Engage
5. get_health() → Check health after combat
6. eat_food() → Heal if needed
```

**Combat considerations**:
- Bot will automatically equip best weapon (sword/axe/trident)
- Bot will move closer if target is beyond melee range (~3 blocks)
- May need multiple attacks to kill mob
- Entity may still be alive after one attack - check and continue if necessary

## Combat Limitations (Additional Tools Needed)

### Not Yet Implemented via Tools

**Advanced Attack Functions**:
- ❌ `shoot_bow(target_x, target_y, target_z)` - Ranged combat with bow
- ❌ `use_shield()` - Block incoming attacks
- ❌ `sprint_attack()` - Critical hits with sprinting

**Status Checks**:
- ❌ `get_armor_durability()` - Check armor condition
- ❌ `check_status_effects()` - Poison, regeneration, etc.

**Mob Information**:
- ❌ `get_mob_health(entityId)` - How damaged is the mob
- ❌ `get_mob_type(entityId)` - What specific mob type

### Combat Strategy Options

**Defensive approach** (recommended for most bots):
- Use avoidance strategies (flee, pillar, wall)
- Wait for environmental kills (daylight for zombies/skeletons)
- Rely on defensive structures

**Offensive approach** (with new combat tools):
- Check health status with `get_health()`
- Engage with `attack_entity()` when health is good
- Eat food with `eat_food()` to maintain health
- Retreat if health drops below 50%

## Combat Best Practices

✅ **Do:**
- **Detect early**: Use `find_entity()` frequently (every 5-10 seconds when in danger zones)
- **Flee first**: Avoidance is safer than fighting for bots
- **Use height**: Pillaring is quick and effective
- **Light areas**: Prevent spawns with torches (use `place_block()`)
- **Travel during day**: Fewer hostile mobs in daylight
- **Carry blocks**: Always have 64 cobblestone for defensive building
- **Call for help**: Use `send_bot_message()` when in danger

❌ **Don't:**
- Don't engage in combat unless absolutely necessary (no direct attack tools)
- Don't provoke Endermen (never look at them)
- Don't explore caves without torches and blocks
- Don't venture far at night without preparation
- Don't forget to check surroundings (`find_entity()`) regularly

## Threat Assessment Workflow

**Continuous Monitoring** (when in potentially dangerous areas):
```
Every 10 seconds:
1. find_entity("zombie", 25)
2. find_entity("skeleton", 25)
3. find_entity("creeper", 25)
4. find_entity("spider", 25)

If any mob found within 15 blocks:
→ Assess threat level
→ Take defensive action (flee, pillar, or shelter)

If mob within 5 blocks:
→ IMMEDIATE ACTION: build_pillar() or flee
```

## Integration with Other Skills

- **Navigation Skill**: Flee to safe waypoints, navigate away from danger
- **Building Skill**: Construct defensive structures, shelters
- **Mining Skill**: Emergency escape tunnels, underground safety
- **Trading Skill**: Request weapons/armor from other bots

## Combat Tools Status

### ✅ Implemented
- **get_health()** - Check health, hunger, and saturation status
- **eat_food(food_item)** - Restore health and hunger
- **attack_entity(entity_type, max_distance)** - Engage in melee combat

### ⏳ Future Combat Tools

To enable advanced combat functionality, these tools would be helpful:
```
- shoot_bow(entityId): Ranged combat with bow
- use_shield(): Block incoming attacks
- get_armor_durability(): Check armor condition
- check_status_effects(): Monitor potion effects
- get_mob_health(entityId): Check enemy HP
- sprint_attack(entityId): Critical hit attacks
- equip_shield(): Quick shield equipping
```

## Example Combat Scenarios

**Scenario: Creeper approaching while mining**
```
1. find_entity("creeper", 20) → Creeper detected 12 blocks away
2. send_chat("Creeper nearby, taking cover!")
3. build_pillar(5) → Get height advantage
4. Wait 30 seconds
5. Creeper wanders away or despawns
6. Descend safely and continue mining
```

**Scenario: Night falling while far from base**
```
1. get_position() → (250, 67, -190), base at (0, 64, 0)
2. Calculate: Too far to reach base before night (>300 blocks)
3. Build emergency shelter:
   - 4x4 cobblestone box with roof
   - Place torches inside
   - Door or 2-block entrance (jump to enter, blocks mobs)
4. send_chat("Built emergency shelter at (250, 67, -190), waiting out night")
5. Wait until day
6. Resume travel to base
```

**Scenario: Multiple zombies in cave**
```
1. find_entity("zombie", 20) → 3 zombies detected
2. get_position() → Deep underground (Y=15)
3. Cannot flee to surface quickly
4. Build safe room:
   - 3x3x3 cobblestone box
   - Light with torches
   - Wait inside
5. send_bot_message("HandelBot", "Trapped in cave at (X, 15, Z), multiple zombies", "high")
6. Wait for:
   - Zombies to despawn (if far from their spawn point)
   - Backup to arrive
   - Safe moment to dig escape tunnel
```

**Scenario: Direct combat with hostile mob (using new tools)**
```
1. get_health() → Check status: 20/20 HP, 18/20 hunger - Excellent condition
2. find_entity("zombie", 20) → Zombie detected 8 blocks away
3. list_inventory() → Verify weapons: iron_sword available
4. equip_item("iron_sword") → Equip weapon
5. attack_entity(entity_type="zombie", max_distance=10) → Engage combat
   → Result: "Attacked zombie at distance 7.2 blocks. Entity still alive - continue attacking"
6. attack_entity(entity_type="zombie", max_distance=10) → Second attack
   → Result: "Successfully killed zombie! Weapon used: iron_sword"
7. get_health() → Check after combat: 17.5/20 HP, 17/20 hunger
8. eat_food(food_item="cooked_beef") → Restore health
9. get_health() → Verify: 18.0/20 HP, 20/20 hunger - Health regenerating
```

**Scenario: Low health emergency with new tools**
```
1. get_health() → Critical status: 6.5/20 HP (33%), 8/20 hunger - CRITICAL HEALTH!
2. find_entity("skeleton", 30) → Skeleton 15 blocks away
3. IMMEDIATE ACTION: build_pillar(10) → Get to safety
4. list_inventory() → Check food: cooked_chicken x3, bread x5
5. eat_food(food_item="cooked_chicken") → Restore hunger
   → Result: "Health: 6.5 → 7.0 HP, Hunger: 8 → 14"
6. eat_food(food_item="bread") → Continue eating
   → Result: "Health: 7.0 → 7.5 HP, Hunger: 14 → 19"
7. get_health() → Check status: 9.5/20 HP, 19/20 hunger - Still injured but regenerating
8. Wait on pillar for full health regeneration
9. send_bot_message("ALL_BOTS", "Recovering from combat at (X, Y, Z), health stabilizing", "medium")
10. Once health > 15 HP: Safely descend and continue
```

## When NOT to Use This Skill

- **In peaceful mode** → No hostile mobs spawn
- **In creative mode** → You're invulnerable (but skill still useful for awareness)
- **For harvesting mobs** → Different skill needed (mob farming)
- **For PvP** → Player vs Player combat requires different strategies

This skill is specifically for **defense, threat avoidance, and survival tactics** against hostile mobs and environmental hazards.
