// src/screens/prayer/PrayerCalendarHomeScreen.tsx
// "Global Prayer Watches" — the 24-watch home screen (spec section 5).
// The backend is authoritative for every time/status value rendered
// here; this screen only converts UTC timestamps to the device's local
// time for display (new Date(iso) already does this correctly given a
// proper ISO8601+timezone string) — it never decides locally whether a
// watch is active.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';

type Leader = { id: string; display_name: string; kind: 'member' | 'admin' } | null;

type WatchSummary = {
  hour: number;
  name: string;
  group_id: string;
  conversation_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_status: 'scheduled' | 'active' | 'completed' | 'interrupted';
  is_current_watch: boolean;
  leader: Leader;
  sharing_admin: Leader;
  participant_count: number;
};

type MyActivity = {
  joined_watch_hours: number[];
  upcoming_leadership: { hour: number; name: string; scheduled_start: string; session_id: string }[];
  led_this_month: number;
  remaining_this_month: number;
  monthly_limit: number;
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Upcoming', active: 'Active', completed: 'Completed', interrupted: 'Paused',
};

export function formatLocalTime(iso: string): string {
  // new Date('garbage') never throws — it silently produces an "Invalid
  // Date" whose toLocaleTimeString() returns the literal string
  // "Invalid Date" rather than throwing either, so a try/catch here
  // would never actually catch anything. Check getTime() explicitly.
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function PrayerCalendarHomeScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<any>();

  const [watches, setWatches] = useState<WatchSummary[] | null>(null);
  const [activity, setActivity] = useState<MyActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [watchesRes, activityRes] = await Promise.all([
        getRequest(ROUTES.prayer.watches, { forceNetwork: isRefresh, errorMessage: 'Unable to load prayer watches.' }),
        getRequest(ROUTES.prayer.myActivity, { forceNetwork: isRefresh, errorMessage: 'Unable to load your prayer activity.' }),
      ]);
      if (watchesRes?.success) setWatches(watchesRes.data ?? []);
      if (activityRes?.success) setActivity(activityRes.data ?? null);
      if (!watchesRes?.success) setError('Unable to load prayer watches right now.');
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load prayer watches right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const currentWatch = watches?.find((w) => w.is_current_watch) ?? null;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg }]}>
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.backBtn}>
          <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[s.headerTitle, { color: palette.text }]}>Global Prayer Watches</Text>
          <Text style={[s.headerSubtitle, { color: palette.subtext }]}>24 hours. Every day. Prayer never stops.</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      {loading && !refreshing ? (
        <View style={s.center}><ActivityIndicator color={palette.primaryStrong} size="large" /></View>
      ) : error && !watches ? (
        <View style={s.center}>
          <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
          <Pressable onPress={() => void load()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
            <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.primaryStrong} />}
        >
          {/* Current watch */}
          {currentWatch && (
            <Pressable
              onPress={() => navigation.navigate('PrayerWatchRoom', { hour: currentWatch.hour })}
              style={[s.currentCard, { backgroundColor: palette.primaryStrong }]}
            >
              <Text style={[s.currentLabel, { color: palette.ivory }]}>NOW PRAYING</Text>
              <Text style={[s.currentName, { color: palette.onPrimary }]}>{currentWatch.name}</Text>
              <View style={s.currentRow}>
                <Text style={[s.currentMeta, { color: palette.ivory }]}>
                  {STATUS_LABEL[currentWatch.session_status]} · {currentWatch.participant_count} joined
                </Text>
                {currentWatch.leader && (
                  <Text style={[s.currentMeta, { color: palette.ivory }]}>
                    Led by {currentWatch.leader.display_name}
                  </Text>
                )}
              </View>
              <View style={[s.enterBtn, { backgroundColor: palette.onPrimary }]}>
                <Text style={[s.enterBtnText, { color: palette.primaryStrong }]}>Enter prayer room</Text>
              </View>
            </Pressable>
          )}

          {/* My activity */}
          {activity && (
            <View style={[s.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
              <Text style={[s.cardTitle, { color: palette.text }]}>My prayer activity</Text>
              <View style={s.statsRow}>
                <View style={s.statCol}>
                  <Text style={[s.statValue, { color: palette.text }]}>{activity.joined_watch_hours.length}</Text>
                  <Text style={[s.statLabel, { color: palette.subtext }]}>Watches joined</Text>
                </View>
                <View style={s.statCol}>
                  <Text style={[s.statValue, { color: palette.text }]}>{activity.led_this_month}</Text>
                  <Text style={[s.statLabel, { color: palette.subtext }]}>Led this month</Text>
                </View>
                <View style={s.statCol}>
                  <Text style={[s.statValue, { color: palette.success }]}>{activity.remaining_this_month}</Text>
                  <Text style={[s.statLabel, { color: palette.subtext }]}>Opportunities left</Text>
                </View>
              </View>
              {activity.upcoming_leadership.length > 0 && (
                <View style={{ marginTop: 10, gap: 4 }}>
                  <Text style={[s.statLabel, { color: palette.subtext }]}>Upcoming leadership</Text>
                  {activity.upcoming_leadership.map((u) => (
                    <Text key={u.session_id} style={[s.upcomingRow, { color: palette.text }]}>
                      {u.name} — {formatLocalTime(u.scheduled_start)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* All 24 watches */}
          <Text style={[s.sectionTitle, { color: palette.text }]}>All 24 watches</Text>
          {(watches ?? []).map((w) => (
            <Pressable
              key={w.hour}
              onPress={() => navigation.navigate('PrayerWatchRoom', { hour: w.hour })}
              style={[
                s.watchRow,
                { backgroundColor: palette.surface, borderColor: w.is_current_watch ? palette.primaryStrong : palette.divider },
                w.is_current_watch && { borderWidth: 2 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.watchName, { color: palette.text }]} numberOfLines={1}>{w.name}</Text>
                <Text style={[s.watchTime, { color: palette.subtext }]}>
                  {formatLocalTime(w.scheduled_start)} – {formatLocalTime(w.scheduled_end)}
                  {w.session_status === 'scheduled' ? ` · in ${formatRemaining(w.scheduled_start)}` : ''}
                </Text>
                {w.leader && (
                  <Text style={[s.watchLeader, { color: palette.subtext }]} numberOfLines={1}>
                    Leader: {w.leader.display_name}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[s.watchStatus, { color: w.is_current_watch ? palette.primaryStrong : palette.subtext }]}>
                  {STATUS_LABEL[w.session_status]}
                </Text>
                <KISIcon name="chevron-right" size={16} color={palette.subtext} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSubtitle: { fontSize: 11, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  currentCard: { borderRadius: 20, padding: 20, gap: 6 },
  currentLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  currentName: { fontSize: 20, fontWeight: '900' },
  currentRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  currentMeta: { fontSize: 12, fontWeight: '600' },
  enterBtn: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  enterBtnText: { fontSize: 14, fontWeight: '800' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statCol: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  upcomingRow: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  watchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  watchName: { fontSize: 14, fontWeight: '800' },
  watchTime: { fontSize: 12, marginTop: 2 },
  watchLeader: { fontSize: 11, marginTop: 2 },
  watchStatus: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
});
