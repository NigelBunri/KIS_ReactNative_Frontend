import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useKISTheme } from '@/theme/useTheme';

type GradientPoint = { x: number; y: number };

type GoldHeaderShellProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: readonly string[];
  /** Defaults to the diagonal every screen has always used. Override only
   * when this shell's gradient must seam perfectly with another gradient
   * box below it (e.g. a tab bar sharing the same colors) — a diagonal's
   * color at its bottom edge depends on this box's own height, so two
   * independently-diagonal boxes stacked vertically can never match at
   * their border. A shared horizontal direction (same y for start/end) has
   * no such dependency: color only varies by x, so any two boxes using the
   * same colors/start/end blend perfectly regardless of each box's height. */
  gradientStart?: GradientPoint;
  gradientEnd?: GradientPoint;
};

/**
 * Single source of truth for the gold gradient header shared by Messages,
 * Bible, Broadcast, Partners, and Profile — same colors/direction/corner
 * radius everywhere. Each screen supplies its own shape (shadow, extra
 * radius overrides), decorations (sheen/halo), and content via `style` /
 * children, exactly as before; only the gradient definition is centralized.
 *
 * The gradient is an absolutely-filled backdrop, not the flow element itself
 * (compare NetworkStatusPill, which similarly opts out of document flow and
 * computes its own position directly instead of inheriting one). This outer
 * View's height comes only from its normal-flow child (the content wrapper
 * below); the gradient then stretches to match those exact bounds — so it
 * bleeds behind the status bar and clears it for content automatically,
 * with no per-device offset to hand-tune, unlike the old negative-marginTop
 * approach this replaces.
 */
export function GoldHeaderShell({ children, style, colors, gradientStart, gradientEnd }: GoldHeaderShellProps) {
  const { gradients } = useKISTheme();
  return (
    <View style={[styles.base, style]}>
      <LinearGradient
        colors={(colors ?? gradients.header) as string[]}
        start={gradientStart ?? { x: 0, y: 0 }}
        end={gradientEnd ?? { x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ marginTop: 20 }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: 0,
  },
});

export default GoldHeaderShell;
