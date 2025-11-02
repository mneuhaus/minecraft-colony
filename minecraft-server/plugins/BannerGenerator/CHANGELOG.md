# Changelog

All notable changes to the Banner Generator Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-11-06

### Added
- Restored the anvil-based workstation interface with a sanitize-and-preview flow that remembers the last character you entered.
- Preview banner lore now shows the selected character for clarity.

### Changed
- Input is restricted to a single character (A–Z, 0–9, space, !, ?, ., ,); the plugin treats Minecraft’s auto-filled item name as blank.
- Removed the chat-driven text input system in favour of the native anvil rename field while keeping the custom block workflow intact.

### Fixed
- Prevented ClassCastException when interacting with the workstation and ensured inputs are safely returned even after validation failures.

---

## [1.1.0] - 2025-11-05

### Added
- **Persistent Custom Block** – Banner Workstations now persist across restarts, drop their custom item when broken, and survive explosions gracefully.
- **Crafting Recipe** – Added a shapable recipe so players can craft the workstation with banners, paper, planks, and a cartography table.
- **Inventory GUI** – Introduced a dedicated chest-style interface with clear input/output slots and safe material return.
- **Async Chat Text Entry** – Players click “Enter Text” and use Paper’s modern chat flow (AsyncChatEvent) without legacy settings.
- **Multi-Letter Generation** – Generate entire strings in one click; overflow banners go straight to the player inventory.
- **Session Management** – Robust handling of disconnects and GUI closes to prevent item loss or dupes.

### Changed
- Replaced the anvil workflow with a custom GUI, removing the placeholder paper mechanic and eliminating XP requirements.
- Updated README to document the new crafting recipe, GUI flow, and behaviour.

### Fixed
- Eliminated zero-stack ghost items when consuming materials.
- Prevented vanilla cartography tables from triggering the workstation UI.

### Removed
- Legacy recipe JSON (now supplied programmatically when the plugin enables).

---

## [1.0.0] - 2025-10-29

### Added
- **Initial Release** - Banner Generator Plugin for Minecraft 1.21.x
- **Anvil-based GUI** - Simple, intuitive interface using Minecraft's anvil
- **Live Banner Preview** - See your banner as you type in real-time
- **Single-Letter Creation** - Craft one letter banner at a time
- **Two-Color System** - Customizable background (banner) and text (dye) colors
- **Letter Pattern Library** - Complete support for:
  - Uppercase letters: A-Z
  - Numbers: 0-9
  - Punctuation: Space, !, ?, ., ,
- **Custom Workstation Block** - Banner Workstation (styled Cartography Table)
- **Commands**:
  - `/bannergenerator` (alias: `/bg`) - Get a workstation block
- **Sound Effects** - Satisfying anvil sound on banner creation
- **Auto-consumption** - Materials (1 banner + 1 dye) consumed per creation
- **Template System** - Paper placeholder to enable anvil text input
- **Item Return** - Unused materials returned when GUI is closed

### Technical Details
- Built for Paper API 1.21.1-R0.1-SNAPSHOT
- Java 21 required
- Maven build system
- 5 core Java classes (clean architecture)
- Uses Minecraft's native banner pattern system
- Event-driven design with PrepareAnvilEvent for live preview

### Known Issues
- None reported yet

### Notes
- Plugin JAR size: ~15KB (lightweight!)
- No dependencies required
- Compatible with Paper 1.21.x servers

---

## Development History

### Design Evolution

#### Initial Concept
- Multi-screen GUI with separate text input
- Full-word banner generation
- Complex state management
- Chat-based text entry

#### Iteration 1
- 54-slot custom inventory GUI
- Colored glass pane decorations
- Separate anvil popup for text input
- Multi-letter generation with preview

#### Final Design (v1.0.0)
- **Simplified to single anvil interface**
- **One letter at a time** - More intuitive and controllable
- **Live preview in result slot** - Instant visual feedback
- **Paper template** - Enables text field in anvil
- **No complex state** - Stateless design for reliability

### Why This Design?

**Simplicity First:**
- Single interface (no navigation)
- Familiar Minecraft mechanic (anvil)
- Immediate visual feedback
- Natural batch-creation workflow
- Less prone to bugs

**User Benefits:**
- See exactly what you're creating
- Change colors easily (swap materials)
- Create letters in any order
- No typing mistakes (one letter = easy to verify)
- Perfect for signs, displays, and decorations

---

## Future Roadmap

### Planned Features
- [ ] Quick-craft presets (common words: "SHOP", "EXIT", etc.)
- [ ] Color combination favorites
- [ ] Recent letters history (click to recreate)
- [ ] Optional multi-letter mode toggle
- [ ] Banner auto-placement helper
- [ ] Custom pattern workshop
- [ ] Lowercase letter variants
- [ ] Additional special characters (@, #, $, etc.)
- [ ] Decorative border patterns

### Under Consideration
- [ ] Bulk letter generation from book text
- [ ] Copy/paste banners
- [ ] Banner design sharing (export/import)
- [ ] Integration with other plugins (shops, regions)
- [ ] Achievement/stat tracking
- [ ] Banner storage system

---

## Version History Table

| Version | Date       | Type    | Summary                          |
|---------|------------|---------|----------------------------------|
| 1.1.1   | 2025-11-06 | Update  | Reintroduced anvil UI with live preview |
| 1.1.0   | 2025-11-05 | Update  | Persistent workstation + GUI revamp |
| 1.0.0   | 2025-10-29 | Release | Initial release with anvil GUI   |

---

## Credits

**Developed for:** Personal use with family (father & son Minecraft project)

**Built with:**
- Paper API 1.21.1
- Java 21
- Maven 3.9+

**Design Philosophy:**
> "Simple is better. One letter at a time means more control,
> less confusion, and way more fun creating custom signs!"

---

## Migration Guide

### Not Applicable
This is the first release - no migrations needed!

---

## Support

For issues or questions:
1. Check the README.md for usage instructions
2. Check UI_GUIDE.md for detailed interface explanation
3. Review this changelog for known issues
4. Create an issue in the project repository

---

## License

Created for personal use. Free to modify and share!

---

**Last Updated:** November 6, 2025
