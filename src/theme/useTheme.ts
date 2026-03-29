// src/theme/useTheme.ts
import { useColorScheme } from 'react-native';
import {
  KIS_COLORS,
  KIS_TOKENS,
  KISTone,
  createPalette,
  KISPalette,
} from './constants';
import { getTypographyStyle, TYPOGRAPHY_PRESETS } from './foundations/typography';
import { ICON_SIZES, IconTone, getIconColor } from './foundations/icons';

export function useKISTheme(forced?: KISTone) {
  const sys = useColorScheme();
  const tone: KISTone = forced ?? (sys === 'dark' ? 'dark' : 'light');

  const palette: KISPalette = createPalette(tone);
  const tokens = KIS_TOKENS;

  return {
    tone,
    isDark: tone === 'dark',
    palette,
    tokens,
    brand: KIS_COLORS.brand,
    typography: {
      presets: TYPOGRAPHY_PRESETS,
      getStyle: getTypographyStyle,
    },
    icons: {
      sizes: ICON_SIZES,
      getColor: (toneParam?: IconTone) => getIconColor(palette, toneParam),
    },
  };
}
