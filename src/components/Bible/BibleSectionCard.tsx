import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  children: React.ReactNode;
  style?: any;
};

export default function BibleSectionCard({ children, style }: Props) {
  const { palette } = useKISTheme();
  return <View style={[styles.card, { backgroundColor: palette.card }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
});
