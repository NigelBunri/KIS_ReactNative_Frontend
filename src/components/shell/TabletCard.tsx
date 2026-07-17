// src/components/shell/TabletCard.tsx
//
// Shared rounded/soft-shadow card primitive for the tablet shell — sidebar
// sections, context-panel cards, and reflowed content cards all use this so
// spacing/radius/shadow stay consistent instead of each new component
// hardcoding its own numbers. Pulls exclusively from KIS_COMPONENT_TOKENS /
// useKISTheme() (no new palette values), per the "no hardcoded colors" rule.
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KIS_COMPONENT_TOKENS } from '@/theme/constants';

export function TabletCard({
  children,
  style,
  elevated = true,
  padding,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  elevated?: boolean;
  padding?: number;
}) {
  const { palette, tone } = useKISTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: palette.surface,
          borderColor: palette.goldBorder,
          padding: padding ?? KIS_COMPONENT_TOKENS.card.padding,
        },
        elevated && {
          shadowColor: palette.shadow,
          shadowOpacity: tone === 'dark' ? 0.24 : 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: tone === 'dark' ? 6 : 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: KIS_COMPONENT_TOKENS.card.radius,
    borderWidth: 1,
  },
});

export default TabletCard;
