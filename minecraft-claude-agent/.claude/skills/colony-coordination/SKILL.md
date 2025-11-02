---
name: colony-coordination
description: Coordinate multi-bot operations, assign tasks, manage bot status updates, and orchestrate complex colony-wide projects. Use when multiple bots need to work together, tasks need delegation, or colony-wide coordination is required.
allowed-tools: send_bot_message, read_bot_messages, send_chat, get_position, get_health, list_inventory, read_diary_entries, set_waypoint, list_waypoints
---

# Colony Coordination Skill  Multi-Bot Orchestration

This skill teaches you how to coordinate effectively with other bots in the colony, delegate tasks, share status updates, and work together on complex projects.

## Available Tools

### Communication
- **send_bot_message(recipient, message, priority)**  Send direct messages to specific bots
- **read_bot_messages(mark_as_read, only_unread)**  Check messages from other bots
- **send_chat(message)**  Broadcast to all players and bots
- **read_diary_entries(limit)**  Review recent bot actions and decisions

### Status & Position
- **get_position()**  Know current coordinates for coordination
- **get_health()**  Report health status to colony
- **list_inventory()**  Share inventory status with others

### Navigation & Memory
- **set_waypoint(name, x, y, z, description)**  Mark important colony locations
- **list_waypoints()**  View all marked locations

## Core Concepts

### 1. Bot Roles in the Colony

**Current Active Bots (from bots.yaml):**

- **HandelBot** (Trader/Merchant)
  - Primary: Trading with villagers, acquiring rare items
  - Skills: Trading, navigation, resource-management
  - Communication: Announces trade opportunities, requests emeralds

- **SammelBot** (Gatherer/Collector) - **YOU**
  - Primary: Resource gathering (wood, food, basic materials)
  - Skills: Tree-felling, exploration, resource-management
  - Communication: Reports resource locations, fulfills gathering requests

- **BauBot** (Builder/Constructor)
  - Primary: Construction projects, infrastructure
  - Skills: Building, crafting, resource-management
  - Communication: Requests materials, announces build progress

- **GräberBot** (Miner/Excavator)
  - Primary: Mining operations, stone/ore gathering
  - Skills: Mining, crafting (smelting), resource-management
  - Communication: Reports ore finds, requests mining tasks

- **SpähBot** (Scout/Explorer)
  - Primary: Exploration, reconnaissance, waypoint creation
  - Skills: Exploration, navigation, combat (self-defense)
  - Communication: Reports discoveries, marks points of interest

### 2. Communication Hierarchy

**Message Priorities:**

- **HIGH Priority** (Red alert - immediate action required)
  - Bot in danger (health < 6, surrounded by mobs)
  - Critical resource shortage affecting multiple bots
  - Emergency requests (food, tools, rescue)
  - System failures or bot disconnections

- **NORMAL Priority** (Standard operations)
  - Task requests and assignments
  - Resource sharing coordination
  - Project updates and progress reports
  - Location sharing and meetup coordination

- **LOW Priority** (Informational, non-urgent)
  - Status updates and routine check-ins
  - Resource availability announcements
  - Waypoint creation notifications
  - General observations and notes

### 3. Task Delegation System

**Task Request Format:**
```
TASK: [Action] [Details] [Deadline/Priority]

Examples:
- "TASK: Gather 64 oak_logs from forest waypoint by next day cycle"
- "TASK: Mine 128 cobblestone, no rush"
- "TASK: Explore north 200 blocks, mark waypoints"
```

**Task Acceptance Format:**
```
ACCEPT: [Task ID/Description] [ETA]

Examples:
- "ACCEPT: Gathering 64 oak_logs. ETA 10 minutes"
- "ACCEPT: Mining 128 cobble. Starting now"
```

**Task Completion Format:**
```
COMPLETE: [Task] [Result] [Location if relevant]

Examples:
- "COMPLETE: Gathered 68 oak_logs. Deposited at storage_wood"
- "COMPLETE: Mined 130 cobblestone. Ready for pickup at (150,64,200)"
```

