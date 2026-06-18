/**
 * DashboardTab — live stats dashboard for a partner org app tab.
 * Fetches the partner's reports summary and displays key metrics.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';

type Stat = { label: string; value: string | number; icon: string; color?: string };

type SummaryData = {
  total_members?: number;
  active_members?: number;
  total_posts?: number;
  total_groups?: number;
  total_channels?: number;
  total_communities?: number;
  total_events?: number;
  engagement_rate?: number | string;
  [key: string]: unknown;
};

type Props = {
  partnerId: string;
  partnerName: string;
};

export default function DashboardTab({ partnerId, partnerName }: Props) {
  const { palette } = useKISTheme();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getRequest(ROUTES.partners.reportsSummary(partnerId));
      const data = res?.data ?? null;
      setSummary(data);
    } catch {
      setError('Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const stats: Stat[] = summary
    ? [
        { icon: '👥', label: 'Members', value: summary.total_members ?? '—' },
        { icon: '⚡', label: 'Active', value: summary.active_members ?? '—', color: palette.success },
        { icon: '📝', label: 'Posts', value: summary.total_posts ?? '—' },
        { icon: '👤', label: 'Groups', value: summary.total_groups ?? '—' },
        { icon: '#', label: 'Channels', value: summary.total_channels ?? '—' },
        { icon: '🏘', label: 'Communities', value: summary.total_communities ?? '—' },
        { icon: '📅', label: 'Events', value: summary.total_events ?? '—' },
        {
          icon: '📈',
          label: 'Engagement',
          value: summary.engagement_rate != null
            ? `${Number(summary.engagement_rate).toFixed(1)}%`
            : '—',
          color: palette.primary,
        },
      ]
    : [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primary} />
        <Text style={[styles.sub, { color: palette.subtext }]}>Loading dashboard…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 36 }}>⚠️</Text>
        <Text style={[styles.sub, { color: palette.danger }]}>{error}</Text>
        <KISButton title="Retry" size="sm" onPress={load} style={{ marginTop: 8 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />
      }
    >
      {/* Header */}
      <View style={[styles.headerCard, { backgroundColor: palette.primary + '12', borderColor: palette.primary + '30' }]}>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{partnerName}</Text>
        <Text style={[styles.headerSub, { color: palette.subtext }]}>Partner Dashboard · Pull to refresh</Text>
      </View>

      {/* Stat grid */}
      <View style={styles.grid}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={[styles.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}
          >
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={[styles.statValue, { color: stat.color ?? palette.text }]}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {!summary && (
        <View style={styles.center}>
          <Text style={[styles.sub, { color: palette.subtext }]}>No data available yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  headerCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500' },
  sub: { fontSize: 13, textAlign: 'center' },
});
