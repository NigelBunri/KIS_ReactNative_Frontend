import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { RevenueStats, EngagementStats } from '@/screens/tabs/partners/useAdminAnalyticsPanel';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  revenue: RevenueStats | null;
  engagement: EngagementStats | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
};

export default function AdminAnalyticsPanel({
  isOpen, panelWidth, panelTranslateX,
  revenue, engagement, loading, error,
  onClose, onRefresh,
}: Props) {
  const { palette } = useKISTheme();
  if (!isOpen) return null;

  return (
    <Animated.View
      style={[styles.panel, {
        width: panelWidth,
        backgroundColor: palette.surface ?? palette.bg,
        borderLeftColor: palette.border,
        transform: [{ translateX: panelTranslateX }],
      }]}
    >
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Analytics & Insights</Text>
          <Text style={[styles.headerSub, { color: palette.subtext }]}>Platform-wide revenue and engagement</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onRefresh} style={[styles.refreshBtn, { borderColor: palette.border }]}>
            <Text style={{ color: palette.primaryStrong ?? palette.primary, fontWeight: '700', fontSize: 12 }}>Refresh</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={{ color: palette.subtext, fontSize: 20, lineHeight: 22 }}>✕</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading analytics…</Text>
          </View>
        )}
        {!!error && !loading && (
          <View style={[styles.errorBox, { backgroundColor: (palette.danger ?? '#d9534f') + '22', borderColor: palette.danger ?? '#d9534f' }]}>
            <Text style={[styles.errorText, { color: palette.danger ?? '#d9534f' }]}>{error}</Text>
          </View>
        )}
        {!loading && (
          <>
            {/* Revenue */}
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Revenue</Text>
            <View style={styles.tileRow}>
              <StatTile label="Revenue 30d" value={`$${fmt(revenue?.revenue_30d_usd)}`} palette={palette} />
              <StatTile label="Revenue 7d" value={`$${fmt(revenue?.revenue_7d_usd)}`} palette={palette} />
              <StatTile label="Today" value={`$${fmt(revenue?.revenue_today_usd)}`} palette={palette} />
              <StatTile label="Transactions" value={fmt(revenue?.total_transactions)} palette={palette} />
            </View>
            {revenue?.series_30d && revenue.series_30d.length > 0 && (
              <BarChart
                title="Revenue 30d (USD)"
                series={revenue.series_30d.map(d => ({ label: d.date.slice(5), value: d.amount_usd }))}
                palette={palette}
                color={palette.primary}
              />
            )}

            {/* Engagement */}
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Engagement</Text>
            <View style={styles.tileRow}>
              <StatTile label="Active Users 30d" value={fmt(engagement?.active_users_30d)} palette={palette} />
              <StatTile label="Active Users 7d" value={fmt(engagement?.active_users_7d)} palette={palette} />
              <StatTile label="Posts 30d" value={fmt(engagement?.posts_30d)} palette={palette} />
              <StatTile label="New Users 30d" value={fmt(engagement?.new_users_30d)} palette={palette} />
            </View>
            {engagement?.growth_series_30d && engagement.growth_series_30d.length > 0 && (
              <BarChart
                title="New Users 30d"
                series={engagement.growth_series_30d.map(d => ({ label: d.date.slice(5), value: d.new_users }))}
                palette={palette}
                color={palette.primary}
              />
            )}
            {engagement?.content_series_30d && engagement.content_series_30d.length > 0 && (
              <BarChart
                title="Posts 30d"
                series={engagement.content_series_30d.map(d => ({ label: d.date.slice(5), value: d.posts }))}
                palette={palette}
                color="#5b8dee"
              />
            )}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function StatTile({ label, value, palette }: { label: string; value: string; palette: any }) {
  return (
    <View style={[styles.tile, { backgroundColor: palette.card ?? palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.tileValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function BarChart({ title, series, palette, color }: { title: string; series: { label: string; value: number }[]; palette: any; color: string }) {
  const max = Math.max(...series.map(s => s.value), 1);
  return (
    <View style={[styles.chartCard, { backgroundColor: palette.card ?? palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.chartTitle, { color: palette.text }]}>{title}</Text>
      <View style={styles.chartBars}>
        {series.slice(-14).map((s, i) => (
          <View key={i} style={styles.barWrap}>
            <View style={[styles.bar, { height: Math.max(4, (s.value / max) * 60), backgroundColor: color }]} />
            {i % 7 === 0 && <Text style={[styles.barLabel, { color: palette.subtext }]}>{s.label}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, right: 0, bottom: 0, borderLeftWidth: 1, zIndex: 122, shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorBox: { borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginTop: 20, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  tile: { flex: 1, minWidth: 120, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  tileValue: { fontSize: 20, fontWeight: '900' },
  tileLabel: { fontSize: 10, marginTop: 4 },
  chartCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginVertical: 10 },
  chartTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 70 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 3 },
  barLabel: { fontSize: 8, marginTop: 2 },
});