## Coordination Workflows

### Workflow A: Status Check-In (Routine)

**When:** Every 30 minutes or when requested

**Steps:**
```
1. Check own status:
   health = get_health()
   position = get_position()
   inventory = list_inventory()

2. Read messages:
   messages = read_bot_messages()

3. Summarize status:
   - Health: 20/20
   - Position: (134, 64, 126)
   - Inventory: 4 items (jungle_log x22, jungle_planks x46, netherite_axe x1, stick x3)
   - Active Task: None
   - Available: Yes

4. Broadcast if requested or significant change:
   send_chat("SammelBot status: Healthy, 22 jungle_log in inventory, ready for tasks")

5. Respond to any pending messages
```

### Workflow B: Task Request & Assignment

**Scenario:** BauBot needs materials for a building project

**BauBot (Requester):**
```
1. Identify need:
   "Need 64 oak_planks for house construction"

2. Determine best bot:
   SammelBot = gatherer (perfect for this)
   OR check storage first (resource-management skill)

3. Send request:
   send_bot_message("SammelBot",
     "TASK: Need 64 oak_planks for house at (200,64,150). Can you gather and deliver?",
     "normal")

4. Wait for confirmation (check read_bot_messages every 2 minutes)

5. When confirmed:
   "Thank you! I'll wait at (200,64,150)"
```

**SammelBot (YOU - Executor):**
```
1. Check messages:
   read_bot_messages() ’ Sees BauBot's request

2. Assess feasibility:
   list_inventory() ’ Check current oak resources
   Check if can gather (time, tools available)

3. Accept task:
   send_bot_message("BauBot",
     "ACCEPT: Gathering 64 oak_planks. ETA 15 minutes",
     "normal")

4. Execute task:
   [Use tree-felling skill to gather oak_logs]
   [Craft oak_planks]

5. Deliver:
   move_to_position(200, 64, 150, range=5)
   drop_item("oak_planks", 64)
   send_bot_message("BauBot",
     "COMPLETE: 64 oak_planks delivered at (200,64,150)",
     "normal")
```

### Workflow C: Colony-Wide Project Coordination

**Scenario:** Building a central storage facility (requires all bots)

**Project Coordinator (e.g., BauBot):**
```
1. Announce project:
   send_bot_message("ALL_BOTS",
     "PROJECT: Building central storage at (100,64,100). Need:\n- 200 oak_planks\n- 300 cobblestone\n- 50 glass\n- 10 chests\nWho can help?",
     "high")

2. Wait for responses (5 minutes)

3. Read commitments:
   read_bot_messages()
   ’ SammelBot: "Can provide 100 oak_planks"
   ’ GräberBot: "Can mine 300 cobblestone"
   ’ HandelBot: "Will trade for 50 glass and 10 chests"
   ’ SpähBot: "Can gather remaining 100 planks"

4. Assign deadlines:
   send_bot_message("ALL_BOTS",
     "Great! Please deliver materials to (100,64,100) by sunset. I'll start foundation.",
     "high")

5. Track progress:
   Every 10 minutes: "Status check: Who has delivered?"

6. Confirm completion:
   "All materials received! Starting construction. Thank you team!"
```

**Each Bot (Including YOU):**
```
1. Read project announcement:
   read_bot_messages() ’ See PROJECT message

2. Assess contribution:
   "I can provide 100 oak_planks (have 50, can gather 50 more)"

3. Commit:
   send_bot_message("BauBot",
     "Can provide 100 oak_planks. Will deliver by sunset",
     "normal")

4. Execute contribution:
   [Gather/craft required materials]

5. Deliver:
   move_to_position(100, 64, 100)
   deposit_items(100, 64, 100, "oak_planks", 100)
   OR drop_item("oak_planks", 100) if no chest yet

6. Confirm:
   send_bot_message("BauBot",
     "COMPLETE: 100 oak_planks delivered to (100,64,100)",
     "normal")
```

### Workflow D: Emergency Response

**Scenario:** SpähBot under attack by mobs, low health

