// src/theme/navTheme.ts
import { DefaultTheme, DarkTheme, Theme as NavTheme } from '@react-navigation/native';
import { KIS_COLORS, KISTone } from './constants';

type FontStyle = { fontFamily: string; fontWeight: 'normal' | '400' | '500' | '600' | '700' | '800' | 'bold' };
type KISNavTheme = NavTheme & {
  fonts: {
    regular: FontStyle;
    medium: FontStyle;
    bold: FontStyle;
    heavy: FontStyle; // required by your types.d.ts
  };
};

export function makeNavTheme(tone: KISTone): KISNavTheme {
  const base = tone === 'dark' ? DarkTheme : DefaultTheme;
  const c = tone === 'dark' ? KIS_COLORS.dark : KIS_COLORS.light;
  const isLight = tone === 'light';

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: KIS_COLORS.brand.primary,
      background: c.bg,
      card: isLight ? KIS_COLORS.brand.purpleDeep : c.card,
      text: isLight ? KIS_COLORS.brand.ivory : c.text,
      border: isLight ? KIS_COLORS.brand.goldDeep : c.divider,
      notification: isLight ? KIS_COLORS.brand.gold : KIS_COLORS.brand.secondary,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium:  { fontFamily: 'System', fontWeight: '600' }, // or '500' if you prefer
      bold:    { fontFamily: 'System', fontWeight: '700' },
      heavy:   { fontFamily: 'System', fontWeight: '800' }, // satisfies the required 'heavy'
    },
  };
}
