// src/screens/prayer/PrayerWatchRoomScreen.tsx
// One prayer watch's room — stage/countdown, leadership, prayer points,
// and entry into the existing text/voice/video participation methods.
// Every stage/leadership value rendered here comes straight from the
// backend (apps.prayer.views.WatchDetailView) — this screen never
// advances a stage or decides a leadership outcome itself; a countdown
// just ticks locally between polls using the timestamps the backend
// already returned.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { useSocket } from '../../../SocketProvider';

type WatchDetail = {
  hour: number;
  name: string;
  group_id: string;
  conversation_id: string;
  scheduled_start: string;
  scheduled_end: string;
  session_id: string;
  session_status: 'scheduled' | 'active' | 'completed' | 'interrupted';
  participation_mode: 'text' | 'voice' | 'video';
  leader: { id: string; display_name: string; kind: 'member' | 'admin' } | null;
  sharing_admin: { id: string; display_name: string; kind: 'admin' } | null;
  participant_count: number;
  stage: { key: string; label: string; display_text: string; started_at: string; ends_at: string; seconds_remaining: number } | null;
  seconds_remaining_in_session: number | null;
  my_leadership_state: 'available' | 'leading' | 'already_taken' | 'monthly_limit_reached' | 'session_closed';
  my_monthly_leadership_count: number;
  monthly_leadership_limit: number;
  is_group_admin: boolean;
  is_go: boolean;
  pending_share_request: { admin_id: string; admin_display_name: string } | null;
};

type PrayerPoint = { id: string; user_id: string; display_name: string; text: string; is_mine: boolean };

const LEADERSHIP_BUTTON_COPY: Record<WatchDetail['my_leadership_state'], string> = {
  available: 'I AM LEADING',
  leading: 'You are leading',
  already_taken: 'Already taken',
  monthly_limit_reached: 'Monthly limit reached',
  session_closed: 'Session closed',
};

