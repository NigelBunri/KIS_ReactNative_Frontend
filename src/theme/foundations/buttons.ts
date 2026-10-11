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
    tone === 'dark' ? 'rgba(122,75,62,0.18)' : 'rgba(75,29,120,0.08)';

  const baseContainer: ViewStyle = {
    minHeight: KIS_COMPONENT_TOKENS.button.minHeight,
    paddingHorizontal: KIS_COMPONENT_TOKENS.button.horizontalPadding,
    // Every "selected"/button affordance in this app (Calls' join button,
    // Communities' Feed/Groups segmented control, the pre-existing
    // MessagesScreen tab bar) was fully pill-shaped — never the smaller
    // rounded-rectangle radius this used to read from KIS_COMPONENT_TOKENS.
    // button.radius. That mismatch is exactly what made the app-wide
    // button-consistency pass (which made KISButton ubiquitous) visibly
    // regress every tab bar/segmented control it touched to square-ish
    // corners. pillRadius already existed as a token for this; it just
    // wasn't wired in.
    borderRadius: KIS_COMPONENT_TOKENS.button.pillRadius,
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
      text: { ...textBase, color: palette.onGold },
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
    // No per-size borderRadius overrides — every size stays pill-shaped via
    // baseContainer's radius above, same as the app's original design
    // language (a tab bar and a big CTA both read as "pill", just taller
    // or shorter).
    sizes: {
      xs: {
        minHeight: tokens.controlHeights.xs,
        paddingHorizontal: 10,
      },
      sm: {
        minHeight: tokens.controlHeights.sm,
        paddingHorizontal: 12,
      },
      md: {
        minHeight: tokens.controlHeights.md,
      },
      lg: {
        minHeight: tokens.controlHeights.lg,
        paddingHorizontal: 20,
      },
    },
  };
};
