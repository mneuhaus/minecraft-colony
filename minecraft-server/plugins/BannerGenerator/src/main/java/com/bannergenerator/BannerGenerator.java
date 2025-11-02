package com.bannergenerator;

import org.bukkit.DyeColor;
import org.bukkit.Material;
import org.bukkit.block.banner.Pattern;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.BannerMeta;

import java.util.ArrayList;
import java.util.List;

/**
 * Generates banner items with letter patterns
 * Combines background color with text color to create readable letter banners
 */
public class BannerGenerator {

    /**
     * Generates an array of banner items, one for each character in the text
     *
     * @param text The text to convert to banners
     * @param backgroundColor The base color of the banner (background)
     * @param textColor The color of the letter pattern (foreground/text)
     * @return Array of banner ItemStacks with letter patterns
     */
    public ItemStack[] generateLetterBanners(String text, DyeColor backgroundColor, DyeColor textColor) {
        List<ItemStack> banners = new ArrayList<>();

        // Process each character
        for (char c : text.toCharArray()) {
            ItemStack banner = createLetterBanner(c, backgroundColor, textColor);
            banners.add(banner);
        }

        return banners.toArray(new ItemStack[0]);
    }

    /**
     * Creates a single banner item for a specific character
     *
     * @param c The character to create a banner for
     * @param backgroundColor The base banner color
     * @param textColor The letter pattern color
     * @return Banner ItemStack with the letter pattern
     */
    private ItemStack createLetterBanner(char c, DyeColor backgroundColor, DyeColor textColor) {
        // Create a banner with the background color
        Material bannerMaterial = getBannerMaterial(backgroundColor);
        ItemStack banner = new ItemStack(bannerMaterial);

        // Get the banner meta to add patterns
        BannerMeta meta = (BannerMeta) banner.getItemMeta();
        if (meta == null) {
            return banner; // Return plain banner if meta is null
        }

        // Get the patterns for this character
        List<Pattern> patterns = LetterPatterns.getPatternsForChar(c, textColor);

        // Add all patterns to the banner
        for (Pattern pattern : patterns) {
            meta.addPattern(pattern);
        }

        // Set display name to show what letter this is
        String displayName = (c == ' ') ? "§f[Space]" : "§f" + c;
        meta.setDisplayName("§6Letter Banner: " + displayName);

        // Add lore with color info
        List<String> lore = new ArrayList<>();
        lore.add("§7Background: §f" + formatColorName(backgroundColor));
        lore.add("§7Text: §f" + formatColorName(textColor));
        meta.setLore(lore);

        banner.setItemMeta(meta);
        return banner;
    }

    /**
     * Gets the banner material for a specific color
     *
     * @param color The dye color
     * @return The corresponding banner material
     */
    private Material getBannerMaterial(DyeColor color) {
        switch (color) {
            case WHITE: return Material.WHITE_BANNER;
            case ORANGE: return Material.ORANGE_BANNER;
            case MAGENTA: return Material.MAGENTA_BANNER;
            case LIGHT_BLUE: return Material.LIGHT_BLUE_BANNER;
            case YELLOW: return Material.YELLOW_BANNER;
            case LIME: return Material.LIME_BANNER;
            case PINK: return Material.PINK_BANNER;
            case GRAY: return Material.GRAY_BANNER;
            case LIGHT_GRAY: return Material.LIGHT_GRAY_BANNER;
            case CYAN: return Material.CYAN_BANNER;
            case PURPLE: return Material.PURPLE_BANNER;
            case BLUE: return Material.BLUE_BANNER;
            case BROWN: return Material.BROWN_BANNER;
            case GREEN: return Material.GREEN_BANNER;
            case RED: return Material.RED_BANNER;
            case BLACK: return Material.BLACK_BANNER;
            default: return Material.WHITE_BANNER;
        }
    }

    /**
     * Formats a color name to be more readable
     *
     * @param color The dye color
     * @return Formatted color name
     */
    private String formatColorName(DyeColor color) {
        String name = color.name().replace('_', ' ');
        // Capitalize first letter of each word
        String[] words = name.toLowerCase().split(" ");
        StringBuilder result = new StringBuilder();
        for (String word : words) {
            if (word.length() > 0) {
                result.append(Character.toUpperCase(word.charAt(0)))
                      .append(word.substring(1))
                      .append(" ");
            }
        }
        return result.toString().trim();
    }
}
