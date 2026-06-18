// src/screens/broadcast/channels/studio/ImpressionsAnalyticsPanel.tsx
//
// Analytics sub-panel showing impressions, views, CTR, and avg watch time data.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d';

type ContentRow = {
  content_id: string;
  title: string;
  impressions: number;
  views: number;
  ctr_percent: number;
};

type ImpressionsData = {
  total_impressions?: number;
  total_views?: number;
  ctr_percent?: number;
  avg_watch_time_seconds?: number;
  by_content?: ContentRow[];
};

type Props = {
  channelId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCtr = (pct: number) => `${pct.toFixed(1)}%`;

const fmtWatchTime = (seconds: number) => {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds)}s`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImpressionsAnalyticsPanel({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<ImpressionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        `${ROUTES.broadcasts.channelAnalyticsImpressions(channelId)}?period=${p}`,
        { errorMessage: '' },
      );
      setData(res?.data ?? res ?? {});
    } catch {
      setError('Could not load impressions data.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchData(period);
  }, [fetchData, period]);

  const summaryCards = [
    {
      label: 'Total Impressions',
      primary: (data?.total_impressions ?? 0).toLocaleString(),
    },
    {
      label: 'Total Views',
      primary: (data?.total_views ?? 0).toLocaleString(),
    },
    {
      label: 'CTR',
      primary: fmtCtr(data?.ctr_percent ?? 0),
    },
    {
      label: 'Avg Watch Time',
      primary: fmtWatchTime(data?.avg_watch_time_seconds ?? 0),
    },
  ];

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={[styles.errorText, { color: palette.subtext }]}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.surface }]}
      contentContainerStyle={styles.content}
    >
      {/* Period selector */}
      <View style={styles.pillRow}>
        {PERIODS.map(p => {
          const active = period === p.value;
          return (
            <Pressable
              key={p.value}
              onPress={() => setPeriod(p.value)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? palette.primaryStrong : (palette.surfaceElevated ?? palette.surface),
                  borderColor: active ? palette.primaryStrong : palette.border,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: active ? palette.onPrimary : palette.text }]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Summary cards grid */}
      <View style={styles.grid}>
        {summaryCards.map(card => (
          <View
            key={card.label}
            style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Text style={[styles.summaryPrimary, { color: palette.text }]}>{card.primary}</Text>
            <Text style={[styles.summaryLabel, { color: palette.primaryStrong }]}>{card.label}</Text>
          </View>
        ))}
      </View>

      {/* Per-content table */}
      {data?.by_content && data.by_content.length > 0 ? (
        <View style={[styles.tableSection, { borderColor: palette.border }]}>
          <Text style={[styles.tableTitle, { color: palette.text }]}>Per Content</Text>
          {/* Header row */}
          <View style={[styles.tableHeaderRow, { borderColor: palette.border }]}>
            <Text style={[styles.tableHeaderCell, styles.titleCell, { color: palette.subtext }]}>Title</Text>
            <Text style={[styles.tableHeaderCell, styles.numCell, { color: palette.subtext }]}>Impr.</Text>
            <Text style={[styles.tableHeaderCell, styles.numCell, { color: palette.subtext }]}>Views</Text>
            <Text style={[styles.tableHeaderCell, styles.ctrCell, { color: palette.subtext }]}>CTR</Text>
          </View>
          {data.by_content.map(row => (
            <View key={row.content_id} style={[styles.tableRow, { borderColor: palette.border }]}>
              <Text numberOfLines={1} style={[styles.tableCell, styles.titleCell, { color: palette.text }]}>
                {row.title || 'Untitled'}
              </Text>
              <Text style={[styles.tableCell, styles.numCell, { color: palette.text }]}>
                {row.impressions.toLocaleString()}
              </Text>
              <Text style={[styles.tableCell, styles.numCell, { color: palette.text }]}>
                {row.views.toLocaleString()}
              </Text>
              <Text style={[styles.tableCell, styles.ctrCell, { color: palette.primaryStrong }]}>
                {fmtCtr(row.ctr_percent)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptySection, { borderColor: palette.border }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            No impression data available for this period.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  summaryPrimary: { fontSize: 18, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },
  tableSection: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  tableTitle: { fontSize: 14, fontWeight: '800', padding: 12, paddingBottom: 8 },
  tableHeaderRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tableHeaderCell: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableCell: { fontSize: 12, fontWeight: '700' },
  titleCell: { flex: 1, paddingRight: 8 },
  numCell: { width: 56, textAlign: 'right' },
  ctrCell: { width: 44, textAlign: 'right', fontWeight: '800' },
  emptySection: { borderWidth: 1, borderRadius: 10, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
