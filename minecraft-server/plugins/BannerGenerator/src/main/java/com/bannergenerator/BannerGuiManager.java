package com.bannergenerator;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.DyeColor;
import org.bukkit.Material;
import org.bukkit.Sound;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.PrepareAnvilEvent;
import org.bukkit.inventory.AnvilInventory;
import org.bukkit.inventory.InventoryView;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Provides the anvil-based Banner Workstation UI with multi-letter support.
 */
public class BannerGuiManager implements Listener {

    private static final String TITLE = "§6§l✦ Banner Workstation ✦";
    private static final int LEFT_SLOT = 0;
    private static final int RIGHT_SLOT = 1;
    private static final int RESULT_SLOT = 2;

    private static final String ALLOWED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?., ";

    private final BannerGenerator bannerGenerator = new BannerGenerator();
    private final Set<UUID> activePlayers = ConcurrentHashMap.newKeySet();
    private final Map<UUID, String> lastInput = new ConcurrentHashMap<>();

    /**
     * Opens the workstation UI for a player.
     */
    public void openBannerGui(Player player) {
        InventoryView view = player.openAnvil(null, true);
        AnvilInventory anvil = null;
        if (view != null && view.getTopInventory() instanceof AnvilInventory) {
            anvil = (AnvilInventory) view.getTopInventory();
            view.setTitle(TITLE);
        }

        if (anvil == null) {
            anvil = (AnvilInventory) player.getServer().createInventory(null, org.bukkit.event.inventory.InventoryType.ANVIL, TITLE);
            player.openInventory(anvil);
        }

        UUID id = player.getUniqueId();
        activePlayers.add(id);
        lastInput.putIfAbsent(id, "");
        player.sendMessage(Component.text("Place a banner on the left, dye on the right, then type your text in the anvil field.", NamedTextColor.YELLOW));
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPrepareAnvil(PrepareAnvilEvent event) {
        if (!(event.getView().getPlayer() instanceof Player player) || !activePlayers.contains(player.getUniqueId())) {
            return;
        }

        AnvilInventory anvil = event.getInventory();
        if (anvil == null) {
            return;
        }

        ItemStack bannerInput = anvil.getItem(LEFT_SLOT);
        ItemStack dyeInput = anvil.getItem(RIGHT_SLOT);

        if (!isBanner(bannerInput) || !isDye(dyeInput)) {
            event.setResult(null);
            anvil.setRepairCost(0);
            return;
        }

        UUID id = player.getUniqueId();
        String previous = lastInput.getOrDefault(id, "");
        String renameRaw = anvil.getRenameText();

        if (isDefaultBannerName(renameRaw, bannerInput)) {
            renameRaw = previous;
        }

        String sanitized = sanitizeText(renameRaw);

        if (sanitized.isEmpty() && !previous.isEmpty()) {
            sanitized = previous;
        }

        if (sanitized.isEmpty()) {
            event.setResult(null);
            anvil.setRepairCost(0);
            return;
        }

        ItemStack[] generated = bannerGenerator.generateLetterBanners(sanitized, getBannerColor(bannerInput), getDyeColor(dyeInput));
        if (generated.length == 0) {
            event.setResult(null);
            anvil.setRepairCost(0);
            return;
        }

        lastInput.put(id, sanitized);

        ItemStack preview = generated[0].clone();
        ItemMeta meta = preview.getItemMeta();
        if (meta != null) {
            meta.displayName(Component.text("Preview: " + sanitized.charAt(0), NamedTextColor.GOLD));
            List<Component> lore = new ArrayList<>();
            lore.add(Component.text("Text: " + sanitized, NamedTextColor.YELLOW));
            lore.add(Component.text("Letters to create: " + sanitized.length(), NamedTextColor.GRAY));
            meta.lore(lore);
            preview.setItemMeta(meta);
        }

        event.setResult(preview);
        anvil.setRepairCost(0);
    }

    @EventHandler(priority = EventPriority.NORMAL)
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }

        UUID id = player.getUniqueId();
        if (!activePlayers.contains(id)) {
            return;
        }

        if (!(event.getView().getTopInventory() instanceof AnvilInventory anvil)) {
            return;
        }

        int rawSlot = event.getRawSlot();
        if (rawSlot >= anvil.getSize()) {
            return; // Allow interactions with player inventory
        }

        if (event.isShiftClick()) {
            event.setCancelled(true);
            return;
        }

        if (rawSlot == LEFT_SLOT || rawSlot == RIGHT_SLOT) {
            return;
        }

        if (rawSlot != RESULT_SLOT) {
            event.setCancelled(true);
            return;
        }

        event.setCancelled(true);

        ItemStack bannerInput = anvil.getItem(LEFT_SLOT);
        ItemStack dyeInput = anvil.getItem(RIGHT_SLOT);

        if (!isBanner(bannerInput)) {
            player.sendMessage(Component.text("Place a banner in the left slot first.", NamedTextColor.RED));
            return;
        }

