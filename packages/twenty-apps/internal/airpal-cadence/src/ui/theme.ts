import { createContext, useContext } from 'react';

// Colours and sizes close to Twenty's own UI (twenty-ui theme), as plain
// values: front components render in a sandbox without Twenty's stylesheet,
// so everything is an inline style.

export type Theme = {
  font: string;
  fontSize: string;
  smallFontSize: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentText: string;
  accentBackground: string;
  danger: string;
  dangerBackground: string;
  dangerBorder: string;
  warning: string;
  warningBackground: string;
  success: string;
  successBackground: string;
  radius: string;
};

const SHARED = {
  font: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: '13px',
  smallFontSize: '12px',
  radius: '4px',
};

export const LIGHT_THEME: Theme = {
  ...SHARED,
  text: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  background: '#ffffff',
  backgroundSecondary: '#fcfcfc',
  backgroundTertiary: '#f1f1f1',
  border: '#ebebeb',
  borderStrong: '#d6d6d6',
  accent: '#1961ed',
  accentText: '#ffffff',
  accentBackground: '#f0f4ff',
  danger: '#d92d20',
  dangerBackground: '#fff1f0',
  dangerBorder: '#f5c2c0',
  warning: '#b54708',
  warningBackground: '#fffaeb',
  success: '#027a48',
  successBackground: '#ecfdf3',
};

export const DARK_THEME: Theme = {
  ...SHARED,
  text: '#ebebeb',
  textSecondary: '#b3b3b3',
  textTertiary: '#818181',
  background: '#171717',
  backgroundSecondary: '#1b1b1b',
  backgroundTertiary: '#262626',
  border: '#333333',
  borderStrong: '#4d4d4d',
  accent: '#5e90f2',
  accentText: '#ffffff',
  accentBackground: '#1c2740',
  danger: '#f97066',
  dangerBackground: '#3a1714',
  dangerBorder: '#7a271a',
  warning: '#fdb022',
  warningBackground: '#3a2a0c',
  success: '#32d583',
  successBackground: '#0f2d1e',
};

export const themeFor = (scheme: 'light' | 'dark'): Theme =>
  scheme === 'dark' ? DARK_THEME : LIGHT_THEME;

export const ThemeContext = createContext<Theme>(LIGHT_THEME);

export const useTheme = () => useContext(ThemeContext);
