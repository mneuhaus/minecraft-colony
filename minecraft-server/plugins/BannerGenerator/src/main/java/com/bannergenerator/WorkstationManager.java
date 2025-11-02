package com.bannergenerator;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.block.Block;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockExplodeEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.util.Vector;

import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Handles creation, persistence, and interaction with the Banner Workstation custom block.
 * The workstation is represented as a cartography table tagged through persistent data.
 */
public class WorkstationManager implements Listener {

    private static final Component WORKSTATION_DISPLAY_NAME =
            Component.text("Banner Workstation", NamedTextColor.GOLD, TextDecoration.BOLD);

    private final BannerGeneratorPlugin plugin;
    private final NamespacedKey workstationItemKey;
    private final File dataFile;
    private final Set<BlockLocationKey> workstationBlocks = new HashSet<>();

    public WorkstationManager(BannerGeneratorPlugin plugin) {
        this.plugin = plugin;
        this.workstationItemKey = new NamespacedKey(plugin, "banner_workstation");
        this.dataFile = new File(plugin.getDataFolder(), "workstations.yml");
    }

    /**
     * Gives a player the custom workstation block item.
     */
    public void giveWorkstationBlock(Player player) {
        player.getInventory().addItem(createWorkstationItem());
    }

    public ItemStack createWorkstationItem() {
        ItemStack workstation = new ItemStack(Material.CARTOGRAPHY_TABLE);
        ItemMeta meta = workstation.getItemMeta();

        if (meta != null) {
            meta.displayName(WORKSTATION_DISPLAY_NAME);
            meta.lore(Arrays.asList(
                    Component.text("Place to access the Banner Workstation.", NamedTextColor.GRAY),
                    Component.empty(),
                    Component.text("Generates custom letter banners", NamedTextColor.YELLOW),
                    Component.text("with your chosen colors.", NamedTextColor.YELLOW)
            ));
            meta.getPersistentDataContainer().set(workstationItemKey, PersistentDataType.BYTE, (byte) 1);
            workstation.setItemMeta(meta);
        }

        return workstation;
    }

    /**
     * Loads persisted workstation locations from disk.
     */
    public void loadWorkstations() {
        workstationBlocks.clear();
        if (!dataFile.exists()) {
            return;
        }

        FileConfiguration config = YamlConfiguration.loadConfiguration(dataFile);
        config.getStringList("workstations").stream()
                .map(BlockLocationKey::fromString)
                .forEach(key -> {
                    if (key != null) {
                        workstationBlocks.add(key);
                    }
                });
    }

    /**
     * Saves workstation locations to disk for persistence across restarts.
     */
    public void saveWorkstations() {
        if (!plugin.getDataFolder().exists() && !plugin.getDataFolder().mkdirs()) {
            plugin.getLogger().warning("Unable to create plugin data folder; workstation locations not saved.");
            return;
        }

        FileConfiguration config = new YamlConfiguration();
        config.set("workstations", workstationBlocks.stream().map(BlockLocationKey::asString).toList());

        try {
            config.save(dataFile);
        } catch (IOException e) {
            plugin.getLogger().severe("Failed to save workstation locations: " + e.getMessage());
        }
    }

    private boolean isWorkstationItem(ItemStack item) {
        if (item == null || !item.hasItemMeta()) {
            return false;
        }
        ItemMeta meta = item.getItemMeta();
        return meta.getPersistentDataContainer().has(workstationItemKey, PersistentDataType.BYTE);
    }

    private boolean isWorkstationBlock(Block block) {
        return workstationBlocks.contains(BlockLocationKey.fromBlock(block));
    }

    private void addWorkstation(Block block) {
        workstationBlocks.add(BlockLocationKey.fromBlock(block));
        saveWorkstations();
    }

    private void removeWorkstation(Block block) {
        workstationBlocks.remove(BlockLocationKey.fromBlock(block));
        saveWorkstations();
    }

    /**
     * Handles placement of the workstation block and records its location.
     */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onWorkstationPlace(BlockPlaceEvent event) {
        if (!isWorkstationItem(event.getItemInHand())) {
            return;
        }

        Block block = event.getBlockPlaced();
        addWorkstation(block);
        event.getPlayer().sendMessage(Component.text("Banner Workstation placed.", NamedTextColor.GREEN));
    }

    /**
     * Handles block breaking to ensure workstation drops the custom item and is deregistered.
     */
    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onWorkstationBreak(BlockBreakEvent event) {
        Block block = event.getBlock();
        if (!isWorkstationBlock(block)) {
            return;
        }

        event.setDropItems(false);
        removeWorkstation(block);
        block.getWorld().dropItemNaturally(block.getLocation().add(new Vector(0.5, 0.1, 0.5)), createWorkstationItem());
        event.getPlayer().sendMessage(Component.text("Banner Workstation removed.", NamedTextColor.YELLOW));
    }

    /**
     * Prevents explosions from silently removing workstation blocks.
     */
    @EventHandler(priority = EventPriority.HIGHEST)
    public void onBlockExplode(BlockExplodeEvent event) {
        event.blockList().removeIf(block -> handleExplosionRemoval(block));
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onEntityExplode(EntityExplodeEvent event) {
        event.blockList().removeIf(block -> handleExplosionRemoval(block));
    }

    private boolean handleExplosionRemoval(Block block) {
        if (!isWorkstationBlock(block)) {
            return false;
        }

        removeWorkstation(block);
        block.setType(Material.AIR);
        block.getWorld().dropItemNaturally(block.getLocation().add(new Vector(0.5, 0.1, 0.5)), createWorkstationItem());
        return true;
    }

    /**
     * Opens the custom GUI when players interact with the workstation.
     */
    @EventHandler
    public void onPlayerInteract(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK) {
            return;
        }

        Block block = event.getClickedBlock();
        if (block == null || !isWorkstationBlock(block)) {
            return;
        }

        event.setCancelled(true);
        Player player = event.getPlayer();
        plugin.getPacketHandler().sendOpenGuiPacket(player);
    }

    /**
     * Compact immutable key representing a block's location.
     */
    private record BlockLocationKey(UUID worldId, int x, int y, int z) {

        static BlockLocationKey fromBlock(Block block) {
            Location loc = block.getLocation();
            return new BlockLocationKey(loc.getWorld().getUID(), loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        }

        static BlockLocationKey fromString(String raw) {
            if (raw == null || raw.isEmpty()) {
                return null;
            }
            String[] parts = raw.split(",");
            if (parts.length != 4) {
                return null;
            }
            try {
                UUID world = UUID.fromString(parts[0]);
                int x = Integer.parseInt(parts[1]);
                int y = Integer.parseInt(parts[2]);
                int z = Integer.parseInt(parts[3]);
                return new BlockLocationKey(world, x, y, z);
            } catch (IllegalArgumentException ex) {
                return null;
            }
        }

        String asString() {
            return worldId + "," + x + "," + y + "," + z;
        }
    }
}
