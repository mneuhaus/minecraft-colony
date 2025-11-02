package com.bannergenerator.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;
import net.minecraft.util.DyeColor;

/**
 * Custom GUI screen for the Banner Generator.
 * Provides a clean interface for entering text and selecting colors.
 */
public class BannerGeneratorScreen extends Screen {

    private static final int GUI_WIDTH = 256;
    private static final int GUI_HEIGHT = 166;

    private TextFieldWidget textInput;
    private String selectedBannerColor = "WHITE";
    private String selectedDyeColor = "BLACK";
    private int guiLeft;
    private int guiTop;

    public BannerGeneratorScreen() {
        super(Text.literal("Banner Workstation"));
    }

    @Override
    protected void init() {
        super.init();

        // Center the GUI
        this.guiLeft = (this.width - GUI_WIDTH) / 2;
        this.guiTop = (this.height - GUI_HEIGHT) / 2;

        // Text input field
        this.textInput = new TextFieldWidget(
                this.textRenderer,
                guiLeft + 30,
                guiTop + 40,
                196,
                20,
                Text.literal("Enter text")
        );
        this.textInput.setMaxLength(20);
        this.textInput.setPlaceholder(Text.literal("Type your text here..."));
        this.addSelectableChild(this.textInput);
        this.setInitialFocus(this.textInput);

        // Banner color selection buttons
        int colorY = guiTop + 75;
        int colorX = guiLeft + 30;

        // Add a few color options for demo
        this.addDrawableChild(ButtonWidget.builder(
                Text.literal("White"),
                button -> selectedBannerColor = "WHITE"
        ).dimensions(colorX, colorY, 60, 20).build());

        this.addDrawableChild(ButtonWidget.builder(
                Text.literal("Red"),
                button -> selectedBannerColor = "RED"
        ).dimensions(colorX + 65, colorY, 60, 20).build());

        this.addDrawableChild(ButtonWidget.builder(
                Text.literal("Blue"),
                button -> selectedBannerColor = "BLUE"
        ).dimensions(colorX + 130, colorY, 60, 20).build());

        // Dye color selection
        colorY = guiTop + 100;

        this.addDrawableChild(ButtonWidget.builder(
                Text.literal("Black"),
                button -> selectedDyeColor = "BLACK"
        ).dimensions(colorX, colorY, 60, 20).build());

        this.addDrawableChild(ButtonWidget.builder(
                Text.literal("White"),
                button -> selectedDyeColor = "WHITE"
        ).dimensions(colorX + 65, colorY, 60, 20).build());

        this.addDrawableChild(ButtonWidget.builder(
                Text.literal("Yellow"),
                button -> selectedDyeColor = "YELLOW"
        ).dimensions(colorX + 130, colorY, 60, 20).build());

        // Generate button
        this.addDrawableChild(ButtonWidget.builder(
                Text.literal("Generate Banners"),
                button -> this.generateBanners()
        ).dimensions(guiLeft + 58, guiTop + 135, 140, 20).build());
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        // Render dark background
        context.fill(0, 0, this.width, this.height, 0xC0101010);

        // Render GUI background
        context.fill(guiLeft, guiTop, guiLeft + GUI_WIDTH, guiTop + GUI_HEIGHT, 0xFF2D2D2D);

        // Render border
        context.drawBorder(guiLeft, guiTop, GUI_WIDTH, GUI_HEIGHT, 0xFF8B8B8B);

        // Render title
        context.drawText(
                this.textRenderer,
                this.title,
                guiLeft + (GUI_WIDTH - this.textRenderer.getWidth(this.title)) / 2,
                guiTop + 10,
                0xFFD700,
                true
        );

        // Labels
        context.drawText(
                this.textRenderer,
                Text.literal("Text:"),
                guiLeft + 10,
                guiTop + 45,
                0xFFFFFF,
                false
        );

        context.drawText(
                this.textRenderer,
                Text.literal("Banner Color:"),
                guiLeft + 10,
                guiTop + 65,
                0xFFFFFF,
                false
        );

        context.drawText(
                this.textRenderer,
                Text.literal("Dye Color:"),
                guiLeft + 10,
                guiTop + 90,
                0xFFFFFF,
                false
        );

        // Render text field
        this.textInput.render(context, mouseX, mouseY, delta);

        super.render(context, mouseX, mouseY, delta);
    }

    private void generateBanners() {
        String text = this.textInput.getText();

        if (text.isEmpty()) {
            return;
        }

        // Send packet to server
        BannerGeneratorClient.sendGenerateRequest(text, selectedBannerColor, selectedDyeColor);

        // Close the screen
        this.close();
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
