import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

type TimeRange = 'week' | 'month' | 'all';

type EventItem = {
  id: string;
  title?: string;
  starts_at?: string;
  attendance_count?: number;
  rsvp_count?: number;
};

type StatCards = {
  totalEvents: number;
  upcomingEvents: number;
  totalAttendees: number;
  mostAttended: string;
};

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: 'This week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'All time', value: 'all' },
];

export default function EventsDashboardScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [stats, setStats] = useState<StatCards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequest(
        `${ROUTES.events.list}?time_range=${timeRange}&ordering=-attendance_count`,
        { errorMessage: 'Unable to load events data.' },
      );
      const items: EventItem[] = res.data?.results ?? res.data ?? [];
      setEvents(items.slice(0, 20));

      const total = res.data?.count ?? items.length;
      const upcoming = items.filter((e) => {
        if (!e.starts_at) return false;
        return new Date(e.starts_at) > new Date();
      }).length;
      const totalAttendees = items.reduce((sum, e) => sum + (e.attendance_count ?? 0), 0);
      const mostAttended = items.sort((a, b) => (b.attendance_count ?? 0) - (a.attendance_count ?? 0))[0]?.title ?? '—';

      setStats({
        totalEvents: total,
        upcomingEvents: upcoming,
        totalAttendees,
        mostAttended,
      });
    } catch (e: any) {
      setError(e?.message || 'Unable to load events data.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    load();
  }, [load]);

  const statCards: { label: string; value: string }[] = stats
    ? [
        { label: 'Total Events', value: String(stats.totalEvents) },
        { label: 'Upcoming', value: String(stats.upcomingEvents) },
        { label: 'Total Attendees', value: String(stats.totalAttendees) },
        { label: 'Most Attended', value: stats.mostAttended },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg, }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.title, { color: palette.text }]}>Events</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Attendance, ticketing, and engagement across all events.
        </Text>
      </View>

      {/* Time range selector */}
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
              <Text
                style={[
                  styles.rangeBtnText,
                  { color: active ? palette.onPrimary : palette.subtext },
                ]}
              >
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
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={palette.primary}
            />
          }
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: responsive.pageGutter }]}
        >
          {/* Stat cards 2-column grid */}
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

          {/* Recent events list */}
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Recent Events
          </Text>

          {events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ color: palette.subtext }}>No events found.</Text>
            </View>
          ) : (
            events.map((item) => (
              <View
                key={String(item.id)}
                style={[
                  styles.card,
                  { backgroundColor: palette.card, borderColor: palette.divider },
                ]}
              >
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                  {item.title || 'Untitled event'}
                </Text>
                <View style={styles.cardMeta}>
                  {item.starts_at ? (
                    <Text style={[styles.cardMetaText, { color: palette.subtext }]}>
                      {new Date(item.starts_at).toLocaleDateString()}
                    </Text>
                  ) : null}
                  <Text style={[styles.cardMetaText, { color: palette.subtext }]}>
                    {item.attendance_count ?? item.rsvp_count ?? 0} attendees
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
  rangeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  rangeBtnText: { fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: 16, gap: 12 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
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
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', gap: 12 },
  cardMetaText: { fontSize: 12 },
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