        if (!isDye(dyeInput)) {
            player.sendMessage(Component.text("Place dye in the right slot first.", NamedTextColor.RED));
            return;
        }

        String renameRaw = anvil.getRenameText();
        if (isDefaultBannerName(renameRaw, bannerInput)) {
            renameRaw = lastInput.getOrDefault(id, "");
        }

        String sanitized = sanitizeText(renameRaw);
        if (sanitized.isEmpty()) {
            sanitized = lastInput.getOrDefault(id, "");
        }

        if (sanitized.isEmpty()) {
            player.sendMessage(Component.text("Type a single character using A-Z, 0-9, space, ! ? . ,", NamedTextColor.RED));
            return;
        }

        lastInput.put(id, sanitized);

        ItemStack[] banners = bannerGenerator.generateLetterBanners(sanitized, getBannerColor(bannerInput), getDyeColor(dyeInput));
        distributeBanners(player, banners);

        consumeOne(anvil, LEFT_SLOT);
        consumeOne(anvil, RIGHT_SLOT);
        anvil.setItem(RESULT_SLOT, null);
        anvil.setRepairCost(0);
        player.updateInventory();

        player.playSound(player.getLocation(), Sound.BLOCK_ANVIL_USE, 1.0f, 1.4f);
        player.sendMessage(Component.text("Created " + banners.length + " banner(s) for \"" + sanitized + "\".", NamedTextColor.GREEN));
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onInventoryClose(InventoryCloseEvent event) {
        if (!(event.getPlayer() instanceof Player player)) {
            return;
        }

        UUID id = player.getUniqueId();
        if (!activePlayers.remove(id)) {
            return;
        }

        lastInput.remove(id);

        if (!(event.getInventory() instanceof AnvilInventory inventory)) {
            return;
        }

        returnItem(player, inventory, LEFT_SLOT);
        returnItem(player, inventory, RIGHT_SLOT);
        returnItem(player, inventory, RESULT_SLOT);
    }

    private void distributeBanners(Player player, ItemStack[] banners) {
        for (ItemStack banner : banners) {
            Map<Integer, ItemStack> leftover = player.getInventory().addItem(banner.clone());
            if (!leftover.isEmpty()) {
                leftover.values().forEach(item -> player.getWorld().dropItemNaturally(player.getLocation(), item));
            }
        }
    }

    private void consumeOne(AnvilInventory inventory, int slot) {
        ItemStack stack = inventory.getItem(slot);
        if (stack == null) {
            return;
        }
        if (stack.getAmount() <= 1) {
            inventory.setItem(slot, null);
        } else {
            stack.setAmount(stack.getAmount() - 1);
        }
    }

    private void returnItem(Player player, AnvilInventory inventory, int slot) {
        ItemStack item = inventory.getItem(slot);
        if (item == null || item.getType() == Material.AIR) {
            return;
        }
        Map<Integer, ItemStack> leftover = player.getInventory().addItem(item);
        inventory.setItem(slot, null);
        leftover.values().forEach(remaining -> player.getWorld().dropItemNaturally(player.getLocation(), remaining));
    }

    private boolean isBanner(ItemStack item) {
        return item != null && item.getType().name().endsWith("_BANNER");
    }

    private boolean isDye(ItemStack item) {
        return item != null && item.getType().name().endsWith("_DYE");
    }

    private DyeColor getBannerColor(ItemStack banner) {
        String colorName = banner.getType().name().replace("_BANNER", "");
        try {
            return DyeColor.valueOf(colorName);
        } catch (IllegalArgumentException ex) {
            return DyeColor.WHITE;
        }
    }

    private DyeColor getDyeColor(ItemStack dye) {
        String colorName = dye.getType().name().replace("_DYE", "");
        try {
            return DyeColor.valueOf(colorName);
        } catch (IllegalArgumentException ex) {
            return DyeColor.BLACK;
        }
    }

    private String sanitizeText(String input) {
        if (input == null) {
            return "";
        }
        char[] chars = input.toCharArray();
        for (char c : chars) {
            char upper = Character.toUpperCase(c);
            if (ALLOWED_CHARS.indexOf(upper) >= 0) {
                return upper == ' ' ? " " : String.valueOf(upper);
            }
        }
        return "";
    }

    private boolean isDefaultBannerName(String renameText, ItemStack banner) {
        if (renameText == null || banner == null) {
            return false;
        }
        ItemMeta meta = banner.getItemMeta();
        if (meta != null && meta.hasDisplayName()) {
            return false;
        }
        String expected = formatMaterialName(banner.getType());
        return renameText.equalsIgnoreCase(expected);
    }

    private String formatMaterialName(Material material) {
        String[] parts = material.name().split("_");
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (builder.length() > 0) {
                builder.append(' ');
            }
            if (part.isEmpty()) {
                continue;
            }
            builder.append(part.charAt(0)).append(part.substring(1).toLowerCase());
        }
        return builder.toString();
    }
}
