import { KISPalette } from '../constants';

export const ICON_SIZES = {
  tiny: 14,
  small: 18,
  medium: 22,
  large: 28,
  xl: 34,
} as const;

export type IconTone = 'muted' | 'primary' | 'secondary' | 'danger';

/** Centralizes icon color choices so every icon follows the same palette rules. */
export const getIconColor = (palette: KISPalette, tone: IconTone = 'muted') => {
  switch (tone) {
    case 'primary':
      return palette.primary;
    case 'secondary':
      return palette.secondary;
    case 'danger':
      return palette.danger;
    default:
      return palette.subtext;
  }
};
