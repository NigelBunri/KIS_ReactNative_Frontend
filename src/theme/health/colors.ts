export type HealthThemeColors = {
  gradientStart: string;
  gradientEnd: string;
  background: string;
  surface: string;
  chrome: string;
  card: string;
  cardAccent: string;
  text: string;
  subtext: string;
  accentPrimary: string;
  accentSecondary: string;
  primary: string;
  textSecondary: string;
  divider: string;
  shadow: string;
};

const darkPalette: HealthThemeColors = {
  gradientStart: '#2F0A4B',
  gradientEnd: '#03030A',
  background: '#03030A',
  surface: '#12072A',
  chrome: '#0D061A',
  card: '#12072A',
  cardAccent: '#1F0B3A',
  text: '#F4F4FF',
  subtext: '#B7B6C7',
  accentPrimary: '#FF8A33',
  accentSecondary: '#8E3BFF',
  primary: '#FF8A33',
  textSecondary: '#B7B6C7',
  divider: '#3E2A5F',
  shadow: 'rgba(0, 0, 0, 0.85)',
};

const lightPalette: HealthThemeColors = {
  gradientStart: '#FFFFFF',
  gradientEnd: '#F5F6FB',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  chrome: 'transparent',
  card: '#FFFFFF',
  cardAccent: '#EDF0F5',
  text: '#0F172A',
  subtext: '#475569',
  accentPrimary: '#FF8A33',
  accentSecondary: '#8E3BFF',
  primary: '#FF8A33',
  textSecondary: '#475569',
  divider: '#D1D5DB',
  shadow: 'rgba(15, 23, 42, 0.08)',
};

export const getHealthThemeColors = (scheme: 'dark' | 'light' = 'dark'): HealthThemeColors =>
  scheme === 'dark' ? darkPalette : lightPalette;
