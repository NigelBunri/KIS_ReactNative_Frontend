import { Platform } from 'react-native';
import { KIS_TOKENS } from '../constants';

/** System-inspired font stack so every screen uses the same core families. */
const SYSTEM_FONT = Platform.select({
  ios: 'SF Pro Display',
  android: 'Roboto',
  default: 'System',
}) as string;

export const FONT_FAMILIES = {
  display: SYSTEM_FONT,
  body: SYSTEM_FONT,
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }) as string,
};

export const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/** Predefined typography styles derived from global tokens (keeps UI consistent). */
export const TEXT_PRESETS = {
  h1: {
    fontFamily: FONT_FAMILIES.display,
    fontSize: KIS_TOKENS.typography.h1,
    fontWeight: FONT_WEIGHTS.extrabold,
    lineHeight: 36,
  },
  h2: {
    fontFamily: FONT_FAMILIES.display,
    fontSize: KIS_TOKENS.typography.h2,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: 32,
  },
  h3: {
    fontFamily: FONT_FAMILIES.display,
    fontSize: KIS_TOKENS.typography.h3,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: 28,
  },
  title: {
    fontFamily: FONT_FAMILIES.display,
    fontSize: KIS_TOKENS.typography.title,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: 24,
  },
  body: {
    fontFamily: FONT_FAMILIES.body,
    fontSize: KIS_TOKENS.typography.body,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 22,
  },
  input: {
    fontFamily: FONT_FAMILIES.body,
    fontSize: KIS_TOKENS.typography.input,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 20,
  },
  label: {
    fontFamily: FONT_FAMILIES.display,
    fontSize: KIS_TOKENS.typography.label,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: 18,
  },
  helper: {
    fontFamily: FONT_FAMILIES.body,
    fontSize: KIS_TOKENS.typography.helper,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 16,
  },
  caption: {
    fontFamily: FONT_FAMILIES.body,
    fontSize: KIS_TOKENS.typography.tiny,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 16,
  },
  tiny: {
    fontFamily: FONT_FAMILIES.body,
    fontSize: KIS_TOKENS.typography.tiny,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: 16,
  },
} as const;

export type TypographyPreset = keyof typeof TEXT_PRESETS;

export const createTypographyStyle = (preset: TypographyPreset) => TEXT_PRESETS[preset];
