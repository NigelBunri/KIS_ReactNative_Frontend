// src/theme/useTheme.ts
import { useColorScheme } from 'react-native';
import type { TextStyle } from 'react-native';
import {
  KIS_COLORS,
  KIS_TOKENS,
  KISTone,
  createPalette,
  KISPalette,
} from './constants';
import { TYPOGRAPHY_PRESETS } from './foundations/typography';
import type { TypographyPreset } from './foundations/fonts';
import { ICON_SIZES, IconTone, getIconColor } from './foundations/icons';
import { useAgeMode } from './ageModeContext';
import { useThemeMode } from './themeModeContext';

// Maps the stored key (older_adult) to the ageModes object key (olderAdult).
const toAgeModeKey = (mode: string) => (mode === 'older_adult' ? 'olderAdult' : mode) as keyof typeof KIS_TOKENS.accessibility.ageModes;

export function useKISTheme(forced?: KISTone) {
  const sys = useColorScheme();
  const { themeMode } = useThemeMode();
  const resolvedSys = themeMode === 'system' ? sys : themeMode;
  const tone: KISTone = forced ?? (resolvedSys === 'dark' ? 'dark' : 'light');
  const { ageMode } = useAgeMode();

  const palette: KISPalette = createPalette(tone);

  const ageModeTokens = KIS_TOKENS.accessibility.ageModes[toAgeModeKey(ageMode)] ?? KIS_TOKENS.accessibility.ageModes.adult;
  const { fontScale, minTouchTarget } = ageModeTokens;

  // Native Text receives the age multiplier through the subscribed runtime
  // wrapper. Keep typography at its base size here so text is scaled once.
  const tokens = (fontScale === 1
    ? KIS_TOKENS
    : {
        ...KIS_TOKENS,
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
      }) as typeof KIS_TOKENS;

  // Build a scaled getStyle that uses the age-adjusted tokens.typography sizes.
  const getStyle = (preset: TypographyPreset, color?: string): TextStyle => {
    const base = TYPOGRAPHY_PRESETS[preset] ?? TYPOGRAPHY_PRESETS.body;
    const scaledFontSize: number = (() => {
      switch (preset) {
        case 'h1':    return tokens.typography.h1;
        case 'h2':    return tokens.typography.h2;
        case 'h3':    return tokens.typography.h3;
        case 'title': return tokens.typography.title;
        case 'body':  return tokens.typography.body;
        case 'input': return tokens.typography.input;
        case 'label': return tokens.typography.label;
        case 'helper':return tokens.typography.helper;
        case 'caption':
        case 'tiny':  return tokens.typography.tiny;
        default:      return base.fontSize;
      }
    })();
    const style: TextStyle = {
      fontFamily: base.fontFamily,
      fontSize: scaledFontSize,
      fontWeight: base.fontWeight as TextStyle['fontWeight'],
      lineHeight: Math.round(base.lineHeight * (scaledFontSize / base.fontSize)),
    };
    return color ? { ...style, color } : style;
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
      getStyle,
    },
    icons: {
      sizes: ICON_SIZES,
      getColor: (toneParam?: IconTone) => getIconColor(palette, toneParam),
    },
  };
}
