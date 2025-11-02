---
name: resource-management
description: Manage inventory, coordinate resource distribution between bots, track material availability, and optimize storage. Use when managing shared resources, checking inventory capacity, or coordinating material needs across multiple bots.
allowed-tools: list_inventory, find_item, open_chest, deposit_items, withdraw_items, send_bot_message, read_bot_messages, send_chat, get_position, move_to_position
---

# Resource Management Skill – Inventory & Multi-Bot Coordination

This skill teaches you how to efficiently manage your inventory, coordinate resource sharing with other bots, and maintain organized storage systems.

## Available Tools

- **list_inventory()** – Get complete inventory snapshot with quantities
- **find_item(name)** – Check if specific item exists and how many
- **open_chest(x, y, z)** – View chest contents at coordinates
- **deposit_items(x, y, z, item_name, count?)** – Store items in chest
- **withdraw_items(x, y, z, item_name, count?)** – Take items from chest
- **send_bot_message(recipient, message, priority?)** – Notify other bots about resources
- **read_bot_messages(mark_as_read?, only_unread?)** – Check resource requests from other bots
- **send_chat(message)** – Announce resource availability to all
- **get_position()** – Know your location for chest coordination
- **move_to_position(x, y, z, range)** – Travel to storage locations

## Core Concepts

### 1. Inventory Capacity
- Bots have **36 inventory slots** (including hotbar)
- Each slot holds 1 stack (typically 64 items for most blocks)
- Tools, weapons, armor count as 1 item per slot
- Always leave 2-3 slots empty for unexpected pickups

### 2. Storage Organization
- **Central Storage**: Main chest for shared materials
- **Personal Storage**: Individual bot caches
- **Work Storage**: Temporary storage near build sites
- **Resource Buffers**: Keep common materials (wood, stone, dirt) readily available

### 3. Resource States
- **Abundant**: >2 stacks available (can share freely)
- **Sufficient**: 1-2 stacks (use carefully, consider restocking)
- **Scarce**: <1 stack (prioritize gathering before sharing)
- **Critical**: <16 items (MUST restock immediately)

## Resource Management Workflows

### A. Check Inventory Status
```
1. Run list_inventory() to see all items
2. Identify resource levels (abundant/sufficient/scarce/critical)
3. Note which slots are empty (available capacity)
4. Report critical shortages via send_chat
```

**Example Output Analysis:**
- "oak_log x64, oak_planks x32, dirt x8" → Oak is abundant, dirt is scarce
- 25 occupied slots → 11 empty slots remaining (good capacity)

### B. Request Resources from Other Bots
```
1. Identify what you need and how much
2. Check if any bot announced availability (read_bot_messages)
3. Send request: send_bot_message("HandelBot", "Need 32 oak_planks for building", "normal")
4. Wait for response (30-60 seconds)
5. Navigate to agreed meeting point
6. Use collect_nearby_items after bot drops resources
```

### C. Provide Resources to Other Bots
```
1. Regularly check for requests: read_bot_messages(only_unread=true)
2. Verify you can spare the items: find_item(requested_item)
3. If abundant/sufficient, confirm via send_bot_message
4. Navigate to requester's location: find_entity + move_to_position
5. Drop requested amount: drop_item(name, count)
6. Confirm delivery: send_bot_message("Delivered 32 oak_planks at your position")
```

### D. Organize Shared Storage
```
1. Designate central storage location (e.g., chest at spawn)
2. Before depositing, check chest: open_chest(x, y, z)
3. Deposit excess abundant resources: deposit_items(x, y, z, "cobblestone", 64)
4. Announce availability: send_chat("Deposited 64 cobblestone in central storage at (100, 64, 100)")
5. Before gathering trips, check if others need anything
6. Withdraw scarce materials only when needed
```

### E. Inventory Optimization
```
1. Before gathering: ensure 10+ empty slots
2. After gathering: consolidate partial stacks
3. If inventory full: find nearest chest, deposit excess
4. Keep tools in hotbar slots 1-4 for quick access
5. Stack similar materials (don't keep oak_log in 3 different slots)
```

## Best Practices

### Communication Protocols

**Announcing Availability:**
```
send_chat("I have 128 oak_logs available for sharing")
```

**Requesting Resources:**
```
send_bot_message("SammelBot", "Need 64 cobblestone for building project. Can you gather?", "normal")
```

**Delivery Confirmation:**
```
send_bot_message("BauBot", "Dropped 64 cobblestone at (120, 64, 95)", "high")
```

**Resource Alerts:**
```
send_chat("WARNING: We're low on wood (only 12 logs). Prioritizing gathering.")
```

### Storage Discipline

1. **Before depositing**: Check what's already in chest to avoid duplicate stacks
2. **Label storage locations**: Announce chest purposes ("Wood storage at (100,64,100)")
3. **Stack management**: Consolidate partial stacks before storing
4. **Regular audits**: Every 30 minutes, check central storage and report status