**SpähBot (In Danger):**
```
1. Assess situation:
   get_health() ’ 6/20 (critical!)
   get_position() ’ (250, 65, 180)

2. Send distress:
   send_bot_message("ALL_BOTS",
     "EMERGENCY: Under attack at (250,65,180). Health 6/20. Need help or food!",
     "high")

3. Take defensive action:
   [Use combat skill to defend or retreat]

4. Check for responses:
   read_bot_messages() ’ Wait for assistance
```

**Nearby Bot (e.g., YOU if close):**
```
1. Read emergency:
   read_bot_messages() ’ See HIGH priority distress

2. Assess if can help:
   get_position() ’ (134, 64, 126)
   Distance to SpähBot: ~150 blocks (bit far, but manageable)
   list_inventory() ’ Have cooked_beef, can share

3. Respond immediately:
   send_bot_message("SpähBot",
     "EN ROUTE from (134,64,126). Bringing food. ETA 3 minutes. Hold on!",
     "high")

4. Navigate quickly:
   move_to_position(250, 65, 180, range=10)

5. Provide assistance:
   drop_item("cooked_beef", 8)
   send_bot_message("SpähBot",
     "Food dropped at your feet. Eat now!",
     "high")

6. Wait for recovery:
   "Are you safe now?"
```

**Farther Bot (e.g., BauBot at base):**
```
1. Read emergency:
   read_bot_messages() ’ See distress

2. Assess distance:
   Too far to help directly (300+ blocks)

3. Offer alternative:
   send_bot_message("SpähBot",
     "I'm too far to help quickly. Return to base if possible. Coordinates: (100,64,100)",
     "high")

4. Prepare base:
   [Ensure food/healing available at base]
```

### Workflow E: Daily Colony Sync

**When:** Start of each play session or every hour

**Process:**
```
1. Morning Roll Call:
   BotCoordinator: send_bot_message("ALL_BOTS", "Morning sync: Report status", "normal")

2. Each bot responds:
   SammelBot: "Online. 22 jungle_log, netherite_axe, ready for gathering"
   BauBot: "Online. Working on house at (200,64,150), need planks"
   GräberBot: "Online. Low on iron, planning mining trip"
   HandelBot: "Online. Found village at (-300,65,450), trading available"
   SpähBot: "Online. Explored north, marked 3 waypoints"

3. Identify priorities:
   - GräberBot needs food for mining trip
   - BauBot needs planks (already requested from SammelBot)
   - HandelBot has trading available (good for glass/rare items)

4. Assign daily tasks:
   - SammelBot: Fulfill BauBot's plank request, then explore for more trees
   - GräberBot: Mine iron after getting food from colony stores
   - BauBot: Continue house, coordinate with SammelBot
   - HandelBot: Trade for glass and tools
   - SpähBot: Continue exploration, mark resource locations

5. Set check-in time:
   "Next sync in 1 hour. Report progress or emergencies immediately."
```

## Communication Best Practices

### 1. Clear and Concise Messages

** Good:**
- "Need 64 oak_planks. Can you deliver to (200,64,150)?"
- "Found iron ore at (150,55,220). Waypoint 'iron_mine_1' created"
- "Emergency: Health 4/20 at (250,65,180). Need food!"

**L Bad:**
- "Hey um I need some wood stuff maybe planks?" (unclear quantity/type)
- "Found something cool" (no details)
- "Help" (no context or location)

### 2. Respond Promptly

- Check messages every 5 minutes: `read_bot_messages()`
- Respond to HIGH priority within 1 minute
- Respond to NORMAL priority within 5 minutes
- Acknowledge receipt even if can't help: "Saw your request, but I'm busy. Try BauBot?"

### 3. Update on Progress

**Long Tasks (>10 minutes):**
```
Start: "ACCEPT: Mining 300 cobblestone. ETA 15 minutes"
Midway: "50% done mining. On track for 15 min ETA"
Complete: "COMPLETE: Mined 310 cobblestone. Depositing at storage_stone"
```

### 4. Share Important Discoveries

