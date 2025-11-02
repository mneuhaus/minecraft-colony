package com.bannergenerator;

import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.inventory.RecipeChoice;
import org.bukkit.inventory.ShapedRecipe;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Main plugin class for BannerGenerator
 * Creates a custom workstation block for generating letter banners
 */
public class BannerGeneratorPlugin extends JavaPlugin {

    private WorkstationManager workstationManager;
    private BannerGuiManager guiManager;
    private PacketHandler packetHandler;

    @Override
    public void onEnable() {
        getLogger().info("BannerGenerator is starting up!");

        // Initialize managers
        workstationManager = new WorkstationManager(this);
        guiManager = new BannerGuiManager();
        packetHandler = new PacketHandler(this);

        // Register event listeners
        getServer().getPluginManager().registerEvents(workstationManager, this);
        getServer().getPluginManager().registerEvents(guiManager, this);

        // Register packet channels
        packetHandler.register();

        // Load persisted workstation data
        workstationManager.loadWorkstations();

        // Ensure data folder exists for future saves
        if (!getDataFolder().exists() && !getDataFolder().mkdirs()) {
            getLogger().warning("Unable to create plugin data folder; workstation data will not persist.");
        }

        // Load custom recipes
        loadRecipes();

        getLogger().info("BannerGenerator enabled successfully!");
    }

    /**
     * Loads custom crafting recipes
     */
    private void loadRecipes() {
        NamespacedKey key = new NamespacedKey(this, "banner_workstation");
        getServer().removeRecipe(key);

        ShapedRecipe recipe = new ShapedRecipe(key, workstationManager.createWorkstationItem());
        recipe.shape("BBB", "PCP", "WWW");
        recipe.setIngredient('B', new RecipeChoice.MaterialChoice(
                Material.WHITE_BANNER, Material.ORANGE_BANNER, Material.MAGENTA_BANNER, Material.LIGHT_BLUE_BANNER,
                Material.YELLOW_BANNER, Material.LIME_BANNER, Material.PINK_BANNER, Material.GRAY_BANNER,
                Material.LIGHT_GRAY_BANNER, Material.CYAN_BANNER, Material.PURPLE_BANNER, Material.BLUE_BANNER,
                Material.BROWN_BANNER, Material.GREEN_BANNER, Material.RED_BANNER, Material.BLACK_BANNER
        ));
        recipe.setIngredient('P', Material.PAPER);
        recipe.setIngredient('C', Material.CARTOGRAPHY_TABLE);
        recipe.setIngredient('W', new RecipeChoice.MaterialChoice(
                Material.OAK_PLANKS, Material.SPRUCE_PLANKS, Material.BIRCH_PLANKS, Material.JUNGLE_PLANKS,
                Material.ACACIA_PLANKS, Material.DARK_OAK_PLANKS, Material.MANGROVE_PLANKS, Material.CHERRY_PLANKS,
                Material.BAMBOO_PLANKS, Material.CRIMSON_PLANKS, Material.WARPED_PLANKS
        ));

        Bukkit.addRecipe(recipe);
        getLogger().info("Custom recipes loaded!");
    }

    @Override
    public void onDisable() {
        workstationManager.saveWorkstations();
        packetHandler.unregister();
        getLogger().info("BannerGenerator is shutting down!");
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (command.getName().equalsIgnoreCase("bannergenerator")) {
            if (!(sender instanceof Player)) {
                sender.sendMessage("This command can only be used by players!");
                return true;
            }

            Player player = (Player) sender;

            // Give the player a banner workstation block
            workstationManager.giveWorkstationBlock(player);
            player.sendMessage("§aYou received a Banner Workstation! Place it and right-click to use.");

            return true;
        }
        return false;
    }

    public WorkstationManager getWorkstationManager() {
        return workstationManager;
    }

    public BannerGuiManager getGuiManager() {
        return guiManager;
    }

    public PacketHandler getPacketHandler() {
        return packetHandler;
    }
}
