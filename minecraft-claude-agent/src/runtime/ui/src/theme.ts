import type { GlobalThemeOverrides } from 'naive-ui';

// Minecraft-inspired dark theme with better colors
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#5cb85c', // Minecraft grass green
    primaryColorHover: '#6fd86f',
    primaryColorPressed: '#4a9e4a',
    primaryColorSuppl: '#7ee07e',

    infoColor: '#4a9eff', // Sky blue
    infoColorHover: '#6bb0ff',
    infoColorPressed: '#3a8eef',

    successColor: '#5cb85c', // Green (emerald)
    successColorHover: '#6fd86f',
    successColorPressed: '#4a9e4a',

    warningColor: '#f0ad4e', // Gold/amber
    warningColorHover: '#f2bd6e',
    warningColorPressed: '#e09d3e',

    errorColor: '#d9534f', // Redstone red
    errorColorHover: '#e17370',
    errorColorPressed: '#c9433f',

    // Background colors
    bodyColor: '#0f1115', // Very dark gray
    cardColor: '#1c1e24', // Dark card background
    modalColor: '#1c1e24',
    popoverColor: '#252830',
    hoverColor: 'rgba(255, 255, 255, 0.05)',

    // Text colors
    textColorBase: '#e5e7eb', // Light gray text
    textColor1: '#f3f4f6',
    textColor2: '#d1d5db',
    textColor3: '#9ca3af',

    // Border colors
    borderColor: '#2d3139',
    dividerColor: '#2d3139',

    // Additional
    borderRadius: '8px',
    borderRadiusSmall: '4px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: '15px',
    fontSizeMini: '13px',
    fontSizeTiny: '13px',
    fontSizeSmall: '14px',
    fontSizeMedium: '15px',
    fontSizeLarge: '16px',
    fontSizeHuge: '18px',
  },
  Layout: {
    color: '#0f1115',
    siderColor: '#16181d',
    headerColor: '#16181d',
    footerColor: '#16181d',
    siderBorderColor: '#2d3139',
    headerBorderColor: '#2d3139',
  },
  Card: {
    borderRadius: '8px',
    color: '#1c1e24',
    colorEmbedded: '#16181d',
    paddingMedium: '16px 20px',
    paddingLarge: '20px 24px',
  },
  DataTable: {
    thColor: '#16181d',
    tdColor: '#1c1e24',
    borderColor: '#2d3139',
  },
  Timeline: {
    lineColor: '#2d3139',
    contentTextColor: '#d1d5db',
  },
  Progress: {
    railColor: '#2d3139',
  },
  Badge: {
    color: '#5cb85c',
    textColor: '#ffffff',
  },
  Tag: {
    borderRadius: '4px',
  },
  Button: {
    borderRadiusMedium: '6px',
    borderRadiusLarge: '8px',
  },
};
