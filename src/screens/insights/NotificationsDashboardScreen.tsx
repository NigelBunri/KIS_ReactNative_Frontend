import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { useKISTheme } from '@/theme/useTheme';

type NotifItem = {
  id: string;
  title?: string;
  status?: string;
  channel?: string;
  delivered_count?: number;
  opened_count?: number;
  clicked_count?: number;
  created_at?: string;
};

type NotifStats = {
  total: number;
  openRate: string;
  clickRate: string;
  pushCount: number;
  inAppCount: number;
  emailCount: number;
};

const computeRate = (a: number, b: number): string => {
  if (!b) return '—';
  return `${((a / b) * 100).toFixed(1)}%`;
};

export default function NotificationsDashboardScreen() {
  const { palette } = useKISTheme();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [stats, setStats] = useState<NotifStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try the attention-summary first for aggregate stats, then fall back to list
      const [summaryRes, listRes] = await Promise.allSettled([
        getRequest(ROUTES.notifications.attentionSummary, {
          errorMessage: 'No summary.',
        }),
        getRequest(ROUTES.notifications.notifications, {
          errorMessage: 'Unable to load notifications.',
        }),
      ]);

      const listItems: NotifItem[] =
        listRes.status === 'fulfilled'
          ? listRes.value.data?.results ?? listRes.value.data ?? []
          : [];
      setItems(listItems.slice(0, 20));

      const summaryData =
        summaryRes.status === 'fulfilled' ? summaryRes.value.data ?? {} : {};

      const total = summaryData.total ?? listItems.length;
      const totalDelivered = listItems.reduce((s, n) => s + (n.delivered_count ?? 0), 0);
      const totalOpened = listItems.reduce((s, n) => s + (n.opened_count ?? 0), 0);
      const totalClicked = listItems.reduce((s, n) => s + (n.clicked_count ?? 0), 0);

      const pushCount = listItems.filter(
        (n) => n.channel === 'push' || n.channel === 'fcm' || n.channel === 'apns',
      ).length;
      const inAppCount = listItems.filter((n) => n.channel === 'in_app').length;
      const emailCount = listItems.filter((n) => n.channel === 'email').length;

      setStats({
        total,
        openRate: summaryData.open_rate
          ? `${summaryData.open_rate}%`
          : computeRate(totalOpened, totalDelivered),
        clickRate: summaryData.click_rate
          ? `${summaryData.click_rate}%`
          : computeRate(totalClicked, totalDelivered),
        pushCount: summaryData.push_count ?? pushCount,
        inAppCount: summaryData.in_app_count ?? inAppCount,
        emailCount: summaryData.email_count ?? emailCount,
      });
    } catch (e: any) {
      setError(e?.message || 'Unable to load notifications data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statCards: { label: string; value: string }[] = stats
    ? [
        { label: 'Sent', value: String(stats.total) },
        { label: 'Open Rate', value: stats.openRate },
        { label: 'Click Rate', value: stats.clickRate },
        { label: 'Push', value: String(stats.pushCount) },
        { label: 'In-App', value: String(stats.inAppCount) },
        { label: 'Email', value: String(stats.emailCount) },
      ]
    : [];

  const channelColor = (channel?: string): string => {
    if (!channel) return '#6B7280';
    if (channel === 'push' || channel === 'fcm' || channel === 'apns') return '#8B5CF6';
    if (channel === 'in_app') return '#10B981';
    if (channel === 'email') return '#F59E0B';
    return '#6B7280';
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Delivery rates, open benchmarks, and channel breakdown.
        </Text>
      </View>

      {loading && !stats ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: '#DC2626', textAlign: 'center' }}>{error}</Text>
          <Pressable
            onPress={load}
            style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {statCards.length > 0 && (
            <View style={styles.statsGrid}>
              {statCards.map((card) => (
                <View
                  key={card.label}
                  style={[
                    styles.statCard,
                    { backgroundColor: palette.surface, borderColor: palette.divider },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: palette.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {card.value}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.subtext }]}>
                    {card.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Recent Notifications
          </Text>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ color: palette.subtext }}>No notifications found.</Text>
            </View>
          ) : (
            items.map((item) => (
              <View
                key={String(item.id)}
                style={[
                  styles.card,
                  { backgroundColor: palette.card, borderColor: palette.divider },
                ]}
              >
                <View style={styles.cardRow}>
                  <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]} numberOfLines={1}>
                    {item.title || `Notification ${item.id}`}
                  </Text>
                  {item.channel ? (
                    <Text
                      style={[
                        styles.channelBadge,
                        { color: channelColor(item.channel) },
                      ]}
                    >
                      {item.channel}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.metaRow}>
                  {item.status ? (
                    <Text style={[styles.metaText, { color: palette.subtext }]}>
                      {item.status}
                    </Text>
                  ) : null}
                  {item.delivered_count !== undefined ? (
                    <Text style={[styles.metaText, { color: palette.subtext }]}>
                      {item.delivered_count} delivered
                    </Text>
                  ) : null}
                  {item.opened_count !== undefined ? (
                    <Text style={[styles.metaText, { color: palette.subtext }]}>
                      {item.opened_count} opened
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13 },
  scrollContent: { padding: 16, gap: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  channelBadge: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  empty: { paddingVertical: 24, alignItems: 'center' },
});
