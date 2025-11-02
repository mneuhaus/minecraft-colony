# Banner Generator Plugin

A Paper 1.21.x plugin that lets players craft colourful text banner strings using a dedicated workstation block and a clean inventory GUI.

## Highlights
- **Good Citizen Block** – The Banner Workstation is a tagged cartography table whose placement is tracked persistently; breaking it returns the custom block item without touching vanilla tables.
- **Craftable + Command Access** – Use `/bannergenerator` (alias `/bg`) or craft it with banners, paper, a cartography table, and wooden planks.
- **Anvil Interface** – Familiar two-input anvil with a rename text box and live preview banner in the result slot.
- **Single-Letter Creation** – Type one character and receive the matching banner (previous input is remembered when you adjust colours).
- **Full Character Set** – Supports A–Z, 0–9, and basic punctuation, rendering unknown characters as “?”.

## Installation
1. Ensure your server runs **Paper 1.21.x** (or a compatible fork) and **Java 21+**.
2. Drop `target/BannerGenerator-1.0.0.jar` into `plugins/`.
3. Start or reload the server.

## Crafting the Workstation
```
BBB
PCP
WWW
```
- `B` – any coloured banner  
- `P` – paper  
- `C` – cartography table  
- `W` – any plank type

The result is the tagged Banner Workstation item. You can also obtain it with `/bannergenerator` or `/bg`.

## Using the Workstation
1. Place the workstation block (its location persists across restarts).
2. Right-click to open the anvil interface.
3. Put a coloured banner in the **left** slot (background colour) and a dye in the **right** slot (text colour).
4. Type **one** character in the anvil rename field (`A-Z 0-9 ! ? . ,` or space). If Minecraft auto-fills the item name, simply overwrite it with your desired character.
5. The result slot shows a preview of that character; click it to create the banner. One banner + one dye are consumed and overflow banners go straight to your inventory.
6. Close the interface at any time—remaining inputs and previews are safely returned.

## Building from Source
Requirements: **Java 21+** and **Maven 3.9+**.
```bash
JAVA_HOME=/path/to/java21 mvn clean package
```
The shaded jar appears at `target/BannerGenerator-1.0.0.jar`.

## Project Layout
```
src/
├── main/
│   ├── java/com/bannergenerator/
│   │   ├── BannerGeneratorPlugin.java   # Plugin bootstrap & recipe
│   │   ├── WorkstationManager.java      # Custom block lifecycle & persistence
│   │   ├── BannerGuiManager.java        # Inventory GUI + session handling
│   │   ├── BannerGenerator.java         # Banner item creation logic
│   │   └── LetterPatterns.java          # Pattern definitions per character
│   └── resources/
│       └── plugin.yml                   # Plugin metadata
```

## Notes
- Workstations track locations in `plugins/BannerGenerator/workstations.yml`.
- Explosions drop the custom block instead of deleting it silently.
- The plugin uses Adventure components throughout, avoiding hard-coded section-symbol colour codes.

Enjoy building bold banner signage with clean, server-friendly tooling!
