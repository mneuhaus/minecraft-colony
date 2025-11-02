# TODO - Minecraft Colony Bot System

## Current Status: Phase 1 - Spawn Orientation & Safety ✅

**Active Bots:**
- HandelBot (Trading specialist) - Port 3001
- SammelBot (Resource gathering) - No viewer
- BauBot (Construction) - Port 3002
- GräberBot (Mining) - Port 3003
- SpähBot (Exploration/Scouting) - Port 3004

**Last validated:** 2025-11-02
**Colony runtime:** Operational with dashboard at http://localhost:4242

---

## Phase 1: Spawn Orientation & Safety ✅ COMPLETE

### Core Functionality ✅
- [x] Basic movement and navigation
- [x] Inventory management
- [x] Chat communication (German language)
- [x] Position tracking and waypoints
- [x] Health and food monitoring
- [x] Prismarine viewer integration
- [x] Bot-to-bot messaging system
- [x] Colony runtime orchestration

### Skills Implemented ✅
- [x] tree-felling (with oak and spruce variants)
- [x] building (basic structures)
- [x] trading (item handoffs)
- [x] mining (basic excavation)
- [x] combat (health/safety)
- [x] farming (crops and animals)
- [x] navigation (waypoints)
- [x] crafting (items and smelting)
- [x] exploration (scouting)

---

## Phase 2: Essential Gathering 🔄 IN PROGRESS

### Priority: HIGH

#### 2.1 Tree-Felling Improvements
- [ ] Add jungle tree handling to tree-felling skill
  - Create `.claude/skills/tree-felling/tree_types/jungle.md`
  - Document 2x2 mega jungle tree patterns
  - Test with jungle logs in inventory

- [ ] Add birch and acacia tree support
  - Create tree_types/birch.md (simple 1x1)
  - Create tree_types/acacia.md (branching patterns)
  - Test with different tree types

- [ ] Improve sapling collection efficiency
  - Add timeout parameter to wait_for_saplings
  - Better detection of completed leaf decay
  - Smarter replanting location selection

#### 2.2 Stone Acquisition Tools
- [ ] Create `find_stone` tool
  - Search for exposed stone on surface
  - Identify cliff faces and caves
  - Return sorted list by distance
  - Follow "blind bot" principle (coordinates + distance)

- [ ] Create `mine_stone` skill
  - Document basic stone mining strategy
  - Safe excavation patterns (prevent falling)
  - Efficient cobblestone collection
  - Tool durability awareness

- [ ] Add stone gathering workflow
  - Craft wooden pickaxe (if needed)
  - Find nearest stone deposit
  - Mine required amount
  - Return to base with cobblestone

#### 2.3 Shelter Completion
- [ ] Expand building skill with shelter patterns
  - Document basic 3x3 hut blueprint
  - Add 5x5 house pattern
  - Underground bunker strategy
  - Night-safe construction (doors, lighting)

- [ ] Create `assess_shelter_needs` tool
  - Check if bot has safe shelter
  - Identify missing components (walls, roof, door, light)
  - Return actionable build plan

- [ ] Test coordinated shelter building
  - SammelBot gathers materials
  - BauBot constructs structure
  - Test with actual gameplay scenario

---

## Phase 3: Tool & Equipment Crafting 📋 PLANNED

### Priority: MEDIUM

#### 3.1 Crafting Skill Enhancements
- [ ] Expand crafting skill documentation
  - Add recipe tree examples (log → planks → sticks → tools)
  - Document tool progression (wood → stone → iron)
  - Add crafting table placement strategy

- [ ] Create `plan_crafting_sequence` tool
  - Input: target item (e.g., "stone_pickaxe")
  - Output: ordered list of intermediate crafts
  - Check inventory for existing materials
  - Report missing ingredients

#### 3.2 Furnace Operations
- [ ] Improve smelt_item tool
  - Add fuel efficiency calculations
  - Support multiple smelting operations
  - Monitor smelting progress
  - Auto-collect finished items

- [ ] Create furnace management skill
  - Placement strategy (near resources)
  - Fuel prioritization (coal > planks > saplings)
  - Batch smelting workflows

#### 3.3 Armor and Weapons
- [ ] Add armor crafting workflows
  - Leather → Iron → Diamond progression
  - Auto-equip when crafted
  - Durability monitoring

- [ ] Expand combat skill
  - Weapon crafting priority
  - Shield usage
  - Armor repair strategy

---

## Phase 4: Navigation & Exploration 📋 PLANNED

### Priority: MEDIUM

#### 4.1 Waypoint System Enhancements
- [ ] Add waypoint categories
  - Home, Resource, Danger, POI types
  - Color-coding in logs/UI
  - Priority levels

- [ ] Create shared waypoint system
  - Bot-to-bot waypoint sharing
  - Central waypoint registry
  - Coordinate announcements via send_bot_message

#### 4.2 Coordinated Scouting
- [ ] Expand exploration skill
  - Grid-based exploration patterns
  - Biome identification
  - Resource deposit marking
  - Danger zone flagging

- [ ] Create `report_findings` workflow
  - SpähBot finds resources
  - Creates waypoints automatically
  - Sends bot_messages to SammelBot
  - Test end-to-end coordination

#### 4.3 Safe Return Paths
- [ ] Add path recording
  - Breadcrumb trail system
  - Safe path verification
  - Alternative route planning

---

## Phase 5: Food & Farming 📋 PLANNED