### Resource Sharing Rules

**Share freely** (abundant):
- Common materials: dirt, cobblestone, oak_log
- After successful gathering: "Got 3 stacks, can share 2"

**Ask before sharing** (sufficient):
- Mid-tier materials: stone tools, iron ore
- "I have 1 stack of iron_ore, need it for X, but can share after"

**Don't share** (scarce/critical):
- Food when hunger < 10
- Tools currently in use
- Materials for active project
- "Sorry, need my last 8 planks for current build"

### Multi-Bot Coordination Patterns

**Gathering Coordination:**
```
HandelBot: "I'm gathering wood east of spawn"
SammelBot: "I'll mine stone south of spawn, no overlap"
```

**Build Material Pooling:**
```
BauBot: "Starting wall build, need 200 cobblestone"
GräberBot: "I have 128, will deliver now"
SammelBot: "I'll gather remaining 72"
```

**Emergency Requests:**
```
SpähBot: "Urgent: Attacked by mobs, need food!"
[Anyone nearby]: send_bot_message("SpähBot", "Dropping 8 cooked_beef at your position", "high")
```

## Common Scenarios

### Scenario 1: Inventory Full During Gathering
```
1. Check position: get_position()
2. Find nearest known storage or place temporary chest
3. Deposit excess: deposit_items(x, y, z, abundant_material, 64)
4. Mark location: send_chat("Temp storage at (X,Y,Z)")
5. Continue gathering
6. Return later to collect
```

### Scenario 2: Multiple Bots Need Same Resource
```
Bot A requests 64 oak_planks
Bot B requests 32 oak_planks
Your inventory: 80 oak_planks

1. Assess priority (who asked first? what's urgent?)
2. Distribute fairly: 48 to Bot A, 32 to Bot B
3. Explain: send_bot_message("Split my supply: 48 for you, 32 for BauBot")
4. Deliver to both in sequence
5. If shortage: "Need 16 more planks, will gather"
```

### Scenario 3: Preparing for Large Build
```
BauBot requests: "Need 500 cobblestone, 200 planks, 64 torches"

Coordinator approach:
1. Check storage: open_chest(central_storage_x, y, z)
2. Inventory check: find_item("cobblestone"), etc.
3. Calculate deficit
4. Broadcast: send_chat("Build needs 500 cobble (have 200), 200 planks (have 150), 64 torches (have 0)")
5. Assign gathering: "SammelBot gather 300 cobble, HandelBot craft 50 planks + 64 torches"
6. Set deadline: "All materials to BauBot by [time estimate]"
```

## Error Handling

**Chest not found:**
```
open_chest fails → "Chest at (X,Y,Z) not accessible. Verify coordinates or place chest first"
```

**Insufficient items to share:**
```
Request for 64, have 32 → "I only have 32 [item]. Can provide half now, gather rest?"
```

**Inventory full during withdraw:**
```
withdraw_items fails → "Inventory full. Depositing excess first..."
→ deposit_items (other materials) → retry withdraw
```

**Bot unreachable:**
```
Can't find bot after send_bot_message → "HandelBot, confirm your position. I'm at (X,Y,Z) with your materials"
```

## Performance Metrics

Track these mentally during play:

- **Inventory utilization**: % of slots occupied (aim for 60-80% during normal play)
- **Response time**: How fast requests are fulfilled (<5 minutes = good)
- **Waste prevention**: Items dropped/despawned (should be near zero)
- **Resource buffer**: Always maintain 1 stack of common materials
- **Storage efficiency**: Chest usage (don't overflow, don't leave nearly empty)

## Integration with Other Skills

**Works with Tree-Felling:**
- Before felling: Check inventory space for logs
- After felling: Offer excess logs to other bots

**Works with Building:**
- Before building: Gather required materials from storage
- During building: Request missing materials from gatherers
- After building: Return unused materials to storage

**Works with Trading:**
- Trading IS resource management in motion
- Use trading skill for physical handoffs
- Use this skill for planning and coordination

**Works with Mining:**
- Before mining expedition: Ensure 15+ empty slots
- During mining: Monitor ore accumulation
- After mining: Deposit ores, announce availability

## When NOT to Use This Skill

- Don't use for combat inventory (weapons/armor) → use combat skill
- Don't use for farming inventory (seeds/bone meal) → use farming skill
- Don't use for complex crafting chains → use crafting skill
- Use this skill for COORDINATION and STORAGE, not execution

## Example Commands

- "Check my inventory and report status"
- "Do we have enough oak planks for a 10x10 platform?"
- "Request 64 cobblestone from the closest bot"
- "Deposit all my excess stone in central storage"
- "What resources are scarce right now?"
- "Organize the central chest at spawn"
