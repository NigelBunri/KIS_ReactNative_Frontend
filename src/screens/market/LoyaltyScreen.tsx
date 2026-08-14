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
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation } from '@react-navigation/native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';

// Canonical mobile home for KIS Coins (Phase 8 of the billing/rewards
// project). Reads apps.rewards' real ledger API exclusively — the legacy
// apps.commerce loyalty-balance/rules endpoints and the two other
// competing implementations that used them (WalletScreen.tsx, WalletModal's
// LoyaltyPanel) are retired/redirected here. There is deliberately no
// generic "spend N coins" form: the only real redemption mechanism the
// backend implements is applying coins toward a subscription upgrade
// (Phase 5's apply_rewards flag), so this screen points there instead of
// re-creating a free-form redeem action that doesn't correspond to
// anything the backend can actually do.

type Balance = {
  available: number;
  pending: number;
  this_period_earned: number;
  this_period_spent: number;
};

type Achievement = {
  code: string;
  title: string;
  coin_amount: number;
  completed: boolean;
  completed_at: string | null;
};

type HistoryEntry = {
  id: string;
  type: string;
  source: string;
  amount: number;
  status: string;
  description: string;
  effective_at: string;
  created_at: string;
  expires_at?: string | null;
};

const formatDate = (value?: string) => {
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  redeemed: 'Redeemed',
  reversed: 'Reversed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export default function LoyaltyScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<any>();

  const [balance, setBalance] = useState<Balance | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [balanceRes, achievementsRes, historyRes] = await Promise.all([
        getRequest(ROUTES.rewards.balance, {
          forceNetwork: isRefresh,
          errorMessage: 'Unable to load KIS Coins balance.',
        }),
        getRequest(ROUTES.rewards.achievements, {
          forceNetwork: isRefresh,
          errorMessage: 'Unable to load achievements.',
        }),
        getRequest(ROUTES.rewards.history, {
          forceNetwork: isRefresh,
          errorMessage: 'Unable to load KIS Coins history.',
        }),
      ]);

      if (balanceRes?.success) {
        setBalance(balanceRes.data ?? null);
      }
      if (achievementsRes?.success) {
        setAchievements(achievementsRes.data?.results ?? []);
      }
      if (historyRes?.success) {
        setHistory(historyRes.data?.results ?? []);
      }
      if (!balanceRes?.success && !achievementsRes?.success && !historyRes?.success) {
        setError('Unable to load KIS Coins data.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load KIS Coins data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleRefresh = useCallback(() => {
    void fetchAll(true);
  }, [fetchAll]);

  const available = balance?.available ?? 0;

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
        <Text style={[s.headerTitle, { color: palette.text }]}>KIS Coins</Text>
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
          <Pressable onPress={() => void fetchAll()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
            <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primaryStrong} />}
        >
          {/* Balance Card */}
          <View style={[s.balanceCard, { backgroundColor: palette.primaryStrong }]}>
            <Text style={[s.balanceLabel, { color: palette.ivory }]}>Available</Text>
            <Text style={[s.balanceValue, { color: palette.onPrimary }]}>{available.toLocaleString()}</Text>
            <Text style={[s.balanceSub, { color: palette.ivory }]}>KIS Coins</Text>
            <View style={s.balanceStatsRow}>
              {(balance?.pending ?? 0) > 0 && (
                <View style={[s.balanceStat, { backgroundColor: palette.primaryWeak }]}>
                  <Text style={[s.balanceStatLabel, { color: palette.onPrimary }]}>Pending</Text>
                  <Text style={[s.balanceStatValue, { color: palette.onPrimary }]}>{(balance?.pending ?? 0).toLocaleString()}</Text>
                </View>
              )}
              <View style={[s.balanceStat, { backgroundColor: palette.primaryWeak }]}>
                <Text style={[s.balanceStatLabel, { color: palette.onPrimary }]}>This month</Text>
                <Text style={[s.balanceStatValue, { color: palette.onPrimary }]}>
                  +{(balance?.this_period_earned ?? 0).toLocaleString()} / -{(balance?.this_period_spent ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Refer a friend CTA */}
          <Pressable
            style={[s.upgradeCta, { backgroundColor: palette.surfaceElevated ?? palette.surface, borderColor: palette.divider }]}
            onPress={() => navigation.navigate('Referrals')}
          >
            <Text style={[s.upgradeCtaTitle, { color: palette.text }]}>Refer a friend</Text>
            <Text style={[s.upgradeCtaBody, { color: palette.subtext }]}>
              Share your code and earn KIS Coins when they subscribe.
            </Text>
          </Pressable>

          {/* Use coins CTA — the only real redemption path: subsidizing a
              subscription upgrade. No generic "spend coins" form exists
              because the backend has no generic spend action. */}
          {available > 0 && (
            <Pressable
              style={[s.upgradeCta, { backgroundColor: palette.surfaceElevated ?? palette.surface, borderColor: palette.primaryStrong }]}
              onPress={() => navigation.navigate('SubscriptionManagement')}
            >
              <Text style={[s.upgradeCtaTitle, { color: palette.text }]}>Use your coins</Text>
              <Text style={[s.upgradeCtaBody, { color: palette.subtext }]}>
                KIS Coins can discount an eligible subscription upgrade, up to a limit. Manage your subscription to see how much you can apply.
              </Text>
            </Pressable>
          )}

          {/* Achievements */}
          <View>
            <Text style={[s.sectionTitle, { color: palette.text }]}>Ways to Earn KIS Coins</Text>
            {achievements.length === 0 ? (
              <Text style={[s.emptyNote, { color: palette.subtext }]}>
                No earning achievements configured yet — check back soon.
              </Text>
            ) : (
              achievements.map((a) => (
                <View
                  key={a.code}
                  style={[s.ruleCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}
                >
                  <View style={s.ruleRow}>
                    <View style={s.ruleInfo}>
                      <Text style={[s.ruleName, { color: palette.text }]}>{a.title}</Text>
                      <Text style={[s.ruleStatus, { color: a.completed ? palette.success : palette.subtext }]}>
                        {a.completed ? `Completed${a.completed_at ? ` · ${formatDate(a.completed_at)}` : ''}` : 'Not yet completed'}
                      </Text>
                    </View>
                    <View style={[s.rulePts, { backgroundColor: `${palette.primaryStrong}20` }]}>
                      <Text style={[s.rulePtsText, { color: palette.primaryStrong }]}>+{a.coin_amount}</Text>
                      <Text style={[s.rulePtsSub, { color: palette.primaryStrong }]}>coins</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* History */}
          <View>
            <Text style={[s.sectionTitle, { color: palette.text }]}>Recent Activity</Text>
            {history.length === 0 ? (
              <Text style={[s.emptyNote, { color: palette.subtext }]}>
                No coins activity yet. Start engaging to earn!
              </Text>
            ) : (
              history.slice(0, 20).map((item) => {
                const isPositive = item.amount >= 0;
                return (
                  <View key={item.id} style={[s.activityItem, { borderBottomColor: palette.divider }]}>
                    <View style={s.activityLeft}>
                      <Text style={[s.activityDesc, { color: palette.text }]} numberOfLines={1}>
                        {item.description || STATUS_LABELS[item.status] || item.type}
                      </Text>
                      <Text style={[s.activityDate, { color: palette.subtext }]}>
                        {formatDate(item.effective_at)} · {STATUS_LABELS[item.status] ?? item.status}
                      </Text>
                      {item.status === 'confirmed' && item.expires_at && (
                        <Text style={[s.activityDate, { color: palette.warning ?? palette.subtext }]}>
                          Expires {formatDate(item.expires_at)}
                        </Text>
                      )}
                    </View>
                    <Text style={[s.activityPts, { color: isPositive ? palette.success : palette.danger }]}>
                      {isPositive ? '+' : ''}{item.amount}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Disclaimer */}
          <View style={[s.disclaimerCard, { backgroundColor: palette.surfaceElevated ?? palette.surface, borderColor: palette.divider }]}>
            <Text style={[s.disclaimerText, { color: palette.subtext }]}>
              KIS Coins are rewards for meaningful participation in the KIS ecosystem. They can currently be used
              toward eligible KIS subscription upgrades. They cannot currently be withdrawn, transferred, or
              exchanged for cash. Additional uses may become available in the future, subject to applicable laws,
              regulations, licensing, approvals, and KIS program terms.
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
  balanceCard: { borderRadius: 20, padding: 24, alignItems: 'center' },
  balanceLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  balanceValue: { fontSize: 56, fontWeight: '900', lineHeight: 64 },
  balanceSub: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  balanceStatsRow: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  balanceStat: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  balanceStatLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceStatValue: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  upgradeCta: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 6 },
  upgradeCtaTitle: { fontSize: 14, fontWeight: '900' },
  upgradeCtaBody: { fontSize: 12, lineHeight: 17 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  emptyNote: { fontSize: 13, fontStyle: 'italic' },
  ruleCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ruleInfo: { flex: 1, marginRight: 12 },
  ruleName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  ruleStatus: { fontSize: 12, fontWeight: '600' },
  rulePts: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  rulePtsText: { fontSize: 18, fontWeight: '900' },
  rulePtsSub: { fontSize: 10, fontWeight: '600' },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  activityLeft: { flex: 1, marginRight: 12 },
  activityDesc: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  activityDate: { fontSize: 12 },
  activityPts: { fontSize: 16, fontWeight: '800' },
  disclaimerCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  disclaimerText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
