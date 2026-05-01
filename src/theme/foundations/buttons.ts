import { TextStyle, ViewStyle } from 'react-native';
import { KIS_TOKENS, KISTone, KISPalette } from '../constants';
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
    tone === 'dark' ? 'rgba(108,74,242,0.22)' : 'rgba(108,74,242,0.16)';

  const baseContainer: ViewStyle = {
    height: tokens.controlHeights.md,
    paddingHorizontal: 16,
    borderRadius: tokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  };

  const textBase: TextStyle = {
    fontSize: tokens.typography.title,
    fontWeight: tokens.typography.weight.bold,
    fontFamily: FONT_FAMILIES.body,
  };

  return {
    primary: {
      container: { ...baseContainer, backgroundColor: palette.primary },
      text: { ...textBase, color: palette.onPrimary },
    },
    secondary: {
      container: {
        ...baseContainer,
        backgroundColor: secondarySoft,
        borderWidth: 2,
        borderColor: palette.secondary,
      },
      text: { ...textBase, color: palette.secondary },
    },
    outline: {
      container: {
        ...baseContainer,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: palette.primaryStrong,
      },
      text: { ...textBase, color: palette.primaryStrong },
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
        height: 32,
        paddingHorizontal: 10,
        borderRadius: tokens.radius.sm,
      },
      sm: {
        height: tokens.controlHeights.sm,
        paddingHorizontal: 12,
        borderRadius: tokens.radius.md,
      },
      md: {
        height: tokens.controlHeights.md,
      },
      lg: {
        height: tokens.controlHeights.lg,
        paddingHorizontal: 20,
        borderRadius: tokens.radius.xl,
      },
    },
  };
};
