import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { InsightKpi } from '@/api/insights/types';

type Props = {
  kpi: InsightKpi;
};

export default function KpiTile({ kpi }: Props) {
  const { palette } = useKISTheme();
  const changeText =
    typeof kpi.change === 'number'
      ? `${kpi.change > 0 ? '+' : ''}${kpi.change.toFixed(1)}%`
      : typeof kpi.change === 'string'
      ? kpi.change
      : null;
  const changeColor = kpi.change && Number(kpi.change) >= 0 ? palette.success : palette.error;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.label, { color: palette.subtext }]} numberOfLines={1}>
        {kpi.label}
      </Text>
      <Text style={[styles.value, { color: palette.text }]}>
        {kpi.value}
        {kpi.unit ? ` ${kpi.unit}` : ''}
      </Text>
      {changeText ? (
        <View style={styles.changeRow}>
          <Text style={[styles.change, { color: changeColor }]}>{changeText}</Text>
          {kpi.trend ? <View style={[styles.trendIndicator, { backgroundColor: changeColor }]} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 94,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 6,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  change: {
    fontSize: 12,
    fontWeight: '700',
  },
  trendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
