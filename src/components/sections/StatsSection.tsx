import React from 'react';
import { Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

export default function StatsSection({ data, palette, typography, spacing }: SectionRenderProps) {
  const metrics = Array.isArray(data?.metrics) ? data.metrics : [];
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.h3, color: palette.text }}>{data?.title || 'Metrics'}</Text>
      <View style={{ marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {metrics.map((metric: any) => (
          <View key={metric.id || metric.label} style={{ width: '31%', borderRadius: spacing.sm, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.sm }}>
            <Text style={{ ...typography.caption, color: palette.subtext }}>{metric.label}</Text>
            <Text style={{ ...typography.h3, color: palette.text, marginTop: spacing.xs }}>{metric.value}</Text>
          </View>
        ))}
        {metrics.length === 0 ? <Text style={{ ...typography.body, color: palette.subtext }}>No metrics defined.</Text> : null}
      </View>
    </View>
  );
}
