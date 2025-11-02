---
name: night-safety
description: Protect bots during nighttime by detecting dangerous conditions and taking safety actions. Use when it's getting dark, hostile mobs are spawning, or the bot needs shelter. Critical for survival in dangerous situations.
allowed-tools: detect_time_of_day, get_position, move_to_position, list_waypoints, get_waypoint, find_nearest_waypoint, find_flat_area, place_block, dig_block, send_chat, send_bot_message, equip_item, list_inventory
---

# Night Safety Skill – Survival During Dangerous Times

Protect bots from hostile mob spawning during night, dusk, and other dangerous conditions.

## Overview

In Minecraft, hostile mobs (zombies, skeletons, creepers, spiders) spawn in darkness. Bots must take safety precautions when night falls or when entering dark areas.

**Critical times:**
- **Dusk (18:00-19:00)**: Time to seek shelter
- **Night (19:00-6:00)**: Full danger period
- **Dawn (6:00-7:00)**: Mobs start burning, becoming safer

## Strategy

### 1. Monitor Time Constantly

Use `detect_time_of_day` regularly to track Minecraft time:
- Check every 5-10 minutes of activity
- React immediately when status shows "DANGEROUS"
- Plan ahead when approaching dusk

**Example output:**
```
Current time: 18:15 (12260 ticks)
Time of day: dusk
Day/Night: NIGHT
Status: ✗ DANGEROUS (hostile mobs spawning)
Time until day: 9m 47s (11740 ticks)
```

### 2. Safety Response Hierarchy

When `detect_time_of_day` returns **DANGEROUS**:

#### Option A: Return to Known Shelter (Preferred)
1. `list_waypoints` - Find shelter waypoints
2. `find_nearest_waypoint` - Get closest safe location
3. `move_to_position` - Navigate to shelter
4. Stay inside until dawn

#### Option B: Find Existing Shelter
1. `find_block(blockType="oak_door")` - Look for existing buildings
2. Move to nearest door
3. Enter and close door behind you

#### Option C: Create Emergency Shelter (Last Resort)
1. `find_flat_area` - Find quick build spot
2. Dig down 3 blocks
3. Place block above head
4. Wait until dawn in underground hole
5. Never dig straight down without safety!

### 3. Underground Mining Exception

**Mining bots can work safely underground during night!**
- Y-level < 50 is safe (no natural light)
- Continue mining, caving, tunneling
- Check health regularly
- Keep torches for lighting work areas

### 4. Communication Protocol

When seeking shelter, inform other bots:
```
send_bot_message("Kubo: Nightfall approaching, heading to shelter at (100, 64, 50)")
```

When reaching safety:
```
send_bot_message("Kubo: Safe in shelter, will resume at dawn")
```

## Common Patterns

### Pattern 1: Pre-emptive Shelter Seeking
```
# Check time every 10 minutes
detect_time_of_day()
# If "dusk" detected:
→ find_nearest_waypoint()
→ move_to_position(waypoint.x, waypoint.y, waypoint.z)
→ send_bot_message("Heading to shelter for night")
```

### Pattern 2: Emergency Dig-Down
```
# When caught in the open at night:
get_position() → current = (x, y, z)
dig_block(x, y-1, z)  # Dig down
dig_block(x, y-2, z)  # Dig down
dig_block(x, y-3, z)  # Dig down
move_to_position(x, y-3, z)  # Jump in hole
place_block("dirt", x, y-1, z)  # Cover overhead
# Wait until dawn
```

### Pattern 3: Deep Mining (Safe)
```
get_position() → current
# If current.y < 50:
  send_chat("I'm deep underground, safe from night mobs")
  # Continue mining normally
# Else:
  # Follow shelter protocol
```

## Mistakes to Avoid

❌ **Don't ignore time checks** - Always monitor time during surface activities
❌ **Don't travel at night** - Even short distances are dangerous
❌ **Don't assume buildings are safe** - Check for doors and walls
❌ **Don't panic** - Follow the hierarchy calmly
❌ **Don't fight unless necessary** - Evasion is safer than combat

✅ **Do plan ahead** - Start moving to shelter at dusk
✅ **Do create waypoints** - Mark safe locations for future use
✅ **Do communicate** - Tell other bots your safety status
✅ **Do work underground** - Mining is safe during night
✅ **Do wait patiently** - Dawn always comes

## Integration with Other Skills

**Building Skill**: Create proper shelters with doors and lighting
**Mining Skill**: Work safely underground during night
**Combat Skill**: Emergency mob defense if shelter fails
**Navigation Skill**: Waypoint all shelters for quick access

## Example Workflow

```
1. Bot is gathering wood at (120, 65, 80)
2. detect_time_of_day() → "dusk, DANGEROUS"
3. list_waypoints() → "home" at (100, 64, 50), 30 blocks away
4. send_bot_message("Kubo: Night approaching, heading home")
5. move_to_position(100, 64, 50)
6. send_chat("Sicher im Haus! Warte auf Sonnenaufgang.")
7. Wait until detect_time_of_day() → "day, SAFE"
8. Resume gathering wood
```

## Time Reference

**Minecraft Day Cycle** (24000 ticks = 20 real minutes):
- **0-12000**: Day (SAFE) ☀️
- **12000-13000**: Dusk (transition) 🌅
- **13000-23000**: Night (DANGEROUS) 🌙
- **23000-24000**: Dawn (transition) 🌄

**Mob Spawning**: Requires light level < 7
- Surface at night: Light level 0-4 (mobs spawn)
- Underground: Depends on torches
- Inside buildings: Safe if well-lit

## Testing Checklist

- [ ] Bot detects nightfall correctly
- [ ] Bot seeks shelter at dusk
- [ ] Bot finds nearest waypoint successfully
- [ ] Emergency dig-down works
- [ ] Bot resumes activities at dawn
- [ ] Underground mining continues during night
- [ ] Messages sent to other bots
- [ ] No deaths during night

---

**Remember**: "When in doubt, dig down and wait it out!" Better safe than respawned.
