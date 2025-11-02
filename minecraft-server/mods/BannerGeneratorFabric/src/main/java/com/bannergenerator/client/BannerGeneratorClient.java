package com.bannergenerator.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.MinecraftClient;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.util.Identifier;

/**
 * Client-side entry point for Banner Generator Fabric mod.
 * Handles custom packet communication with the Paper server.
 */
public class BannerGeneratorClient implements ClientModInitializer {

    public static final String MOD_ID = "bannergenerator";
    public static final Identifier OPEN_GUI_PACKET = Identifier.of(MOD_ID, "open_gui");
    public static final Identifier GENERATE_PACKET = Identifier.of(MOD_ID, "generate");

    @Override
    public void onInitializeClient() {
        // Register packet handler for server → client "open GUI" command
        ClientPlayNetworking.registerGlobalReceiver(OPEN_GUI_PACKET, this::handleOpenGui);

        System.out.println("[BannerGenerator] Client mod initialized!");
    }

    /**
     * Called when the server tells us to open the Banner Generator GUI
     */
    private void handleOpenGui(MinecraftClient client,
                               net.minecraft.client.network.ClientPlayNetworkHandler handler,
                               PacketByteBuf buf,
                               net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking.PacketSender responseSender) {

        // Read any initial data from server (optional)
        // For now, just open the screen

        client.execute(() -> {
            client.setScreen(new BannerGeneratorScreen());
        });
    }

    /**
     * Send generation request to server
     */
    public static void sendGenerateRequest(String text, String bannerColor, String dyeColor) {
        PacketByteBuf buf = ClientPlayNetworking.createC2SPacket(GENERATE_PACKET);
        buf.writeString(text);
        buf.writeString(bannerColor);
        buf.writeString(dyeColor);

        ClientPlayNetworking.send(GENERATE_PACKET, buf);
    }
}
