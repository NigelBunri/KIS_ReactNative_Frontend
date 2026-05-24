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
import type { LiveMetrics, MonitoringAlert, PerformanceInsight } from '@/screens/tabs/partners/useAdminSystemHealthPanel';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  metrics: LiveMetrics | null;
  alerts: MonitoringAlert[];
  performance: PerformanceInsight[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
};

export default function AdminSystemHealthPanel({
  isOpen, panelWidth, panelTranslateX,
  metrics, alerts, performance, loading, error,
  onClose, onRefresh,
}: Props) {
  const { palette } = useKISTheme();
  if (!isOpen) return null;

  const unresolvedAlerts = alerts.filter(a => !a.is_resolved);

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
          <Text style={[styles.headerTitle, { color: palette.text }]}>System Health</Text>
          <Text style={[styles.headerSub, { color: palette.subtext }]}>Live platform metrics and monitoring alerts</Text>
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
            <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading system health…</Text>
          </View>
        )}
        {!!error && !loading && (
          <View style={[styles.errorBox, { backgroundColor: (palette.danger ?? '#d9534f') + '22', borderColor: palette.danger ?? '#d9534f' }]}>
            <Text style={[styles.errorText, { color: palette.danger ?? '#d9534f' }]}>{error}</Text>
          </View>
        )}

        {!loading && metrics && (
          <>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Live Metrics</Text>
            <View style={styles.tileRow}>
              <MetricTile label="Connections" value={String(metrics.active_connections ?? '—')} palette={palette} />
              <MetricTile label="Req/min" value={String(metrics.requests_per_minute ?? '—')} palette={palette} />
              <MetricTile label="Avg Response" value={`${metrics.avg_response_ms ?? '—'}ms`} palette={palette} warn={(metrics.avg_response_ms ?? 0) > 500} />
              <MetricTile label="Error Rate" value={`${metrics.error_rate_pct ?? '—'}%`} palette={palette} warn={(metrics.error_rate_pct ?? 0) > 1} />
            </View>
            <View style={styles.tileRow}>
              <MetricTile label="CPU" value={`${metrics.cpu_usage_pct ?? '—'}%`} palette={palette} warn={(metrics.cpu_usage_pct ?? 0) > 80} />
              <MetricTile label="Memory" value={`${metrics.memory_usage_pct ?? '—'}%`} palette={palette} warn={(metrics.memory_usage_pct ?? 0) > 85} />
              <MetricTile label="Queue Depth" value={String(metrics.queue_depth ?? '—')} palette={palette} warn={(metrics.queue_depth ?? 0) > 100} />
              <MetricTile label="Cache Hit" value={`${metrics.cache_hit_rate_pct ?? '—'}%`} palette={palette} />
            </View>
            {metrics.generated_at && (
              <Text style={[styles.ts, { color: palette.subtext }]}>
                Updated: {new Date(metrics.generated_at).toLocaleTimeString()}
              </Text>
            )}
          </>
        )}

        {!loading && unresolvedAlerts.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Active Alerts ({unresolvedAlerts.length})
            </Text>
            {unresolvedAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} palette={palette} />
            ))}
          </>
        )}

        {!loading && performance.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Slowest Endpoints</Text>
            {performance.slice(0, 10).map((p, i) => (
              <View key={i} style={[styles.perfRow, { borderBottomColor: palette.border }]}>
                <Text style={[styles.perfEndpoint, { color: palette.text }]} numberOfLines={1}>{p.endpoint}</Text>
                <View style={styles.perfStats}>
                  <Text style={[styles.perfStat, { color: (p.avg_ms ?? 0) > 500 ? '#e74c3c' : palette.subtext }]}>
                    avg {p.avg_ms}ms
                  </Text>
                  <Text style={[styles.perfStat, { color: palette.subtext }]}>p95 {p.p95_ms}ms</Text>
                  <Text style={[styles.perfStat, { color: palette.subtext }]}>{p.call_count} calls</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {!loading && !metrics && alerts.length === 0 && performance.length === 0 && (
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No health data available.</Text>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function MetricTile({ label, value, palette, warn }: { label: string; value: string; palette: any; warn?: boolean }) {
  return (
    <View style={[styles.tile, { backgroundColor: warn ? (palette.danger ?? '#e74c3c') + '18' : palette.card ?? palette.surface, borderColor: warn ? palette.danger ?? '#e74c3c' : palette.border }]}>
      <Text style={[styles.tileValue, { color: warn ? palette.danger ?? '#e74c3c' : palette.text }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: palette.subtext }]}>{label}</Text>
    </View>
  );
}

function AlertCard({ alert, palette }: { alert: MonitoringAlert; palette: any }) {
  const sevColors: Record<string, string> = { CRITICAL: '#c0392b', HIGH: '#e74c3c', MEDIUM: '#f39c12', LOW: '#888' };
  const color = sevColors[alert.severity] ?? '#888';
  return (
    <View style={[styles.alertCard, { backgroundColor: color + '12', borderColor: color + '44' }]}>
      <View style={styles.alertHeader}>
        <View style={[styles.sevPill, { backgroundColor: color + '22' }]}>
          <Text style={[styles.sevText, { color }]}>{alert.severity}</Text>
        </View>
        <Text style={[styles.alertTitle, { color: palette.text }]}>{alert.title}</Text>
      </View>
      <Text style={[styles.alertDesc, { color: palette.subtext }]}>{alert.description}</Text>
      <Text style={[styles.alertMeta, { color: palette.subtext }]}>
        {alert.service} · {new Date(alert.triggered_at).toLocaleString()}
      </Text>
    </View>
  );
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
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tile: { flex: 1, minWidth: 110, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  tileValue: { fontSize: 18, fontWeight: '900' },
  tileLabel: { fontSize: 10, marginTop: 4 },
  ts: { fontSize: 10, marginBottom: 8 },
  alertCard: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 10 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sevPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sevText: { fontSize: 10, fontWeight: '700' },
  alertTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  alertDesc: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  alertMeta: { fontSize: 10 },
  perfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  perfEndpoint: { fontSize: 12, flex: 1, marginRight: 8 },
  perfStats: { flexDirection: 'row', gap: 8 },
  perfStat: { fontSize: 11 },
  emptyText: { textAlign: 'center', padding: 40, fontSize: 14 },
});
