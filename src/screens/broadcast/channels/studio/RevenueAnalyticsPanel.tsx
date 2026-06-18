// src/screens/broadcast/channels/studio/RevenueAnalyticsPanel.tsx
//
// Revenue dashboard inside Channel Studio. Shows super-thanks, super-chat,
// memberships, and ad impressions with a simple proportional bar chart.

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

type RevenuePeriod = '7d' | '30d' | '90d';

type RevenueData = {
  super_thanks_amount?: number;
  super_thanks_count?: number;
  super_chat_amount?: number;
  super_chat_count?: number;
  memberships_active?: number;
  memberships_est_monthly?: number;
  ad_impressions?: number;
  currency?: string;
};

type Props = {
  channelId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS: Array<{ value: RevenuePeriod; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function RevenueAnalyticsPanel({ channelId }: Props) {
  const { palette } = useKISTheme();
  const [period, setPeriod] = useState<RevenuePeriod>('30d');
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = useCallback(async (p: RevenuePeriod) => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        `${ROUTES.broadcasts.channelRevenue(channelId)}?period=${p}`,
        { errorMessage: '' },
      );
      setData(res?.data ?? res ?? {});
    } catch {
      setError('Could not load revenue data.');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchRevenue(period);
  }, [fetchRevenue, period]);

  const currency = data?.currency ?? 'USD';
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const superThanks = (data?.super_thanks_amount ?? 0) / 100;
  const superChat = (data?.super_chat_amount ?? 0) / 100;
  const membershipsEst = data?.memberships_est_monthly ?? 0;
  const total = superThanks + superChat + membershipsEst;

  const barSegments = [
    { label: 'Super Thanks', value: superThanks, color: palette.gold },
    { label: 'Super Chat', value: superChat, color: palette.primary },
    { label: 'Memberships', value: membershipsEst, color: palette.success },
  ];

  const summaryCards = [
    {
      label: 'Super Thanks',
      primary: fmt((data?.super_thanks_amount ?? 0)),
      secondary: `${data?.super_thanks_count ?? 0} tips`,
    },
    {
      label: 'Super Chat',
      primary: fmt((data?.super_chat_amount ?? 0)),
      secondary: `${data?.super_thanks_count ?? 0} messages`,
    },
    {
      label: 'Memberships',
      primary: `${data?.memberships_active ?? 0} active`,
      secondary: `est. $${membershipsEst.toFixed(2)}/mo`,
    },
    {
      label: 'Ad Impressions',
      primary: String(data?.ad_impressions ?? 0),
      secondary: 'impressions',
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
            <Text style={[styles.summarySecondary, { color: palette.subtext }]}>{card.secondary}</Text>
            <Text style={[styles.summaryLabel, { color: palette.primaryStrong }]}>{card.label}</Text>
          </View>
        ))}
      </View>

      {/* Total revenue */}
      <View style={[styles.totalRow, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.totalLabel, { color: palette.subtext }]}>Total Est. Revenue</Text>
        <Text style={[styles.totalValue, { color: palette.primaryStrong }]}>
          ${total.toFixed(2)}
        </Text>
      </View>

      {/* Bar chart */}
      {total > 0 && (
        <View style={[styles.chartSection, { borderColor: palette.border }]}>
          <Text style={[styles.chartTitle, { color: palette.text }]}>Revenue Breakdown</Text>
          {barSegments.map(seg => {
            const pct = total > 0 ? (seg.value / total) * 100 : 0;
            return (
              <View key={seg.label} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: palette.text }]} numberOfLines={1}>
                  {seg.label}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: palette.border }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%` as any, backgroundColor: seg.color },
                    ]}
                  />
                </View>
                <Text style={[styles.barPct, { color: palette.subtext }]}>
                  {pct.toFixed(0)}%
                </Text>
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
  summarySecondary: { fontSize: 11, fontWeight: '600' },
  summaryLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },
  totalRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 14, fontWeight: '700' },
  totalValue: { fontSize: 28, fontWeight: '900' },
  chartSection: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
  chartTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 100, fontSize: 12, fontWeight: '700' },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  barPct: { width: 36, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
