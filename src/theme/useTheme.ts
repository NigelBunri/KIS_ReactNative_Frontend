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
import { useAgeMode } from './ageModeContext';

// Maps the stored key (older_adult) to the ageModes object key (olderAdult).
const toAgeModeKey = (mode: string) => (mode === 'older_adult' ? 'olderAdult' : mode) as keyof typeof KIS_TOKENS.accessibility.ageModes;

export function useKISTheme(forced?: KISTone) {
  const sys = useColorScheme();
  const tone: KISTone = forced ?? (sys === 'dark' ? 'dark' : 'light');
  const { ageMode } = useAgeMode();

  const palette: KISPalette = createPalette(tone);

  const ageModeTokens = KIS_TOKENS.accessibility.ageModes[toAgeModeKey(ageMode)] ?? KIS_TOKENS.accessibility.ageModes.adult;
  const { fontScale, minTouchTarget } = ageModeTokens;

  // Only allocate a new tokens object when the scale is non-1 to avoid
  // unnecessary object churn on every render for the default adult/youth modes.
  const tokens = fontScale === 1
    ? KIS_TOKENS
    : {
        ...KIS_TOKENS,
        typography: {
          ...KIS_TOKENS.typography,
          h1:    Math.round(KIS_TOKENS.typography.h1    * fontScale),
          h2:    Math.round(KIS_TOKENS.typography.h2    * fontScale),
          h3:    Math.round(KIS_TOKENS.typography.h3    * fontScale),
          title: Math.round(KIS_TOKENS.typography.title * fontScale),
          body:  Math.round(KIS_TOKENS.typography.body  * fontScale),
          input: Math.round(KIS_TOKENS.typography.input * fontScale),
          label: Math.round(KIS_TOKENS.typography.label * fontScale),
          helper:Math.round(KIS_TOKENS.typography.helper* fontScale),
          tiny:  Math.round(KIS_TOKENS.typography.tiny  * fontScale),
        },
        controlHeights: {
          xs:    Math.round(KIS_TOKENS.controlHeights.xs * fontScale),
          sm:    Math.round(KIS_TOKENS.controlHeights.sm * fontScale),
          md:    Math.max(minTouchTarget, Math.round(KIS_TOKENS.controlHeights.md * fontScale)),
          lg:    Math.round(KIS_TOKENS.controlHeights.lg * fontScale),
          touch: Math.max(minTouchTarget, KIS_TOKENS.controlHeights.touch),
        },
        accessibility: {
          ...KIS_TOKENS.accessibility,
          minTouchTarget,
        },
      };

  return {
    tone,
    isDark: tone === 'dark',
    palette,
    tokens,
    ageMode,
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
