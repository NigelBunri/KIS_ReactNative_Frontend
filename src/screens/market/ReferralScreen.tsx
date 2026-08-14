import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation } from '@react-navigation/native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

// New screen for Phase 8 of the billing/rewards project — no prior mobile
// screen read apps.referrals' API before this. Shows the user's own
// referral code and the real per-referral status/points from
// MyReferralsView; current_referral_rate_percent is purely informational
// (the rate actually applied to a referral is the one snapshotted onto it
// at qualification time and never changes retroactively).

type ReferralEntry = {
  referred_display_name: string;
  status: string;
  points_awarded: number;
  pending_points: number;
  reward_rate_percent: string | number | null;
  qualifying_net_amount_cents: number | null;
  created_at: string;
  rewarded_at: string | null;
};

type ReferralSummary = {
  code: string;
  reward_points_per_referral: number;
  current_referral_rate_percent: string | number | null;
  current_referral_rate_tier: string | null;
  total_referred: number;
  total_qualified: number;
  total_rewarded: number;
  total_reversed: number;
  total_points_earned: number;
  total_points_pending: number;
  history: ReferralEntry[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  qualified: 'Qualified',
  rewarded: 'Rewarded',
  reversed: 'Reversed',
};

const STATUS_COLOR = (status: string, palette: any) => {
  if (status === 'rewarded') return palette.success;
  if (status === 'reversed') return palette.danger;
  if (status === 'qualified') return palette.primaryStrong;
  return palette.subtext;
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

export default function ReferralScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<any>();

  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await getRequest(ROUTES.referrals.me, {
        forceNetwork: isRefresh,
        errorMessage: 'Unable to load your referrals.',
      });
      if (res?.success) {
        setSummary(res.data ?? null);
      } else {
        setError('Unable to load your referrals.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load your referrals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const handleRefresh = useCallback(() => {
    void fetchSummary(true);
  }, [fetchSummary]);

  const handleShare = useCallback(() => {
    if (!summary?.code) return;
    Share.share({
      message: `Join me on KIS! Use my referral code ${summary.code} when you sign up.`,
    }).catch(() => {});
  }, [summary?.code]);

  const ratePercent = summary?.current_referral_rate_percent;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg }]}>
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.backBtn}
        >
          <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: palette.text }]}>Refer a friend</Text>
        <Pressable
          onPress={() => navigation.navigate('HowRewardsWork')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.headerLink}
        >
          <Text style={[s.headerLinkText, { color: palette.primaryStrong }]}>How it works</Text>
        </Pressable>
      </View>

      {loading && !refreshing ? (
        <View style={s.center}>
          <ActivityIndicator color={palette.primaryStrong} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
          <Pressable onPress={() => void fetchSummary()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
            <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primaryStrong} />}
        >
          {/* Code card */}
          <View style={[s.codeCard, { backgroundColor: palette.primaryStrong }]}>
            <Text style={[s.codeLabel, { color: palette.ivory }]}>Your referral code</Text>
            <Text style={[s.codeValue, { color: palette.onPrimary }]}>{summary?.code ?? '—'}</Text>
            {ratePercent !== null && ratePercent !== undefined && (
              <Text style={[s.codeSub, { color: palette.ivory }]}>
                Referrals qualified at your current tier earn {String(ratePercent)}% of net subscription revenue
                {summary?.current_referral_rate_tier ? ` (${summary.current_referral_rate_tier})` : ''}.
              </Text>
            )}
            <Pressable
              onPress={handleShare}
              style={[s.shareBtn, { backgroundColor: palette.onPrimary }]}
            >
              <Text style={[s.shareBtnText, { color: palette.primaryStrong }]}>Share your code</Text>
            </Pressable>
          </View>

          {/* Summary stats */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.statValue, { color: palette.text }]}>{summary?.total_referred ?? 0}</Text>
              <Text style={[s.statLabel, { color: palette.subtext }]}>Referred</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.statValue, { color: palette.text }]}>{summary?.total_qualified ?? 0}</Text>
              <Text style={[s.statLabel, { color: palette.subtext }]}>Qualified</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <Text style={[s.statValue, { color: palette.text }]}>{summary?.total_rewarded ?? 0}</Text>
              <Text style={[s.statLabel, { color: palette.subtext }]}>Rewarded</Text>
            </View>
          </View>

          {((summary?.total_points_earned ?? 0) > 0 || (summary?.total_points_pending ?? 0) > 0) && (
            <View style={[s.pointsRow, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
              <View style={s.pointsCol}>
                <Text style={[s.statLabel, { color: palette.subtext }]}>Coins earned</Text>
                <Text style={[s.pointsValue, { color: palette.success }]}>
                  +{(summary?.total_points_earned ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={s.pointsCol}>
                <Text style={[s.statLabel, { color: palette.subtext }]}>Coins pending</Text>
                <Text style={[s.pointsValue, { color: palette.text }]}>
                  {(summary?.total_points_pending ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {/* History */}
          <View>
            <Text style={[s.sectionTitle, { color: palette.text }]}>Your referrals</Text>
            {(summary?.history?.length ?? 0) === 0 ? (
              <Text style={[s.emptyNote, { color: palette.subtext }]}>
                No referrals yet. Share your code to start earning KIS Coins.
              </Text>
            ) : (
              summary!.history.map((entry, idx) => (
                <View
                  key={`${entry.referred_display_name}-${entry.created_at}-${idx}`}
                  style={[s.referralItem, { borderBottomColor: palette.divider }]}
                >
                  <View style={s.referralLeft}>
                    <Text style={[s.referralName, { color: palette.text }]} numberOfLines={1}>
                      {entry.referred_display_name}
                    </Text>
                    <Text style={[s.referralDate, { color: palette.subtext }]}>
                      {formatDate(entry.created_at)}
                    </Text>
                  </View>
                  <View style={s.referralRight}>
                    <Text style={[s.referralStatus, { color: STATUS_COLOR(entry.status, palette) }]}>
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </Text>
                    {entry.status === 'rewarded' && entry.points_awarded > 0 && (
                      <Text style={[s.referralPts, { color: palette.success }]}>+{entry.points_awarded}</Text>
                    )}
                    {entry.status === 'qualified' && entry.pending_points > 0 && (
                      <Text style={[s.referralPts, { color: palette.subtext }]}>{entry.pending_points} pending</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Disclaimer */}
          <View style={[s.disclaimerCard, { backgroundColor: palette.surfaceElevated ?? palette.surface, borderColor: palette.divider }]}>
            <Text style={[s.disclaimerText, { color: palette.subtext }]}>
              KIS Coins are rewards earned through qualifying activities on KIS, including successful referrals.
              They can currently be used toward eligible KIS subscription upgrades. Referral rates are set by KIS
              and may change for future referrals; a rate already applied to a qualified referral does not change
              retroactively.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerLink: { width: 90, alignItems: 'flex-end' },
  headerLinkText: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  codeCard: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 },
  codeLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  codeValue: { fontSize: 36, fontWeight: '900', letterSpacing: 2 },
  codeSub: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 4 },
  shareBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 10 },
  shareBtnText: { fontSize: 14, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pointsRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 14 },
  pointsCol: { flex: 1, gap: 4 },
  pointsValue: { fontSize: 18, fontWeight: '900' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  emptyNote: { fontSize: 13, fontStyle: 'italic' },
  referralItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  referralLeft: { flex: 1, marginRight: 12 },
  referralName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  referralDate: { fontSize: 12 },
  referralRight: { alignItems: 'flex-end' },
  referralStatus: { fontSize: 13, fontWeight: '700' },
  referralPts: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  disclaimerCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  disclaimerText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