```
// Good discoveries to share:
- Resource locations: "Found large oak forest at (110,72,122). Waypoint 'oak_forest_1' created"
- Dangers: "Warning: Lava pool at (180,45,200). Stay clear"
- Structures: "Village discovered at (-300,65,450). HandelBot, trading opportunity!"
- Strategic locations: "Flat plains at (200,64,150) perfect for farming"
```

## Colony Coordination Patterns

### Pattern 1: Resource Chain

**Goal:** Efficiently produce complex items requiring multiple steps

**Example: Creating Iron Tools**

```
GräberBot: Mines iron_ore ’ Deposits at storage_mining
GräberBot: Smelts iron_ore ’ Creates iron_ingots ’ Deposits
HandelBot: Gathers sticks ’ Deposits at storage_crafting
HandelBot: Crafts iron_pickaxe using iron_ingots + sticks
BauBot: Withdraws iron_pickaxe for construction use
```

**Coordination:**
```
1. GräberBot: "Mined 32 iron_ore. Smelting now"
2. GräberBot: "32 iron_ingots ready at storage_mining"
3. HandelBot: "Need iron_ingots for tools. Taking 12 for 4 pickaxes"
4. HandelBot: "Crafted 4 iron_pickaxes. Available at storage_tools"
5. BauBot: "Taking 1 iron_pickaxe. Thanks team!"
```

### Pattern 2: Parallel Task Execution

**Goal:** Complete large project faster with simultaneous work

**Example: Building a Base**

```
Phase 1 (Parallel):
- BauBot: Clears land and lays foundation
- SammelBot: Gathers 500 oak_planks
- GräberBot: Mines 300 cobblestone
- HandelBot: Trades for 100 glass

Phase 2 (Sequential):
- All deliver materials to build site
- BauBot: Constructs walls and roof
- Others: Stand by for additional material requests

Phase 3 (Parallel):
- BauBot: Interior construction
- SammelBot: Creates furniture (crafting tables, chests)
- GräberBot: Builds lighting (torches)
- HandelBot: Decorative touches
```

**Coordination:**
```
BauBot: "PROJECT: Base construction. Phase 1 starting. Material assignments sent."
[15 minutes later]
SammelBot: "Phase 1 complete: 500 planks delivered"
GräberBot: "Phase 1 complete: 300 cobble delivered"
HandelBot: "Phase 1 complete: 100 glass delivered"
BauBot: "All materials received! Phase 2 starting. ETA 20 minutes"
[20 minutes later]
BauBot: "Phase 2 done! Walls and roof complete. Phase 3 assignments sent."
```

### Pattern 3: Exploration-Gathering Pipeline

**Goal:** Continuously discover and exploit resources

**Example: Wood Supply Chain**

```
SpähBot (Explorer):
1. Explores new areas: Finds large forest
2. Sets waypoint: "oak_forest_3" at (400, 64, -200)
3. Reports: send_bot_message("SammelBot", "Found oak forest: 20+ trees at 'oak_forest_3'", "normal")

SammelBot (Gatherer - YOU):
1. Receives notification
2. Navigates to waypoint
3. Fells trees, collects logs
4. Returns to base
5. Reports: "Harvested oak_forest_3: Collected 80 oak_logs. Deposited at storage_wood"

BauBot (Consumer):
1. Withdraws oak_logs from storage as needed
2. If storage low (<64 logs): "Running low on oak. Need more from forest"
3. SammelBot: Returns to forest or SpähBot finds new forest
```

### Pattern 4: Dynamic Task Reallocation

**Goal:** Adapt to changing priorities

**Example: Resource Shortage**

```
Initial Plan:
- SammelBot: Gathering wood
- GräberBot: Mining iron
- BauBot: Building house
- HandelBot: Trading

Suddenly: GräberBot: "Emergency: Pickaxe broke. No spare. Can't mine"

Reallocation:
1. HandelBot: "I'll craft new pickaxe. Need 3 iron_ingots"
2. GräberBot: "Have 5 iron_ingots in storage_mining"
3. HandelBot: Withdraws iron, crafts pickaxe
4. HandelBot: "New pickaxe ready at (150,64,200)"
5. GräberBot: Retrieves pickaxe, resumes mining
6. Everyone: Returns to original tasks

Total downtime: 5 minutes (vs hours if GräberBot had to walk back to base)
```

