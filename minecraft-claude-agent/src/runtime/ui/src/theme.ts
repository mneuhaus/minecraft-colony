import type { GlobalThemeOverrides } from 'naive-ui';

// Clean, readable dark theme for debugging
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#4a9eff',
    primaryColorHover: '#6bb0ff',
    primaryColorPressed: '#3a8eef',
    primaryColorSuppl: '#5ca3ff',

    infoColor: '#4a9eff',
    infoColorHover: '#6bb0ff',
    infoColorPressed: '#3a8eef',

    successColor: '#52c41a',
    successColorHover: '#73d13d',
    successColorPressed: '#389e0d',

    warningColor: '#faad14',
    warningColorHover: '#ffc53d',
    warningColorPressed: '#d48806',

    errorColor: '#f5222d',
    errorColorHover: '#ff4d4f',
    errorColorPressed: '#cf1322',

    bodyColor: '#141517',
    cardColor: '#1e2024',
    modalColor: '#1e2024',
    popoverColor: '#2a2d33',
    hoverColor: 'rgba(255, 255, 255, 0.06)',

    textColorBase: '#e3e5e8',
    textColor1: '#eff0f2',
    textColor2: '#d1d5db',
    textColor3: '#9ca3af',

    borderColor: '#2d3139',
    dividerColor: '#2d3139',

    borderRadius: '6px',
    borderRadiusSmall: '4px',
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: '14px',
    fontSizeMini: '12px',
    fontSizeTiny: '12px',
    fontSizeSmall: '13px',
    fontSizeMedium: '14px',
    fontSizeLarge: '15px',
    fontSizeHuge: '17px',
  },
  Layout: {
    color: '#141517',
    siderColor: '#1a1d24',
    headerColor: '#1a1d24',
    footerColor: '#1a1d24',
    siderBorderColor: '#2d3139',
    headerBorderColor: '#2d3139',
  },
  Card: {
    borderRadius: '6px',
    color: '#1e2024',
    colorEmbedded: '#1a1d24',
    borderColor: '#2d3139',
    paddingMedium: '16px 20px',
    paddingLarge: '20px 24px',
  },
  DataTable: {
    thColor: '#1a1d24',
    tdColor: '#1e2024',
    borderColor: '#2d3139',
  },
  Timeline: {
    lineColor: '#3a3f4b',
    contentTextColor: '#d1d5db',
  },
  Progress: {
    railColor: '#2d3139',
  },
  Badge: {
    fontWeight: '500',
  },
  Tag: {
    borderRadius: '4px',
  },
  Button: {
    borderRadiusMedium: '6px',
    borderRadiusLarge: '6px',
  },
};
