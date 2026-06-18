export type HealthThemeColors = {
  gradientStart: string;
  gradientEnd: string;
  background: string;
  bg: string;
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
  gradientStart: '#211331',
  gradientEnd: '#09070D',
  background: '#09070D',
  bg: '#09070D',
  surface: '#15101F',
  chrome: '#07050B',
  card: '#15101F',
  cardAccent: '#20112F',
  text: '#F7F1E3',
  subtext: '#C8BFD6',
  accentPrimary: '#E7C76D',
  accentSecondary: '#6E35B7',
  primary: '#E7C76D',
  textSecondary: '#C8BFD6',
  divider: 'rgba(231,199,109,0.34)',
  shadow: 'rgba(0, 0, 0, 0.88)',
};

const lightPalette: HealthThemeColors = {
  gradientStart: '#FFFFFF',
  gradientEnd: '#FFF9EE',
  background: '#FFFFFF',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  chrome: 'transparent',
  card: '#FFFFFF',
  cardAccent: '#FFF9EE',
  text: '#4B2F2A',
  subtext: '#7A6258',
  accentPrimary: '#9A6A14',
  accentSecondary: '#4B1D78',
  primary: '#5E3B0A',
  textSecondary: '#7A6258',
  divider: '#D9A875',
  shadow: 'rgba(23, 17, 31, 0.10)',
};

export const getHealthThemeColors = (scheme: 'dark' | 'light' = 'dark'): HealthThemeColors =>
  scheme === 'dark' ? darkPalette : lightPalette;
