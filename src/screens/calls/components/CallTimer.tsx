// src/screens/calls/components/CallTimer.tsx
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useCallTimer } from '../hooks/useCallTimer';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  startedAt: string | null | undefined;
  running: boolean;
  color?: string;
  size?: number;
  showDot?: boolean;
};

export default function CallTimer({ startedAt, running, color, size = 14, showDot }: Props) {
  const { palette } = useKISTheme();
  const { label } = useCallTimer(startedAt, running);
  const resolvedColor = color ?? palette.ivory;
  return (
    <View style={styles.row}>
      {showDot && <View style={[styles.dot, { backgroundColor: palette.subtext }, running && { backgroundColor: palette.danger }]} />}
      <Text style={[styles.text, { color: resolvedColor, fontSize: size }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontVariant: ['tabular-nums'], fontWeight: '600', letterSpacing: 0.5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
