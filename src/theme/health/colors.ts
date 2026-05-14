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
  gradientStart: '#2A0F45',
  gradientEnd: '#09070D',
  background: '#09070D',
  surface: '#15101F',
  chrome: '#07050B',
  card: '#15101F',
  cardAccent: '#20112F',
  text: '#F7F1E3',
  subtext: '#C8BFD6',
  accentPrimary: '#C9A24A',
  accentSecondary: '#6E35B7',
  primary: '#9A6A14',
  textSecondary: '#C8BFD6',
  divider: '#30213F',
  shadow: 'rgba(0, 0, 0, 0.88)',
};

const lightPalette: HealthThemeColors = {
  gradientStart: '#FFFBF2',
  gradientEnd: '#F8F1E3',
  background: '#FFFBF2',
  surface: '#FFFFFF',
  chrome: 'transparent',
  card: '#FFFFFF',
  cardAccent: '#F8F1E3',
  text: '#19110A',
  subtext: '#675E71',
  accentPrimary: '#C9A24A',
  accentSecondary: '#4B1D78',
  primary: '#9A6A14',
  textSecondary: '#675E71',
  divider: '#E6D7B2',
  shadow: 'rgba(23, 17, 31, 0.10)',
};

export const getHealthThemeColors = (scheme: 'dark' | 'light' = 'dark'): HealthThemeColors =>
  scheme === 'dark' ? darkPalette : lightPalette;
