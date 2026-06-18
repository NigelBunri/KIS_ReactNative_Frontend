import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
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
  const insets = useSafeAreaInsets();
  const { bodyFontSize, labelFontSize, headerTitleSize, pageGutter } = useResponsiveLayout();
  const displayEmpty = !loading && !error && !data;
  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={palette.primary} />}
    >
      <Text style={[styles.title, { color: palette.text, fontSize: headerTitleSize }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: palette.subtext, fontSize: bodyFontSize }]}>{subtitle}</Text>
      ) : null}
      <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
      {loading && !data ? (
        <View style={styles.loadingRow}>
          <InsightSkeleton />
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorWrap}>
          <Text style={{ color: palette.danger }}>{error}</Text>
          <Pressable
            onPress={onRefresh}
            style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: palette.primary, borderRadius: 8, alignSelf: 'center' }}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '600' }}>Retry</Text>
          </Pressable>
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
          <Text style={[styles.sectionTitle, { color: palette.text, fontSize: labelFontSize + 2 }]}>Trend</Text>
          <LineChart series={data.series} />
        </View>
      ) : null}
      {data?.breakdown?.length ? (
        <View style={styles.chartWrap}>
          <Text style={[styles.sectionTitle, { color: palette.text, fontSize: labelFontSize + 2 }]}>Breakdown</Text>
          <BarChart data={data.breakdown} />
        </View>
      ) : null}
      {data?.distribution?.length ? (
        <View style={styles.chartWrap}>
          <Text style={[styles.sectionTitle, { color: palette.text, fontSize: labelFontSize + 2 }]}>Distribution</Text>
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
  },
  title: {
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    fontWeight: '500',
    marginBottom: 10,
  },
  sectionTitle: {
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
