import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { InsightPayload, TimeRange } from '@/api/insights/types';
import {
  BarChart,
  DonutChart,
  InsightSkeleton,
  KpiGrid,
  LineChart,
  TimeRangeSelector,
  TopItemsList,
} from '@/components/insights';

type Props = {
  title: string;
  data: InsightPayload | null;
  loading: boolean;
  error?: string | null;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onRefresh: () => void;
  footer?: React.ReactNode;
  subtitle?: string;
};

export default function InsightLayout({
  title,
  data,
  loading,
  error,
  timeRange,
  onTimeRangeChange,
  onRefresh,
  subtitle,
  footer,
}: Props) {
  const { palette } = useKISTheme();
  const displayEmpty = !loading && !error && !data;
  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={palette.primary} />}
    >
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: palette.subtext }]}>{subtitle}</Text>
      ) : null}
      <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
      {loading && !data ? (
        <View style={styles.loadingRow}>
          <InsightSkeleton />
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorWrap}>
          <Text style={{ color: palette.error }}>{error}</Text>
          <Text style={{ color: palette.subtext }}>Pull to retry.</Text>
        </View>
      ) : null}
      {displayEmpty ? (
        <View style={styles.emptyWrap}>
          <Text style={{ color: palette.subtext }}>No insight data available yet.</Text>
        </View>
      ) : null}
      {data?.kpis?.length ? <KpiGrid items={data.kpis} /> : null}
      {data?.series?.length ? (
        <View style={styles.chartWrap}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Trend</Text>
          <LineChart series={data.series} />
        </View>
      ) : null}
      {data?.breakdown?.length ? (
        <View style={styles.chartWrap}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Breakdown</Text>
          <BarChart data={data.breakdown} />
        </View>
      ) : null}
      {data?.distribution?.length ? (
        <View style={styles.chartWrap}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Distribution</Text>
          <DonutChart data={data.distribution} />
        </View>
      ) : null}
      {data?.topItems?.length ? <TopItemsList title="Top Items" items={data.topItems} /> : null}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  chartWrap: {
    marginTop: 20,
  },
  loadingRow: {
    marginBottom: 12,
  },
  errorWrap: {
    paddingVertical: 12,
  },
  emptyWrap: {
    paddingVertical: 18,
  },
  footer: {
    marginTop: 16,
  },
});