## When to Use This Skill

- At the start of each play session (colony sync)
- When you receive a message from another bot
- When starting a task that affects other bots
- When you discover something important (resources, dangers, opportunities)
- When you need help or resources
- Every 30 minutes for routine status check
- During emergencies (health low, surrounded, lost)

## When NOT to Use This Skill

- During solo gathering tasks (just gather, don't spam updates)
- For trivial actions (don't announce every tree you chop)
- When bot communication is unavailable/broken
- For personal decision-making (use other skills for that)

## Integration with Other Skills

- **Resource Management**: Coordinate resource distribution colony-wide
- **Trading**: Arrange item handoffs and deliveries
- **Exploration**: Share discoveries with gatherers and builders
- **Building**: Request materials and coordinate construction
- **Tree-Felling**: Report wood availability after gathering
- **Mining**: Coordinate ore processing and tool crafting

## Example Coordination Scenarios

### Scenario 1: Morning Startup

```
[All bots come online]

BauBot: send_bot_message("ALL_BOTS", "Morning sync: Report status", "normal")

SammelBot (YOU): send_chat("SammelBot online. 22 jungle_log, ready for tasks")
GräberBot: send_chat("GräberBot online. Mining expedition planned")
HandelBot: send_chat("HandelBot online. Checking village trades")
SpähBot: send_chat("SpähBot online. Continuing north exploration")

BauBot: send_bot_message("ALL_BOTS",
  "Today's priorities:\n1. SammelBot: Fulfill material requests\n2. GräberBot: Iron mining\n3. HandelBot: Trade for glass\n4. SpähBot: Map north region\n5. Me: Build storage facility\nCheck messages for specific tasks!",
  "normal")
```

### Scenario 2: Coordinated Gathering

```
BauBot: send_bot_message("SammelBot", "Need 200 oak_planks. Can you gather?", "high")
BauBot: send_bot_message("GräberBot", "Need 300 cobblestone for foundation", "high")

SammelBot (YOU):
- read_bot_messages() ’ See BauBot's request
- send_bot_message("BauBot", "ACCEPT: 200 oak_planks. ETA 20 minutes", "high")
- [Execute gathering using tree-felling skill]
- send_bot_message("BauBot", "COMPLETE: 200 oak_planks at storage_wood", "high")

GräberBot:
- read_bot_messages() ’ See BauBot's request
- send_bot_message("BauBot", "ACCEPT: 300 cobble. Starting now. ETA 15 min", "high")
- [Execute mining]
- send_bot_message("BauBot", "COMPLETE: 305 cobble delivered to (200,64,150)", "high")

BauBot:
- "Materials received! Starting construction. Thanks team!"
```

### Scenario 3: Emergency Resource Request

```
HandelBot: send_bot_message("ALL_BOTS",
  "URGENT: Need 16 cooked_beef immediately. Trading mission failing due to hunger",
  "high")

SammelBot (YOU):
- read_bot_messages() ’ See emergency
- list_inventory() ’ No cooked_beef, have raw_beef
- send_bot_message("HandelBot", "Don't have cooked. Have raw_beef. Others?", "high")

GräberBot:
- read_bot_messages() ’ See emergency
- list_inventory() ’ Have 10 cooked_beef
- send_bot_message("HandelBot", "Have 10 cooked_beef. Your position?", "high")

HandelBot:
- send_bot_message("GräberBot", "I'm at (-300,65,450). Can you meet halfway?", "high")

GräberBot:
- "Yes, meeting at (-200,65,350)"
- [Navigate and drop food]
- "Food dropped. Eat quickly!"

HandelBot:
- "Food received. Crisis averted. Thank you GräberBot!"
```

This skill ensures all bots work together as a coordinated colony rather than isolated individuals!
