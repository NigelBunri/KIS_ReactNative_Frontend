import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../profile/profile.styles';
import type { KISPalette } from '@/theme/constants';

type SnapshotStat = { label: string; value: number };

type Props = {
  palette: KISPalette;
  stats: SnapshotStat[];
};

export default function ImpactSnapshotSection({ palette, stats }: Props) {
  if (!stats.length) return null;

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: palette.card, borderColor: palette.divider, borderWidth: 1 },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Impact Snapshot</Text>
        <Text style={[styles.subtext, { color: palette.subtext }]}>Quick analytics</Text>
      </View>
      <View style={styles.statRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}> 
            <Text style={[styles.statValue, { color: palette.text }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
