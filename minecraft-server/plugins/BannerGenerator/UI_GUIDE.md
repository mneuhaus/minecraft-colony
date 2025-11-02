# Banner Generator - UI Guide

## Overview
The plugin now features a professional, multi-stage UI system combining custom inventory GUIs with Minecraft's built-in anvil interface for text input.

## UI Flow

### Stage 1: Main Workstation GUI
**Title**: `✦ Banner Workstation ✦`
**Size**: 6 rows (54 slots)

**Layout**:
```
┌─────────────────────────────────────────────────┐
│  ████████████ Top Border ████████████████████   │  (Black glass panes)
│  █                                           █   │
│  █  ▓▓▓ [Banner] ▓ [Info] ▓ [Dye] ▓▓▓       █   │  (Light blue/cyan highlights)
│  █  ▓▓▓▓▓▓▓▓▓▓▓▓ ▓ ▓▓▓▓▓▓ ▓ ▓▓▓▓▓▓▓         █   │
│  █                                           █   │
│  ████████████ Separator ████████████████████ │  (Gray glass panes)
│  █        [Generate Button]                  █   │  (Glowing when ready)
│  █                                           █   │
│  █  [Output] [Output] [Output] [Output] ...  █   │  (7 banner slots)
│  ████████████████████████████████████████████   │  (Black glass panes)
└─────────────────────────────────────────────────┘
```

**Features**:
- **Banner Input Slot** (Left): Place any colored banner
  - White Banner icon placeholder
  - Lore: Instructions about background color

- **Info Display** (Center): Shows current status
  - Book icon (changes to writable book when text is set)
  - Displays: "Your Text: [text]" or instructions

- **Dye Input Slot** (Right): Place any dye
  - Black Dye icon placeholder
  - Lore: Instructions about text color

- **Generate Button** (Center-bottom):
  - **Not Ready**: Red "✖ Not Ready" (coal/redstone)
  - **Ready**: Green "✔ GENERATE BANNERS" (glowing emerald with enchant effect)

- **Output Slots** (Bottom row): 7 slots for generated letter banners

### Stage 2: Anvil Text Input
**Title**: `Banner Creator - Type Your Text`
**Trigger**: Automatically opens when both banner AND dye are placed

**Layout**:
```
┌──────────────────────────┐
│  [Input Item]  +  [ ]    │
│                           │
│  Type text here: ______  │  <-- Player types here
│                           │
│     [Result Preview]     │  <-- Name tag showing "Generate: TEXT"
└──────────────────────────┘
```

**Input Item**: Paper with instructions
**Text Field**: Anvil's rename field
**Result**: Name tag showing:
- Display: "§a§lGenerate: [YOUR TEXT]"
- Lore: Preview info (text, length, action)

**Features**:
- Real-time text validation
- Auto-uppercase conversion
- Character filtering (A-Z, 0-9, punctuation only)
- 20 character limit
- Live preview in result slot

### Stage 3: Back to Main GUI
**What happens**:
1. Player clicks the result in anvil
2. Anvil closes
3. Main GUI reopens with:
   - Banner placed in left slot
   - Dye placed in right slot
   - Info display showing the entered text
   - Generate button now GLOWING (enchanted emerald)

4. Player clicks Generate
5. Banners appear in output slots with sound effect

## Visual Design Elements

### Color Scheme
- **Black Glass Panes**: Borders and structural elements
- **Gray Glass Panes**: Section separators
- **Light Blue Glass Panes**: Input section highlights (corners)
- **Cyan Glass Panes**: Input section highlights (sides)
- **Lime Glass Pane**: Output section label

### Text Colors
- `§6` (Gold): Titles and headers
- `§b` (Aqua): Input labels
- `§e` (Yellow): Important info/highlights
- `§7` (Gray): Instructions/descriptions
- `§a` (Green): Success states
- `§c` (Red): Error states/not ready
- `§8` (Dark Gray): Examples

### Special Effects
- **Enchantment Glow**: Generate button when ready
- **Sound Effect**: `BLOCK_ANVIL_USE` on successful generation
- **Item Flags**: Hide enchantment details on generate button

## User Experience Flow

### Happy Path
1. `/bg` → Receive workstation block
2. Place block in world
3. Right-click → Open main GUI
4. Place white banner in left slot
5. Place black dye in right slot
6. → **Anvil GUI opens automatically**
7. Type "HELLO" in text field
8. See preview: "Generate: HELLO"
9. Click result
10. → **Back to main GUI**
11. See info: "Your Text: HELLO"
12. See glowing generate button
13. Click generate button
14. → **Sound effect plays**
15. → **5 letter banners appear in output**
16. Take banners!

### Error Handling
- **Missing banner**: Red message "Please place a banner in the banner slot!"
- **Missing dye**: Red message "Please place a dye in the dye slot!"
- **No text entered**: Generate button stays gray, shows "✖ Not Ready"
- **Invalid characters**: Auto-filtered in anvil interface
- **Text too long**: Auto-truncated to 20 characters

## Technical Implementation

### Key Classes
- **BannerGuiManager**: Main GUI (54-slot enhanced interface)
- **AnvilGuiHelper**: Anvil text input system
- **WorkstationManager**: Block interaction handling

### Event Flow
1. `PlayerInteractEvent` → Open main GUI
2. `InventoryClickEvent` (main GUI) → Detect banner+dye placement
3. → Close main GUI, open anvil GUI
4. `PrepareAnvilEvent` → Create result preview
5. `InventoryClickEvent` (anvil) → Capture text
6. → Close anvil, reopen main GUI with data
7. `InventoryClickEvent` (main GUI) → Generate banners

### Data Persistence
- Text stored in: Info item's lore (in main GUI)
- Banner/dye stored in: AnvilGuiSession (temporary, during anvil input)
- Generated banners: Placed directly in output slots

## Customization Ideas

### Easy Changes
- Modify color scheme in `setupEnhancedLayout()`
- Change slot positions (constants at top of BannerGuiManager)
- Add more output slots (increase OUTPUT_SLOTS array)
- Change sounds/effects in `handleGeneration()`

### Advanced Changes
- Add preview of actual banner appearance
- Save/load custom text presets
- Add color picker GUI for banner/dye selection
- Implement copy/paste from previous generations
- Add export to schematic/structure file
