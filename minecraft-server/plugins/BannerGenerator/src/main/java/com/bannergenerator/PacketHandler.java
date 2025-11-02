package com.bannergenerator;

import io.papermc.paper.network.ChannelInitializeListenerHolder;
import org.bukkit.Bukkit;
import org.bukkit.DyeColor;
import org.bukkit.entity.Player;
import org.bukkit.plugin.messaging.PluginMessageListener;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;

/**
 * Handles custom packet communication between Paper server and Fabric client.
 */
public class PacketHandler implements PluginMessageListener {

    private static final String CHANNEL_NAMESPACE = "bannergenerator";
    private static final String OPEN_GUI_CHANNEL = CHANNEL_NAMESPACE + ":open_gui";
    private static final String GENERATE_CHANNEL = CHANNEL_NAMESPACE + ":generate";

    private final BannerGeneratorPlugin plugin;
    private final BannerGenerator bannerGenerator = new BannerGenerator();

    public PacketHandler(BannerGeneratorPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Register packet channels with the server
     */
    public void register() {
        // Register outgoing channel (server → client)
        Bukkit.getMessenger().registerOutgoingPluginChannel(plugin, OPEN_GUI_CHANNEL);

        // Register incoming channel (client → server)
        Bukkit.getMessenger().registerIncomingPluginChannel(plugin, GENERATE_CHANNEL, this);

        plugin.getLogger().info("Registered plugin messaging channels");
    }

    /**
     * Unregister channels on plugin disable
     */
    public void unregister() {
        Bukkit.getMessenger().unregisterIncomingPluginChannel(plugin, GENERATE_CHANNEL);
        Bukkit.getMessenger().unregisterOutgoingPluginChannel(plugin, OPEN_GUI_CHANNEL);
    }

    /**
     * Send packet to client telling them to open the GUI
     */
    public void sendOpenGuiPacket(Player player) {
        try {
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            DataOutputStream out = new DataOutputStream(stream);

            // Can send initial data here if needed
            // For now, just send empty packet

            player.sendPluginMessage(plugin, OPEN_GUI_CHANNEL, stream.toByteArray());
        } catch (IOException e) {
            plugin.getLogger().warning("Failed to send open GUI packet: " + e.getMessage());
        }
    }

    /**
     * Receive generation request from client
     */
    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!channel.equals(GENERATE_CHANNEL)) {
            return;
        }

        try {
            ByteArrayInputStream stream = new ByteArrayInputStream(message);
            DataInputStream in = new DataInputStream(stream);

            // Read data from client
            String text = in.readUTF();
            String bannerColorName = in.readUTF();
            String dyeColorName = in.readUTF();

            // Validate and parse colors
            DyeColor bannerColor;
            DyeColor dyeColor;

            try {
                bannerColor = DyeColor.valueOf(bannerColorName.toUpperCase());
            } catch (IllegalArgumentException e) {
                bannerColor = DyeColor.WHITE;
            }

            try {
                dyeColor = DyeColor.valueOf(dyeColorName.toUpperCase());
            } catch (IllegalArgumentException e) {
                dyeColor = DyeColor.BLACK;
            }

            // Sanitize text
            String cleaned = text.toUpperCase().replaceAll("[^A-Z0-9 !?.,]", "");
            if (cleaned.isEmpty() || cleaned.length() > 20) {
                return;
            }

            // Generate banners
            var banners = bannerGenerator.generateLetterBanners(cleaned, bannerColor, dyeColor);

            // Give to player
            for (var banner : banners) {
                player.getInventory().addItem(banner.clone());
            }

            player.sendMessage("§aCreated " + banners.length + " banner(s) for \"" + cleaned + "\"!");

        } catch (IOException e) {
            plugin.getLogger().warning("Failed to read generate packet: " + e.getMessage());
        }
    }
}
