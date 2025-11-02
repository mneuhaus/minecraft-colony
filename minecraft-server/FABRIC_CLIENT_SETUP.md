# Banner Generator - Fabric Client Setup

## Overview

We've created a **hybrid system** where the Paper server plugin communicates with a Fabric client mod to provide a custom GUI experience.

## Architecture

```
┌─────────────────┐          ┌──────────────────┐
│  Fabric Client  │          │   Paper Server   │
│                 │          │                  │
│  Custom GUI     │◄────────►│  PacketHandler   │
│  Screen         │  Packets │  + Logic         │
└─────────────────┘          └──────────────────┘
```

## How It Works

1. **Player right-clicks workstation** → Paper detects interaction
2. **Paper sends packet** → `bannergenerator:open_gui` → Fabric client
3. **Fabric opens custom screen** → Player configures banners
4. **Player clicks "Generate"** → Fabric sends `bannergenerator:generate` → Paper
5. **Paper generates banners** → Validates and creates items → Gives to player

## Files Created

### Fabric Mod (`mods/BannerGeneratorFabric/`)

```
├── build.gradle                  # Gradle build configuration
├── gradle.properties             # Fabric versions (1.21.10)
├── settings.gradle               # Gradle settings
└── src/main/
    ├── java/com/bannergenerator/client/
    │   ├── BannerGeneratorClient.java    # Main entry point, packet registration
    │   └── BannerGeneratorScreen.java    # Custom GUI screen
    └── resources/
        └── fabric.mod.json              # Mod metadata
```

### Paper Plugin Updates (`plugins/BannerGenerator/`)

- **PacketHandler.java** - New class for handling custom packets
- **BannerGeneratorPlugin.java** - Updated to initialize PacketHandler
- **WorkstationManager.java** - Updated to send packet instead of opening anvil GUI

## Building the Fabric Mod

```bash
cd mods/BannerGeneratorFabric
./gradlew build
```

The output JAR will be at: `build/libs/bannergenerator-fabric-1.0.0.jar`

## Building the Paper Plugin

```bash
cd plugins/BannerGenerator
JAVA_HOME=/usr/local/Cellar/openjdk/25.0.1/libexec/openjdk.jdk/Contents/Home mvn clean package
```

The output JAR will be at: `target/BannerGenerator-1.0.0.jar`

## Installation

### Server Side
1. Copy `plugins/BannerGenerator/target/BannerGenerator-1.0.0.jar` to your Paper server's `plugins/` folder
2. Restart server

### Client Side (Required for all players)
1. Install Fabric Loader 0.16.14+ for Minecraft 1.21.10
2. Install Fabric API 0.114.0+
3. Copy `mods/BannerGeneratorFabric/build/libs/bannergenerator-fabric-1.0.0.jar` to your Minecraft `mods/` folder
4. Launch game

## Packet Protocol

### Server → Client: `bannergenerator:open_gui`
- **Trigger**: Player right-clicks workstation
- **Data**: Empty (can be extended for initial state)
- **Action**: Client opens custom Banner Generator screen

### Client → Server: `bannergenerator:generate`
- **Trigger**: Player clicks "Generate Banners" button
- **Data**:
  - `String text` - Text to generate (A-Z, 0-9, punctuation)
  - `String bannerColor` - Background color (DyeColor name)
  - `String dyeColor` - Text color (DyeColor name)
- **Action**: Server validates and generates banner items

## Custom GUI Features

The Fabric client provides a much better UI compared to the anvil interface:

- ✅ Dedicated text input field with placeholder
- ✅ Color selection buttons for banner background
- ✅ Color selection buttons for text/dye color
- ✅ Clean, centered GUI with proper borders
- ✅ Visual feedback and proper labeling
- ⏳ Future: Live banner preview
- ⏳ Future: Full color picker with all 16 dye colors
- ⏳ Future: Character counter and validation feedback

## Next Steps

1. **Build both mods**
2. **Install on server and client**
3. **Test the custom GUI**
4. **Enhance the GUI** with:
   - All 16 dye colors
   - Live banner preview rendering
   - Better color selection (color wheel?)
   - Character limit indicator
   - Visual feedback for invalid input

## Advantages Over Anvil GUI

| Feature | Anvil GUI | Fabric Custom GUI |
|---------|-----------|-------------------|
| Text Input | ✅ Single field | ✅ Dedicated field with placeholder |
| Color Selection | ❌ Manual item placement | ✅ Button-based selection |
| Preview | ❌ None | ⏳ Coming soon |
| Multi-letter | ❌ Manual process | ✅ Built-in |
| User Experience | 😐 Clunky | 😊 Smooth |
| Vanilla Compatible | ✅ Yes | ❌ Requires Fabric |

## Requirements

- **Server**: Paper 1.21.10+ with Java 21+
- **Client**: Minecraft 1.21.10 with Fabric Loader 0.16.14+ and Fabric API

Enjoy your enhanced Banner Generator! 🎨