### Priority: LOW (Phase 1 complete, defer to later)

#### 5.1 Crop Farming
- [ ] Enhance farming skill
  - Wheat, carrot, potato strategies
  - Automated replanting
  - Harvest timing optimization

#### 5.2 Animal Husbandry
- [ ] Add breeding workflows
  - Animal finding and fencing
  - Feed schedules
  - Population management

#### 5.3 Communal Food Stores
- [ ] Create food storage system
  - Designated food chests
  - Stock level monitoring
  - Automatic restocking

---

## Technical Debt & Improvements

### Priority: HIGH

#### Testing & Verification
- [ ] Create automated test suite
  - Test each tool in isolation
  - Test skills end-to-end
  - Mock Minecraft server for CI/CD

- [ ] Screenshot verification workflow
  - Automated screenshots after major actions
  - Visual regression testing
  - Playwright integration improvements

#### Documentation
- [ ] Complete CHANGELOG.md entries
  - Document all Phase 1 work
  - Version 0.2.0 release notes

- [ ] Create README.md
  - User installation guide
  - Quick start tutorial
  - Architecture overview

#### Code Quality
- [ ] Tool refactoring
  - Extract common patterns
  - Improve error handling
  - Add timeout configurations

- [ ] Logging improvements
  - Structured YAML consistency
  - Diary entry quality
  - Log rotation strategy

### Priority: MEDIUM

#### Performance
- [ ] Token optimization
  - Minimize skill file sizes
  - Efficient tool descriptions
  - Context management best practices

- [ ] Bot coordination efficiency
  - Message queue optimization
  - Reduce polling overhead
  - Batch operations where possible

#### Developer Experience
- [ ] Improve debug tooling
  - Better pnpm send experience
  - Enhanced screenshot tool
  - Real-time dashboard updates

- [ ] Add development helpers
  - Bot reset command
  - Quick scenario loader
  - Test world generator

---

## Multi-Bot Coordination Scenarios

### Scenario 1: Wood Gathering Operation ✅ COMPLETE
- [x] SammelBot fells tree at coordinates
- [x] SammelBot drops logs for BauBot
- [x] send_bot_message notification
- [x] BauBot picks up logs

### Scenario 2: House Construction 📋 PLANNED
- [ ] Plan: Build 5x5 house with door
- [ ] SammelBot: Gather 100 planks + 2 glass
- [ ] BauBot: Build structure at coordinates
- [ ] SpähBot: Verify completion with screenshot
- [ ] Test with actual colony

### Scenario 3: Mine Operation 📋 PLANNED
- [ ] GräberBot: Dig mineshaft to Y=12
- [ ] GräberBot: Mine iron ore
- [ ] SammelBot: Collect ore and return to surface
- [ ] HandelBot: Smelt ore in furnace
- [ ] Craft iron tools and distribute

### Scenario 4: Night Safety Protocol 📋 PLANNED
- [ ] Detect nightfall (time-based)
- [ ] All bots return to shelter
- [ ] GräberBot continues mining underground
- [ ] SpähBot pauses exploration
- [ ] Resume at dawn

---

## Skills to Create

### High Priority
- [ ] stone-gathering skill (Phase 2)
- [ ] shelter-building skill (Phase 2)
- [ ] night-safety skill (Phase 2)

### Medium Priority
- [ ] furnace-management skill (Phase 3)
- [ ] tool-progression skill (Phase 3)
- [ ] path-recording skill (Phase 4)

### Low Priority
- [ ] crop-farming skill (Phase 5)
- [ ] animal-breeding skill (Phase 5)
- [ ] resource-optimization skill (Phase 6+)

---

## Tools to Create

### High Priority
- [ ] find_stone tool (Phase 2)
- [ ] assess_shelter_needs tool (Phase 2)
- [ ] detect_time_of_day tool (Phase 2)

### Medium Priority
- [ ] plan_crafting_sequence tool (Phase 3)
- [ ] check_tool_durability tool (Phase 3)
- [ ] share_waypoint tool (Phase 4)

### Low Priority
- [ ] identify_biome tool (Phase 4)
- [ ] calculate_food_level tool (Phase 5)

---

## Known Issues

### Critical
- None currently

### Major
- [ ] Leaf decay timing unpredictable (affects tree-felling)
- [ ] Pathfinding can fail on cliffs (needs fallback)

### Minor
- [ ] Viewer doesn't auto-refresh (manual browser refresh needed)
- [ ] Log files growing large (need rotation)
- [ ] Canvas module rebuild sometimes needed after pnpm install

---

## Next Session Actions

1. **Complete Phase 2 Tree-Felling** (30 min)
   - Add jungle tree type documentation
   - Test with jungle logs

2. **Create Stone Gathering Tools** (45 min)
   - Implement find_stone tool
   - Create mine_stone skill
   - Test with GräberBot

3. **Test Multi-Bot Scenario 2** (30 min)
   - Run house construction scenario
   - Take screenshots at each step
   - Document findings

4. **Update CHANGELOG.md** (15 min)
   - Document Phase 1 completion
   - Document Phase 2 progress
   - Prepare for v0.2.0 tag

---

**Guidelines:**
- Always verify with screenshots before marking items complete
- Update this file after each work session
- Keep items in AGENTS.md phases aligned with this TODO
- Mark items ✅ only after validation in actual Minecraft world
- Create git commits for each completed feature section
