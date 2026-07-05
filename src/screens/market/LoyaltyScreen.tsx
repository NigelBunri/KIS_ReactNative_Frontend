import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useNavigation } from '@react-navigation/native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { SafeAreaView } from 'react-native-safe-area-context';

type LoyaltyRule = {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  points_earned?: number;
  earn_rate?: number;
  action?: string;
  trigger?: string;
};

type LoyaltyActivity = {
  id?: string;
  points?: number;
  action?: string;
  description?: string;
  created_at?: string;
  date?: string;
  type?: string;
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

const normalizeList = (payload: any): any[] => {
  const source = payload?.data ?? payload ?? {};
  const results = source?.results ?? source;
  return Array.isArray(results) ? results : [];
};

export default function LoyaltyScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();

  const [balance, setBalance] = useState<number>(0);
  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [history, setHistory] = useState<LoyaltyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemVisible, setRedeemVisible] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [balanceRes, rulesRes, historyRes] = await Promise.all([
        getRequest(ROUTES.billing.loyaltyBalance, {
          forceNetwork: isRefresh,
          errorMessage: 'Unable to load loyalty balance.',
        }),
        getRequest(ROUTES.billing.loyaltyRules, {
          forceNetwork: isRefresh,
          errorMessage: 'Unable to load loyalty rules.',
        }),
        getRequest(ROUTES.billing.loyalty, {
          forceNetwork: isRefresh,
          errorMessage: 'Unable to load loyalty history.',
        }),
      ]);

      if (balanceRes?.success) {
        const raw = balanceRes.data;
        const points =
          raw?.points ?? raw?.balance ?? raw?.point_balance ?? raw?.data?.points ?? 0;
        setBalance(Number(points) || 0);
      }
      if (rulesRes?.success) {
        setRules(normalizeList(rulesRes.data));
      }
      if (historyRes?.success) {
        setHistory(normalizeList(historyRes.data));
      }
      if (!balanceRes?.success && !rulesRes?.success && !historyRes?.success) {
        setError('Unable to load loyalty data.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load loyalty data.');
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

  const handleRedeem = useCallback(async () => {
    const points = Number(redeemPoints);
    if (!points || points <= 0) {
      Alert.alert('Spend Coins', 'Enter a valid number of coins to spend.');
      return;
    }
    if (points > balance) {
      Alert.alert('Spend Coins', `You only have ${balance} coins available.`);
      return;
    }
    setRedeeming(true);
    try {
      const response = await postRequest(
        ROUTES.billing.loyaltyRedeem,
        { points },
        { errorMessage: 'Unable to spend coins.' },
      );
      if (response?.success) {
        Alert.alert('Spend Coins', 'Coins spent successfully!');
        setRedeemPoints('');
        setRedeemVisible(false);
        void fetchAll(true);
      } else {
        Alert.alert(
          'Spend Coins',
          response?.message ?? 'Unable to spend coins.',
        );
      }
    } catch (err: any) {
      Alert.alert('Spend Coins', err?.message ?? 'Unable to spend coins.');
    } finally {
      setRedeeming(false);
    }
  }, [balance, fetchAll, redeemPoints]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg, marginTop: 25 }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.header, { borderBottomColor: palette.divider }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.backBtn}
          >
            <Text style={[s.backText, { color: palette.primaryStrong }]}>
              Back
            </Text>
          </Pressable>
          <Text style={[s.headerTitle, { color: palette.text }]}>
            KIS Coins
          </Text>
          <View style={s.backBtn} />
        </View>

        {loading && !refreshing ? (
          <View style={s.center}>
            <ActivityIndicator color={palette.primaryStrong} size="large" />
          </View>
        ) : error ? (
          <View style={s.center}>
            <Text style={[s.errorText, { color: palette.danger }]}>
              {error}
            </Text>
            <Pressable
              onPress={() => void fetchAll()}
              style={[s.retryBtn, { borderColor: palette.primaryStrong }]}
            >
              <Text style={[s.retryText, { color: palette.primaryStrong }]}>
                Retry
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={palette.primaryStrong}
              />
            }
          >
            {/* Balance Card */}
            <View
              style={[
                s.balanceCard,
                { backgroundColor: palette.primaryStrong },
              ]}
            >
              <Text style={[s.balanceLabel, { color: palette.ivory }]}>Your Coins</Text>
              <Text style={[s.balanceValue, { color: palette.onPrimary }]}>
                {balance.toLocaleString()}
              </Text>
              <Text style={[s.balanceSub, { color: palette.ivory }]}>KIS Coins</Text>
              {balance > 0 && (
                <Pressable
                  style={[s.redeemToggleBtn, { borderColor: palette.ivory }]}
                  onPress={() => setRedeemVisible(prev => !prev)}
                >
                  <Text style={[s.redeemToggleText, { color: palette.onPrimary }]}>
                    {redeemVisible ? 'Cancel' : 'Spend Coins'}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Redeem Input */}
            {redeemVisible && balance > 0 ? (
              <View
                style={[
                  s.redeemCard,
                  {
                    backgroundColor: palette.surfaceElevated,
                    borderColor: palette.divider,
                  },
                ]}
              >
                <Text style={[s.sectionTitle, { color: palette.text }]}>
                  Spend Coins
                </Text>
                <Text
                  style={[s.redeemHint, { color: palette.subtext }]}
                >
                  Available: {balance.toLocaleString()} coins
                </Text>
                <View style={s.redeemRow}>
                  <TextInput
                    style={[
                      s.redeemInput,
                      {
                        color: palette.text,
                        borderColor: palette.divider,
                        backgroundColor: palette.surface,
                      },
                    ]}
                    placeholder="Coins to spend"
                    placeholderTextColor={palette.subtext}
                    keyboardType="numeric"
                    value={redeemPoints}
                    onChangeText={setRedeemPoints}
                    editable={!redeeming}
                  />
                  <Pressable
                    style={[
                      s.redeemBtn,
                      {
                        backgroundColor: redeeming
                          ? palette.subtext
                          : palette.primaryStrong,
                      },
                    ]}
                    onPress={handleRedeem}
                    disabled={redeeming}
                  >
                    {redeeming ? (
                      <ActivityIndicator color={palette.onPrimary} size="small" />
                    ) : (
                      <Text style={[s.redeemBtnText, { color: palette.onPrimary }]}>Apply</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Earning Rules */}
            <View>
              <Text style={[s.sectionTitle, { color: palette.text }]}>
                How to Earn KIS Coins
              </Text>
              {rules.length === 0 ? (
                <Text style={[s.emptyNote, { color: palette.subtext }]}>
                  No earning rules configured yet.
                </Text>
              ) : (
                rules.map((rule, idx) => (
                  <View
                    key={rule.id ?? idx}
                    style={[
                      s.ruleCard,
                      {
                        backgroundColor: palette.surfaceElevated,
                        borderColor: palette.divider,
                      },
                    ]}
                  >
                    <View style={s.ruleRow}>
                      <View style={s.ruleInfo}>
                        <Text
                          style={[s.ruleName, { color: palette.text }]}
                        >
                          {rule.title ?? rule.name ?? rule.action ?? `Rule ${idx + 1}`}
                        </Text>
                        {rule.description ? (
                          <Text
                            style={[s.ruleDesc, { color: palette.subtext }]}
                            numberOfLines={2}
                          >
                            {rule.description}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          s.rulePts,
                          {
                            backgroundColor: `${palette.primaryStrong}20`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.rulePtsText,
                            { color: palette.primaryStrong },
                          ]}
                        >
                          +{rule.points_earned ?? rule.earn_rate ?? '?'}
                        </Text>
                        <Text
                          style={[
                            s.rulePtsSub,
                            { color: palette.primaryStrong },
                          ]}
                        >
                          coins
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Activity History */}
            <View>
              <Text style={[s.sectionTitle, { color: palette.text }]}>
                Recent Activity
              </Text>
              {history.length === 0 ? (
                <Text style={[s.emptyNote, { color: palette.subtext }]}>
                  No coins activity yet. Start engaging to earn!
                </Text>
              ) : (
                history.slice(0, 20).map((item, idx) => {
                  const pts = Number(item.points ?? 0);
                  const isPositive = pts >= 0;
                  return (
                    <View
                      key={item.id ?? idx}
                      style={[
                        s.activityItem,
                        { borderBottomColor: palette.divider },
                      ]}
                    >
                      <View style={s.activityLeft}>
                        <Text
                          style={[s.activityDesc, { color: palette.text }]}
                          numberOfLines={1}
                        >
                          {item.description ??
                            item.action ??
                            item.type ??
                            'Points activity'}
                        </Text>
                        <Text
                          style={[s.activityDate, { color: palette.subtext }]}
                        >
                          {formatDate(item.date ?? item.created_at)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          s.activityPts,
                          {
                            color: isPositive ? (palette.success) : (palette.danger),
                          },
                        ]}
                      >
                        {isPositive ? '+' : ''}{pts}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Disclaimer */}
            <View
              style={[
                s.disclaimerCard,
                {
                  backgroundColor: palette.surfaceElevated ?? palette.surface,
                  borderColor: palette.divider,
                },
              ]}
            >
              <Text style={[s.disclaimerText, { color: palette.subtext }]}>
                KIS Coins are virtual engagement rewards. They have no monetary value and cannot be exchanged for cash.
              </Text>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { fontSize: 14, fontWeight: '700' },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 64,
  },
  balanceSub: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  redeemToggleBtn: {
    marginTop: 16,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  redeemToggleText: { fontWeight: '700', fontSize: 14 },
  redeemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  redeemHint: { fontSize: 12, marginBottom: 12 },
  redeemRow: { flexDirection: 'row', gap: 10 },
  redeemInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  redeemBtn: {
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  redeemBtnText: { fontWeight: '700', fontSize: 14 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyNote: { fontSize: 13, fontStyle: 'italic' },
  ruleCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleInfo: { flex: 1, marginRight: 12 },
  ruleName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  ruleDesc: { fontSize: 12 },
  rulePts: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
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
  disclaimerCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
