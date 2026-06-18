// src/screens/broadcast/channels/studio/TrafficSourcesPanel.tsx
//
// Panel showing where channel views come from, with a proportional bar chart.

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

type TrafficSource = {
  source_type: string;
  view_count: number;
  watch_time_seconds: number;
  percent: number;
};

type TrafficData = {
  period?: string;
  sources?: TrafficSource[];
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

const SOURCE_LABELS: Record<string, string> = {
  search: '🔍 Search',
  browse: '🏠 Browse',
  external: '🌐 External',
  direct: '📎 Direct',
  recommended: '🎯 Recommended',
  notification: '🔔 Notification',
  playlist: '📋 Playlist',
  channel_page: '📺 Channel Page',
};

const labelFor = (sourceType: string): string =>
  SOURCE_LABELS[sourceType.toLowerCase()] ?? sourceType;

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrafficSourcesPanel({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        `${ROUTES.broadcasts.channelAnalyticsTrafficSources(channelId)}?period=${p}`,
        { errorMessage: '' },
      );
      setData(res?.data ?? res ?? {});
    } catch {
      setError('Could not load traffic sources.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchData(period);
  }, [fetchData, period]);

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

  const sources = data?.sources ?? [];

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

      {/* Bar chart */}
      {sources.length === 0 ? (
        <View style={[styles.emptySection, { borderColor: palette.border }]}>
          <Text style={[styles.emptyText, { color: palette.subtext }]}>
            No traffic source data available for this period.
          </Text>
        </View>
      ) : (
        <View style={[styles.chartSection, { borderColor: palette.border }]}>
          <Text style={[styles.chartTitle, { color: palette.text }]}>Traffic Sources</Text>
          {sources.map(source => {
            const pct = Math.min(100, Math.max(0, source.percent));
            return (
              <View key={source.source_type} style={styles.barRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.barLabel, { color: palette.text }]}
                >
                  {labelFor(source.source_type)}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: palette.border }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${pct}%` as any,
                        backgroundColor: palette.primaryStrong,
                        opacity: 0.75,
                      },
                    ]}
                  />
                </View>
                <View style={styles.barMeta}>
                  <Text style={[styles.barViews, { color: palette.text }]}>
                    {source.view_count.toLocaleString()}
                  </Text>
                  <Text style={[styles.barPct, { color: palette.subtext }]}>
                    {pct.toFixed(1)}%
                  </Text>
                </View>
              </View>
            );
          })}
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
    paddingVertical: 7,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  chartSection: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 12 },
  chartTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  barRow: { gap: 8 },
  barLabel: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  barTrack: { height: 12, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  barViews: { fontSize: 11, fontWeight: '700' },
  barPct: { fontSize: 11, fontWeight: '700' },
  emptySection: { borderWidth: 1, borderRadius: 10, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
