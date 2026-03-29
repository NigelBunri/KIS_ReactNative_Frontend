import React from 'react';
import { StyleSheet, View } from 'react-native';
import KpiTile from './KpiTile';
import type { InsightKpi } from '@/api/insights/types';

type Props = {
  items: InsightKpi[];
};

export default function KpiGrid({ items }: Props) {
  if (!items.length) return null;
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.id} style={styles.tileWrap}>
          <KpiTile kpi={item} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileWrap: {
    flexBasis: '48%',
    marginBottom: 12,
  },
});