export function formatCountdown(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PrayerWatchRoomScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const hour: number = route.params?.hour ?? 0;
  const { startCall } = useSocket();

  const [detail, setDetail] = useState<WatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [tickSeconds, setTickSeconds] = useState<number | null>(null);

  const [points, setPoints] = useState<PrayerPoint[]>([]);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [pointText, setPointText] = useState('');
  const myPoint = points.find((p) => p.is_mine);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [detailRes, pointsRes] = await Promise.all([
        getRequest(ROUTES.prayer.watch(hour), { forceNetwork: isRefresh, errorMessage: 'Unable to load this watch.' }),
        getRequest(ROUTES.prayer.prayerPoints(hour), { forceNetwork: isRefresh, errorMessage: 'Unable to load prayer points.' }),
      ]);
      if (detailRes?.success) {
        setDetail(detailRes.data ?? null);
        setTickSeconds(detailRes.data?.stage?.seconds_remaining ?? null);
      } else {
        setError('Unable to load this watch right now.');
      }
      if (pointsRes?.success) {
        setPoints(pointsRes.data?.points ?? []);
        setSubmissionsOpen(!!pointsRes.data?.submissions_open);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load this watch right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hour]);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Re-poll every 20s for authoritative stage/leader state; tick the
  // displayed countdown locally every second in between so it doesn't
  // visibly freeze, without ever deciding a transition itself.
  useEffect(() => {
    const poll = setInterval(() => void load(true), 20000);
    const tick = setInterval(() => setTickSeconds((s) => (s != null && s > 0 ? s - 1 : s)), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  const runAction = useCallback(async (url: string, body: Record<string, any> = {}) => {
    setActionBusy(true);
    try {
      const res = await postRequest(url, body, { errorMessage: 'Unable to complete this action.' });
      if (!res?.success) throw new Error(res?.message || 'Unable to complete this action.');
      await load(true);
    } catch (err: any) {
      Alert.alert('Prayer watch', err?.message || 'Unable to complete this action.');
    } finally {
      setActionBusy(false);
    }
  }, [load]);

  const handleLeadershipPress = useCallback(() => {
    if (!detail) return;
    if (detail.my_leadership_state === 'leading') {
      Alert.alert('Release leadership', 'Step down from leading this watch?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Release', style: 'destructive', onPress: () => void runAction(ROUTES.prayer.releaseLeadership(hour)) },
      ]);
      return;
    }
    if (detail.my_leadership_state !== 'available') return;
    void runAction(ROUTES.prayer.claimLeadership(hour));
  }, [detail, hour, runAction]);

  const openTextDiscussion = useCallback(() => {
    if (!detail) return;
    DeviceEventEmitter.emit('chat.open', { conversationId: detail.conversation_id, name: detail.name, kind: 'group' });
  }, [detail]);

  const joinCall = useCallback((media: 'voice' | 'video') => {
    if (!detail || !startCall) return;
    void startCall({ conversationId: detail.conversation_id, title: detail.name, media });
  }, [detail, startCall]);

  const isLeaderOrSharing = detail && (detail.my_leadership_state === 'leading');
  const canStartOfficialCall = !!isLeaderOrSharing || !!detail?.is_group_admin;

  const submitPoint = useCallback(async () => {
    const text = pointText.trim();
    if (!text) return;
    setActionBusy(true);
    try {
      const res = await postRequest(ROUTES.prayer.prayerPoints(hour), { text }, { errorMessage: 'Unable to submit your prayer point.' });
      if (!res?.success) throw new Error(res?.message || 'Unable to submit your prayer point.');
      setPointText('');
      await load(true);
    } catch (err: any) {
      Alert.alert('Prayer point', err?.message || 'Unable to submit your prayer point.');
    } finally {
      setActionBusy(false);
    }
  }, [pointText, hour, load]);

  const deletePoint = useCallback(async () => {
    setActionBusy(true);
    try {
      const res = await deleteRequest(ROUTES.prayer.prayerPoints(hour), { errorMessage: 'Unable to delete your prayer point.' });
      if (!res?.success) throw new Error(res?.message || 'Unable to delete your prayer point.');
      await load(true);
    } catch (err: any) {
      Alert.alert('Prayer point', err?.message || 'Unable to delete your prayer point.');
    } finally {
      setActionBusy(false);
    }
  }, [hour, load]);

  const leadershipDisabled = !detail || actionBusy || (detail.my_leadership_state !== 'available' && detail.my_leadership_state !== 'leading');

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg }]}>
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.backBtn}>
          <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: palette.text }]} numberOfLines={1}>{detail?.name ?? 'Prayer watch'}</Text>
        <View style={s.backBtn} />
      </View>

      {loading && !refreshing ? (
        <View style={s.center}><ActivityIndicator color={palette.primaryStrong} size="large" /></View>
      ) : error && !detail ? (
        <View style={s.center}>
          <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
          <Pressable onPress={() => void load()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
            <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
          </Pressable>
        </View>
      ) : detail ? (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.primaryStrong} />}
        >
          {/* Stage */}
          <View style={[s.stageCard, { backgroundColor: palette.primaryStrong }]}>
            {detail.stage ? (
              <>
                <Text style={[s.stageLabel, { color: palette.ivory }]}>{detail.stage.label.toUpperCase()}</Text>
                <Text style={[s.stageCountdown, { color: palette.onPrimary }]}>{formatCountdown(tickSeconds)}</Text>
                <Text style={[s.stageText, { color: palette.ivory }]}>{detail.stage.display_text}</Text>
              </>
            ) : (
              <Text style={[s.stageLabel, { color: palette.ivory }]}>
                {detail.session_status === 'completed' ? 'This watch has completed for today' : 'This watch has not started yet'}
              </Text>
            )}
          </View>

          {/* Leader */}
          <View style={[s.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={[s.cardTitle, { color: palette.text }]}>Leadership</Text>
            {detail.leader ? (
              <Text style={[s.leaderText, { color: palette.text }]}>
                Led by {detail.leader.display_name} {detail.leader.kind === 'admin' ? '(Admin)' : ''}
                {detail.sharing_admin ? ` · sharing with ${detail.sharing_admin.display_name}` : ''}
              </Text>
            ) : (
              <Text style={[s.leaderText, { color: palette.subtext }]}>No leader has been appointed yet.</Text>
            )}

            <KISButton
              title={actionBusy ? 'Please wait…' : LEADERSHIP_BUTTON_COPY[detail.my_leadership_state]}
              onPress={handleLeadershipPress}
              disabled={leadershipDisabled || actionBusy}
              style={{ marginTop: 10 }}
            />
            <Text style={[s.hintText, { color: palette.subtext }]}>
              You've led {detail.my_monthly_leadership_count} of {detail.monthly_leadership_limit} sessions this month.
            </Text>

            {detail.is_group_admin && !detail.leader && detail.my_leadership_state === 'available' && (
              <KISButton
                title="Lead this watch (Admin)" variant="outline"
                onPress={() => void runAction(ROUTES.prayer.adminClaimLeadership(hour))}
                disabled={actionBusy} style={{ marginTop: 8 }}
              />
            )}
            {detail.is_group_admin && detail.leader?.kind === 'member' && !detail.sharing_admin && !detail.pending_share_request && (
              <KISButton
                title="Share this prayer watch" variant="outline"
                onPress={() => void runAction(ROUTES.prayer.shareRequest(hour))}
                disabled={actionBusy} style={{ marginTop: 8 }}
              />
            )}
            {detail.pending_share_request && detail.my_leadership_state === 'leading' && (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text style={[s.hintText, { color: palette.text }]}>
                  {detail.pending_share_request.admin_display_name} asked to share this watch with you.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <KISButton title="Accept" onPress={() => void runAction(ROUTES.prayer.shareRespond(hour), { accept: true })} disabled={actionBusy} style={{ flex: 1 }} />
                  <KISButton title="Decline" variant="outline" onPress={() => void runAction(ROUTES.prayer.shareRespond(hour), { accept: false })} disabled={actionBusy} style={{ flex: 1 }} />
                </View>
              </View>
            )}
          </View>

          {/* Participation */}
          <View style={[s.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={[s.cardTitle, { color: palette.text }]}>Join the prayer</Text>
            <View style={s.participationRow}>
              <Pressable onPress={openTextDiscussion} style={[s.participationBtn, { backgroundColor: `${palette.primary}1A`, borderColor: `${palette.primary}60` }]}>
                <KISIcon name="chat" size={18} color={palette.primary} />
                <Text style={[s.participationBtnText, { color: palette.primary }]}>Text</Text>
              </Pressable>
              <Pressable onPress={() => joinCall('voice')} style={[s.participationBtn, { backgroundColor: `${palette.gold}1A`, borderColor: `${palette.gold}60` }]}>
                <KISIcon name="phone" size={18} color={palette.gold} />
                <Text style={[s.participationBtnText, { color: palette.gold }]}>
                  {canStartOfficialCall ? 'Start/Join Voice' : 'Join Voice'}
                </Text>
              </Pressable>
              <Pressable onPress={() => joinCall('video')} style={[s.participationBtn, { backgroundColor: `${palette.success}1A`, borderColor: `${palette.success}60` }]}>
                <KISIcon name="video" size={18} color={palette.success} />
                <Text style={[s.participationBtnText, { color: palette.success }]}>
                  {canStartOfficialCall ? 'Start/Join Video' : 'Join Video'}
                </Text>
              </Pressable>
            </View>
            <Text style={[s.hintText, { color: palette.subtext }]}>{detail.participant_count} joined this watch's group.</Text>
          </View>

          {/* Prayer points */}
          <View style={[s.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            <Text style={[s.cardTitle, { color: palette.text }]}>Prayer points</Text>
            {submissionsOpen ? (
              myPoint ? (
                <View style={{ gap: 8 }}>
                  <Text style={[s.myPointText, { color: palette.text }]}>{myPoint.text}</Text>
                  <Pressable onPress={deletePoint} disabled={actionBusy}>
                    <Text style={[s.linkText, { color: palette.danger }]}>Remove my prayer point</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={pointText}
                    onChangeText={setPointText}
                    placeholder="Share a specific prayer need…"
                    placeholderTextColor={palette.subtext}
                    multiline
                    maxLength={500}
                    style={[s.input, { color: palette.text, borderColor: palette.inputBorder ?? palette.divider }]}
                  />
                  <KISButton title="Submit prayer point" onPress={submitPoint} disabled={actionBusy || !pointText.trim()} />
                </View>
              )
            ) : (
              <Text style={[s.hintText, { color: palette.subtext }]}>
                Prayer point submissions are closed once this watch begins.
              </Text>
            )}
            {points.length > 0 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {points.map((p) => (
                  <View key={p.id} style={[s.pointRow, { borderBottomColor: palette.divider }]}>
                    <Text style={[s.pointAuthor, { color: palette.subtext }]}>{p.display_name}</Text>
                    <Text style={[s.pointText, { color: palette.text }]}>{p.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={[s.rulesCard, { backgroundColor: palette.surfaceElevated ?? palette.surface, borderColor: palette.divider }]}>
            <Text style={[s.rulesText, { color: palette.subtext }]}>
              This is a shared global prayer room, not a personal ministry platform. Please respect the
              prayer structure, the appointed leader, and fellow participants.
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  stageCard: { borderRadius: 20, padding: 20, alignItems: 'center', gap: 4 },
  stageLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  stageCountdown: { fontSize: 36, fontWeight: '900' },
  stageText: { fontSize: 12.5, textAlign: 'center', lineHeight: 18, marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  leaderText: { fontSize: 13.5, lineHeight: 19 },
  hintText: { fontSize: 11.5, marginTop: 6 },
  participationRow: { flexDirection: 'row', gap: 8 },
  participationBtn: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 4 },
  participationBtnText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 70, fontSize: 14, textAlignVertical: 'top' },
  linkText: { fontSize: 12.5, fontWeight: '700' },
  myPointText: { fontSize: 14, lineHeight: 20 },
  pointRow: { borderBottomWidth: 1, paddingBottom: 8, gap: 2 },
  pointAuthor: { fontSize: 11, fontWeight: '700' },
  pointText: { fontSize: 13.5, lineHeight: 19 },
  rulesCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  rulesText: { fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
});
