// src/screens/calls/components/CallTimer.tsx
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useCallTimer } from '../hooks/useCallTimer';

type Props = {
  startedAt: string | null | undefined;
  running: boolean;
  color?: string;
  size?: number;
  showDot?: boolean;
};

export default function CallTimer({ startedAt, running, color = '#fff', size = 14, showDot }: Props) {
  const { label } = useCallTimer(startedAt, running);
  return (
    <View style={styles.row}>
      {showDot && <View style={[styles.dot, running && styles.dotLive]} />}
      <Text style={[styles.text, { color, fontSize: size }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontVariant: ['tabular-nums'], fontWeight: '600', letterSpacing: 0.5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#888' },
  dotLive: { backgroundColor: '#E52B2B' },
});
