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
import { SafeAreaView } from 'react-native-safe-area-context';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

type TimeRange = 'week' | 'month' | 'all';

type ContentTrendItem = {
  id: string;
  title?: string;
  content_type?: string;
  views?: number;
  likes?: number;
  comments?: number;
  created_at?: string;
};

type ContentStats = {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
};

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: 'This week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'All time', value: 'all' },
];

export default function ContentDashboardScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [items, setItems] = useState<ContentTrendItem[]>([]);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        `${ROUTES.analytics.contentTrends}?time_range=${timeRange}`,
        { errorMessage: 'Unable to load content trends.' },
      );
      const data = res.data ?? {};
      const trending: ContentTrendItem[] =
        data.results ?? data.trending ?? data.posts ?? data ?? [];
      const list = Array.isArray(trending) ? trending.slice(0, 20) : [];
      setItems(list);

      const totalViews = list.reduce((s, i) => s + (i.views ?? 0), 0);
      const totalLikes = list.reduce((s, i) => s + (i.likes ?? 0), 0);
      const totalComments = list.reduce((s, i) => s + (i.comments ?? 0), 0);

      setStats({
        totalPosts: data.total_posts ?? data.totalPosts ?? list.length,
        totalViews: data.total_views ?? totalViews,
        totalLikes: data.total_likes ?? totalLikes,
        totalComments: data.total_comments ?? totalComments,
      });
    } catch (e: any) {
      setError(e?.message || 'Unable to load content trends.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    load();
  }, [load]);

  const statCards: { label: string; value: string }[] = stats
    ? [
        { label: 'Total Posts', value: String(stats.totalPosts) },
        { label: 'Total Views', value: stats.totalViews.toLocaleString() },
        { label: 'Total Likes', value: stats.totalLikes.toLocaleString() },
        { label: 'Comments', value: stats.totalComments.toLocaleString() },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.title, { color: palette.text }]}>Content</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Posts, engagement, and trending content metrics.
        </Text>
      </View>

      <View style={[styles.rangeRow, { borderBottomColor: palette.divider }]}>
        {TIME_RANGES.map((r) => {
          const active = timeRange === r.value;
          return (
            <Pressable
              key={r.value}
              onPress={() => setTimeRange(r.value)}
              style={[
                styles.rangeBtn,
                active && { backgroundColor: palette.primaryStrong ?? palette.primary },
              ]}
            >
              <Text style={[styles.rangeBtnText, { color: active ? palette.onPrimary : palette.subtext }]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !stats ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primaryStrong} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: palette.danger, textAlign: 'center' }}>{error}</Text>
          <Pressable
            onPress={load}
            style={[styles.retryBtn, { backgroundColor: palette.primaryStrong }]}
          >
            <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.primary} />
          }
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: responsive.pageGutter }]}
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
            Trending Content
          </Text>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ color: palette.subtext }}>No content data available.</Text>
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
                  <Text
                    style={[styles.cardTitle, { color: palette.text, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {item.title || 'Untitled'}
                  </Text>
                  {item.content_type ? (
                    <Text
                      style={[
                        styles.badge,
                        { backgroundColor: palette.primarySoft, color: palette.primary },
                      ]}
                    >
                      {item.content_type}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.metricRow}>
                  <Text style={[styles.metric, { color: palette.subtext }]}>
                    {(item.views ?? 0).toLocaleString()} views
                  </Text>
                  <Text style={[styles.metric, { color: palette.subtext }]}>
                    {(item.likes ?? 0).toLocaleString()} likes
                  </Text>
                  <Text style={[styles.metric, { color: palette.subtext }]}>
                    {(item.comments ?? 0).toLocaleString()} comments
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13 },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  rangeBtnText: { fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: 16, gap: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  metricRow: { flexDirection: 'row', gap: 12 },
  metric: { fontSize: 12 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  empty: { paddingVertical: 24, alignItems: 'center' },
});
