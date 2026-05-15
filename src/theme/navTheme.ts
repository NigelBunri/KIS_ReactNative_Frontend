// src/theme/navTheme.ts
import { DefaultTheme, DarkTheme, Theme as NavTheme } from '@react-navigation/native';
import { createPalette, KISTone } from './constants';

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
  const palette = createPalette(tone);
  const isLight = tone === 'light';

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.goldReadable,
      background: palette.bg,
      card: isLight ? '#FFFFFF' : palette.card,
      text: palette.text,
      border: palette.goldBorder,
      notification: palette.badgeBg,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium:  { fontFamily: 'System', fontWeight: '600' }, // or '500' if you prefer
      bold:    { fontFamily: 'System', fontWeight: '700' },
      heavy:   { fontFamily: 'System', fontWeight: '800' }, // satisfies the required 'heavy'
    },
  };
}
