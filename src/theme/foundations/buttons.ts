import { TextStyle, ViewStyle } from 'react-native';
import { KIS_COMPONENT_TOKENS, KIS_TOKENS, KISTone, KISPalette } from '../constants';
import { FONT_FAMILIES } from './fonts';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

type ButtonRecipe = {
  container: ViewStyle;
  text: TextStyle;
};

type ButtonRecipes = Record<ButtonVariant, ButtonRecipe> & {
  sizes: Record<ButtonSize, ViewStyle>;
};

export const createButtonStyles = (
  tone: KISTone,
  palette: KISPalette,
  tokens: typeof KIS_TOKENS,
): ButtonRecipes => {
  const secondarySoft =
    tone === 'dark' ? 'rgba(201,162,74,0.18)' : 'rgba(75,29,120,0.08)';

  const baseContainer: ViewStyle = {
    minHeight: KIS_COMPONENT_TOKENS.button.minHeight,
    paddingHorizontal: KIS_COMPONENT_TOKENS.button.horizontalPadding,
    borderRadius: KIS_COMPONENT_TOKENS.button.radius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  };

  const textBase: TextStyle = {
    fontSize: tokens.typography.title,
    fontWeight: tokens.typography.weight.bold,
    fontFamily: FONT_FAMILIES.body,
    flexShrink: 1,
    textAlign: 'center',
    includeFontPadding: false,
  };

  return {
    primary: {
      container: { ...baseContainer, backgroundColor: palette.primary, overflow: 'hidden' },
      text: { ...textBase, color: palette.onPrimary },
    },
    secondary: {
      container: {
        ...baseContainer,
        backgroundColor: secondarySoft,
        borderWidth: KIS_COMPONENT_TOKENS.button.borderWidth,
        borderColor: palette.goldBorder,
      },
      text: { ...textBase, color: tone === 'dark' ? palette.goldReadable : palette.selectedText },
    },
    outline: {
      container: {
        ...baseContainer,
        backgroundColor: 'transparent',
        borderWidth: KIS_COMPONENT_TOKENS.button.borderWidth,
        borderColor: palette.goldBorder,
      },
      text: { ...textBase, color: tone === 'dark' ? palette.goldReadable : palette.selectedText },
    },
    ghost: {
      container: { ...baseContainer, backgroundColor: 'transparent' },
      text: { ...textBase, color: palette.primaryStrong },
    },
    danger: {
      container: {
        ...baseContainer,
        backgroundColor: palette.error,
      },
      text: { ...textBase, color: palette.onPrimary },
    },
    sizes: {
      xs: {
        minHeight: tokens.controlHeights.xs,
        paddingHorizontal: 10,
        borderRadius: tokens.radius.sm,
      },
      sm: {
        minHeight: tokens.controlHeights.sm,
        paddingHorizontal: 12,
        borderRadius: tokens.radius.md,
      },
      md: {
        minHeight: tokens.controlHeights.md,
      },
      lg: {
        minHeight: tokens.controlHeights.lg,
        paddingHorizontal: 20,
        borderRadius: tokens.radius.xl,
      },
    },
  };
};
