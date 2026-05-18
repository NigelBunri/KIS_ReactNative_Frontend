import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

type Props = {
  children: React.ReactNode;
  style?: any;
};

export default function BibleSectionCard({ children, style }: Props) {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          padding: responsive.isWatch ? 10 : responsive.isCompactPhone ? 12 : 16,
          borderRadius: responsive.isWatch ? 12 : 16,
          gap: responsive.cardGap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
});
