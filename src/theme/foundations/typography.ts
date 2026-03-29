import { TEXT_PRESETS, TypographyPreset } from './fonts';
import type { TextStyle } from 'react-native';

export type TypographyStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: TextStyle['fontWeight'];
  lineHeight: number;
};

/** Re-exported presets so consumers only need one import path. */
export const TYPOGRAPHY_PRESETS = TEXT_PRESETS;

/** Helper to merge color overrides into preset styles. */
export const getTypographyStyle = (
  preset: TypographyPreset,
  color?: string,
): TextStyle => {
  const base = TYPOGRAPHY_PRESETS[preset] ?? TYPOGRAPHY_PRESETS.body;
  const style: TextStyle = {
    fontFamily: base.fontFamily,
    fontSize: base.fontSize,
    fontWeight: base.fontWeight as TextStyle['fontWeight'],
    lineHeight: base.lineHeight,
  };
  return color ? { ...style, color } : style;
};
