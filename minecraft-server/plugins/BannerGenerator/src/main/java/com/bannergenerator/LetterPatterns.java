package com.bannergenerator;

import org.bukkit.block.banner.Pattern;
import org.bukkit.block.banner.PatternType;
import org.bukkit.DyeColor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Defines banner patterns for each letter, number, and symbol
 * Each pattern array represents the layers needed to create the letter
 */
public class LetterPatterns {

    /**
     * Gets the banner patterns for a specific character
     * @param c The character to get patterns for
     * @param textColor The color to use for the letter itself
     * @return List of patterns that form the letter
     */
    public static List<Pattern> getPatternsForChar(char c, DyeColor textColor) {
        List<Pattern> patterns = new ArrayList<>();

        // Convert to uppercase
        c = Character.toUpperCase(c);

        switch (c) {
            // Letters A-Z
            case 'A':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                break;

            case 'B':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                break;

            case 'C':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                break;

            case 'D':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                break;

            case 'E':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                break;

            case 'F':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                break;

            case 'G':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.HALF_HORIZONTAL_BOTTOM));
                break;

            case 'H':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                break;

            case 'I':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_CENTER));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                break;

            case 'J':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_LEFT));
                break;

            case 'K':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.DIAGONAL_UP_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_DOWNRIGHT));
                break;

            case 'L':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                break;

            case 'M':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.TRIANGLE_TOP));
                break;

            case 'N':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_DOWNRIGHT));
                break;

            case 'O':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                break;

            case 'P':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.HALF_VERTICAL_RIGHT));
                break;

            case 'Q':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_RIGHT));
                break;

            case 'R':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_DOWNRIGHT));
                break;

            case 'S':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_TOP_LEFT));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_RIGHT));
                break;

            case 'T':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_CENTER));
                break;

            case 'U':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                break;

            case 'V':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_DOWNLEFT));
                break;

            case 'W':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.TRIANGLE_BOTTOM));
                break;

            case 'X':
                patterns.add(new Pattern(textColor, PatternType.DIAGONAL_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_DOWNRIGHT));
                break;

            case 'Y':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_DOWNRIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_DOWNLEFT));
                patterns.add(new Pattern(textColor, PatternType.HALF_VERTICAL));
                break;

            case 'Z':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_DOWNLEFT));
                break;

            // Numbers 0-9
            case '0':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_DOWNLEFT));
                break;

            case '1':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_CENTER));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_TOP_LEFT));
                break;

            case '2':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_TOP_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_LEFT));
                break;

            case '3':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                break;

            case '4':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.HALF_HORIZONTAL_BOTTOM));
                break;

            case '5':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_TOP_LEFT));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_RIGHT));
                break;

            case '6':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_RIGHT));
                break;

            case '7':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                break;

            case '8':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_LEFT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_BOTTOM));
                break;

            case '9':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_MIDDLE));
                patterns.add(new Pattern(textColor, PatternType.STRIPE_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_TOP_LEFT));
                break;

            // Special characters
            case '!':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_CENTER));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_LEFT));
                break;

            case '?':
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.HALF_VERTICAL_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_LEFT));
                break;

            case '.':
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_LEFT));
                break;

            case ',':
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_LEFT));
                patterns.add(new Pattern(textColor, PatternType.BORDER));
                break;

            case ' ':
                // Space - no patterns, just the background color
                break;

            default:
                // Unknown character - use a question mark pattern
                patterns.add(new Pattern(textColor, PatternType.STRIPE_TOP));
                patterns.add(new Pattern(textColor, PatternType.HALF_VERTICAL_RIGHT));
                patterns.add(new Pattern(textColor, PatternType.SQUARE_BOTTOM_LEFT));
                break;
        }

        return patterns;
    }
}
