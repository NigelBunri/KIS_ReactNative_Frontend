import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { useNavigation } from '@react-navigation/native';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { KISIcon } from '@/constants/kisIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

// ─── Types ────────────────────────────────────────────────────────────────────

type CoinsBalance = {
  balance: number;
  earned_this_week?: number;
  earned_this_month?: number;
};

type LoyaltyRule = {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  action?: string;
  trigger?: string;
  points_earned?: number;
  earn_rate?: number;
  icon?: string;
};

type LoyaltyActivity = {
  id?: string;
  points?: number;
  coins?: number;
  action?: string;
  description?: string;
  created_at?: string;
  date?: string;
  type?: string;
};

type BillingRecord = {
  id: string;
  description?: string;
  amount?: number;
  amount_cents?: number;
  currency?: string;
  date?: string;
  created_at?: string;
  payment_method?: string;
  receipt_url?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const formatCurrency = (cents?: number, currency = 'USD') => {
  if (cents == null) return '$0.00';
  const dollars = cents / 100;
  return `${dollars.toLocaleString('en-US', { style: 'currency', currency })}`;
};

const normalizeList = (payload: any): any[] => {
  const source = payload?.data ?? payload ?? {};
  const results = source?.results ?? source;
  return Array.isArray(results) ? results : [];
};

// ─── Static fallback earning rules ───────────────────────────────────────────

const STATIC_EARN_RULES: Array<{ icon: string; action: string; coins: number }> = [
  { icon: 'edit', action: 'Post content', coins: 10 },
  { icon: 'calendar', action: 'Attend an event', coins: 20 },
  { icon: 'book', action: 'Complete a Bible lesson', coins: 15 },
  { icon: 'people', action: 'Invite a friend', coins: 50 },
  { icon: 'flame', action: 'Daily login streak', coins: 5 },
  { icon: 'person', action: 'Complete your profile', coins: 30 },
];

// ─── Disclaimer card ──────────────────────────────────────────────────────────

function DisclaimerCard({ palette }: { palette: ReturnType<typeof useKISTheme>['palette'] }) {
  return (
    <View style={[s.disclaimerCard, { backgroundColor: palette.surfaceElevated ?? palette.surface, borderColor: palette.divider }]}>
      <Text style={[s.disclaimerText, { color: palette.subtext }]}>
        KIS Coins are virtual engagement rewards earned through participation on the KIS platform.
        They have no monetary value, are not exchangeable for cash or cryptocurrency, and cannot be transferred to other users.
      </Text>
    </View>
  );
}

// ─── Tab 1: My Coins ──────────────────────────────────────────────────────────

type MyCoinsTabProps = {
  palette: ReturnType<typeof useKISTheme>['palette'];
  refreshing: boolean;
  onRefresh: () => void;
  onScrollToEarn: () => void;
  onScrollToSpend: () => void;
};

function MyCoinsTab({ palette, refreshing, onRefresh, onScrollToEarn, onScrollToSpend }: MyCoinsTabProps) {
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const responsive = useResponsiveLayout();
  const [coinsData, setCoinsData] = useState<CoinsBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.billing.loyaltyBalance, {
        errorMessage: 'Unable to load KIS Coins balance.',
        forceNetwork: isRefresh,
      });
      if (res?.success) {
        const raw = res.data?.data ?? res.data ?? {};
        const balance = Number(
          raw?.points ?? raw?.balance ?? raw?.point_balance ?? raw?.coins ?? 0,
        ) || 0;
        const earnedWeek = Number(raw?.earned_this_week ?? raw?.weekly_earned ?? 0) || 0;
        const earnedMonth = Number(raw?.earned_this_month ?? raw?.monthly_earned ?? 0) || 0;
        setCoinsData({ balance, earned_this_week: earnedWeek, earned_this_month: earnedMonth });
      } else {
        setError(res?.message || 'Unable to load KIS Coins balance.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load KIS Coins balance.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (refreshing) void load(true); }, [refreshing, load]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={palette.primaryStrong} size="large" /></View>;
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
        <Pressable onPress={() => load()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
          <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const balance = coinsData?.balance ?? 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: responsive.pageGutter, gap: 16, paddingBottom: insets.bottom + responsive.pageGutter, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primaryStrong} />
      }
    >
      {/* Balance hero card */}
      <View style={[s.heroCard, { backgroundColor: palette.primaryStrong }]}>
        <Text style={[s.heroLabel, { color: palette.onPrimary }]}>KIS Coins Balance</Text>
        <View style={s.heroCoinsRow}>
          <Text style={s.heroCoinIcon}>🪙</Text>
          <Text style={[s.heroAmount, { color: palette.onPrimary }]}>{balance.toLocaleString()}</Text>
        </View>
        <Text style={[s.heroTagline, { color: palette.onPrimary }]}>
          KIS Coins — earn through engagement, never redeemable for cash
        </Text>
        <View style={s.heroSubCards}>
          <View style={[s.heroSubCard, { backgroundColor: palette.primaryWeak }]}>
            <Text style={[s.heroSubLabel, { color: palette.onPrimary }]}>This Week</Text>
            <Text style={[s.heroSubValue, { color: palette.onPrimary }]}>+{(coinsData?.earned_this_week ?? 0).toLocaleString()}</Text>
          </View>
          <View style={[s.heroSubCard, { backgroundColor: palette.primaryWeak }]}>
            <Text style={[s.heroSubLabel, { color: palette.onPrimary }]}>This Month</Text>
            <Text style={[s.heroSubValue, { color: palette.onPrimary }]}>+{(coinsData?.earned_this_month ?? 0).toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Navigation shortcuts */}
      <View style={s.actionRow}>
        <Pressable
          style={({ pressed }) => [
            s.actionBtn,
            { backgroundColor: pressed ? palette.primarySoft : palette.surface, borderColor: palette.divider },
          ]}
          onPress={onScrollToEarn}
        >
          <KISIcon name="star" size={22} color={palette.primaryStrong} />
          <Text style={[s.actionBtnLabel, { color: palette.text }]}>How to Earn</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            s.actionBtn,
            { backgroundColor: pressed ? palette.primarySoft : palette.surface, borderColor: palette.divider },
          ]}
          onPress={onScrollToSpend}
        >
          <KISIcon name="gift" size={22} color={palette.primaryStrong} />
          <Text style={[s.actionBtnLabel, { color: palette.text }]}>Spend Coins</Text>
        </Pressable>
      </View>

      <DisclaimerCard palette={palette} />
    </ScrollView>
  );
}

// ─── Tab 2: Earn ─────────────────────────────────────────────────────────────

type EarnTabProps = {
  palette: ReturnType<typeof useKISTheme>['palette'];
  refreshing: boolean;
  onRefresh: () => void;
  scrollRef?: React.RefObject<ScrollView | null>;
};

function EarnTab({ palette, refreshing, onRefresh, scrollRef }: EarnTabProps) {
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const responsive = useResponsiveLayout();
  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.billing.loyaltyRules, {
        errorMessage: 'Unable to load earning rules.',
        forceNetwork: isRefresh,
      });
      if (res?.success) {
        setRules(normalizeList(res.data));
      } else {
        // Silently fall back to static rules
        setRules([]);
      }
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (refreshing) void load(true); }, [refreshing, load]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={palette.primaryStrong} size="large" /></View>;
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
        <Pressable onPress={() => load()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
          <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const displayRules: Array<{ key: string; icon: string; action: string; coins: number; description?: string }> =
    rules.length > 0
      ? rules.map((rule, idx) => ({
          key: rule.id ?? String(idx),
          icon: 'star',
          action: rule.title ?? rule.name ?? rule.action ?? rule.trigger ?? `Rule ${idx + 1}`,
          coins: Number(rule.points_earned ?? rule.earn_rate ?? 0),
          description: rule.description,
        }))
      : STATIC_EARN_RULES.map((r, idx) => ({ key: String(idx), ...r }));

  return (
    <ScrollView
      ref={scrollRef as any}
      contentContainerStyle={{ padding: responsive.pageGutter, gap: 12, paddingBottom: insets.bottom + responsive.pageGutter, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primaryStrong} />
      }
    >
      <Text style={[s.sectionTitle, { color: palette.text }]}>Ways to Earn KIS Coins</Text>
      <Text style={[s.sectionSubtitle, { color: palette.subtext }]}>
        Participate in the KIS community to earn coins. The more you engage, the more you earn.
      </Text>

      {displayRules.map(rule => (
        <View key={rule.key} style={[s.ruleCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
          <View style={[s.ruleIconWrap, { backgroundColor: `${palette.primaryStrong}18` }]}>
            <KISIcon name={rule.icon} size={22} color={palette.primaryStrong} />
          </View>
          <View style={s.ruleContent}>
            <Text style={[s.ruleName, { color: palette.text }]}>{rule.action}</Text>
            {rule.description ? (
              <Text style={[s.ruleDesc, { color: palette.subtext }]} numberOfLines={2}>{rule.description}</Text>
            ) : null}
          </View>
          <View style={[s.ruleCoins, { backgroundColor: `${palette.primaryStrong}18` }]}>
            <Text style={[s.ruleCoinsBadge, { color: palette.primaryStrong }]}>
              +{rule.coins}
            </Text>
            <Text style={[s.ruleCoinsLabel, { color: palette.primaryStrong }]}>coins</Text>
          </View>
        </View>
      ))}

      <DisclaimerCard palette={palette} />
    </ScrollView>
  );
}

// ─── Tab 3: History ───────────────────────────────────────────────────────────

type HistoryTabProps = {
  palette: ReturnType<typeof useKISTheme>['palette'];
  refreshing: boolean;
  onRefresh: () => void;
  scrollRef?: React.RefObject<ScrollView | null>;
};

function HistoryTab({ palette, refreshing, onRefresh, scrollRef }: HistoryTabProps) {
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const responsive = useResponsiveLayout();
  const [activities, setActivities] = useState<LoyaltyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.billing.loyalty, {
        errorMessage: 'Unable to load KIS Coins history.',
        forceNetwork: isRefresh,
      });
      if (res?.success) {
        setActivities(normalizeList(res.data));
      } else {
        setError(res?.message || 'Unable to load KIS Coins history.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load KIS Coins history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (refreshing) void load(true); }, [refreshing, load]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={palette.primaryStrong} size="large" /></View>;
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
        <Pressable onPress={() => load()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
          <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef as any}
      contentContainerStyle={{ padding: responsive.pageGutter, paddingBottom: insets.bottom + responsive.pageGutter, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primaryStrong} />
      }
    >
      {activities.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🪙</Text>
          <Text style={[s.emptyTitle, { color: palette.text }]}>No activity yet</Text>
          <Text style={[s.emptySubtitle, { color: palette.subtext }]}>
            No coins activity yet. Start engaging to earn!
          </Text>
        </View>
      ) : (
        activities.map((item, idx) => {
          const coins = Number(item.points ?? item.coins ?? 0);
          const isEarn = coins >= 0;
          return (
            <View
              key={item.id ?? String(idx)}
              style={[s.historyRow, { borderBottomColor: palette.divider }]}
            >
              <View style={[s.historyIconWrap, {
                backgroundColor: isEarn ? (palette.success) + '22' : (palette.danger) + '22',
              }]}>
                <Text style={[s.historyIconText, { color: palette.text }]}>{isEarn ? '+' : '−'}</Text>
              </View>
              <View style={s.historyContent}>
                <Text style={[s.historyDesc, { color: palette.text }]} numberOfLines={1}>
                  {item.description ?? item.action ?? item.type ?? 'Coins activity'}
                </Text>
                <Text style={[s.historyDate, { color: palette.subtext }]}>
                  {formatDate(item.date ?? item.created_at)}
                </Text>
              </View>
              <Text style={[s.historyCoins, { color: isEarn ? (palette.success) : (palette.gold) }]}>
                {isEarn ? '+' : ''}{coins.toLocaleString()}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// ─── Tab 4: Billing ───────────────────────────────────────────────────────────

type BillingTabProps = {
  palette: ReturnType<typeof useKISTheme>['palette'];
  refreshing: boolean;
  onRefresh: () => void;
};

function BillingTab({ palette, refreshing, onRefresh }: BillingTabProps) {
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const responsive = useResponsiveLayout();
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getRequest(ROUTES.billing.invoices, {
        errorMessage: 'Unable to load billing history.',
        forceNetwork: isRefresh,
      });
      if (res?.success) {
        setRecords(normalizeList(res.data));
      } else {
        setError(res?.message || 'Unable to load billing history.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load billing history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (refreshing) void load(true); }, [refreshing, load]);

  const openReceipt = useCallback(async (url?: string) => {
    if (!url) {
      Alert.alert('Receipt', 'No receipt link available.');
      return;
    }
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Receipt', 'Cannot open this link.');
      }
    } catch {
      Alert.alert('Receipt', 'Unable to open receipt.');
    }
  }, []);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={palette.primaryStrong} size="large" /></View>;
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={[s.errorText, { color: palette.danger }]}>{error}</Text>
        <Pressable onPress={() => load()} style={[s.retryBtn, { borderColor: palette.primaryStrong }]}>
          <Text style={[s.retryText, { color: palette.primaryStrong }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: responsive.pageGutter, gap: 12, paddingBottom: insets.bottom + responsive.pageGutter, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primaryStrong} />
      }
    >
      <Text style={[s.sectionTitle, { color: palette.text }]}>Subscription Invoices</Text>
      <Text style={[s.sectionSubtitle, { color: palette.subtext }]}>
        Billing history for your KIS subscriptions paid via App Store or Flutterwave.
      </Text>

      {records.length === 0 ? (
        <Text style={[s.emptyNote, { color: palette.subtext }]}>No billing records yet.</Text>
      ) : (
        records.map((rec, idx) => (
          <View
            key={rec.id ?? String(idx)}
            style={[s.billingCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[s.billingDesc, { color: palette.text }]} numberOfLines={1}>
                {rec.description || 'Billing record'}
              </Text>
              <Text style={[s.billingAmount, { color: palette.text }]}>
                {formatCurrency(rec.amount_cents ?? (rec.amount ? Math.round(Number(rec.amount) * 100) : undefined), rec.currency)}
              </Text>
            </View>
            {rec.payment_method ? (
              <Text style={[s.billingMeta, { color: palette.subtext }]}>{rec.payment_method}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Text style={[s.billingMeta, { color: palette.subtext }]}>
                {formatDate(rec.date ?? rec.created_at)}
              </Text>
              {rec.receipt_url ? (
                <Pressable onPress={() => openReceipt(rec.receipt_url)}>
                  <Text style={[s.billingReceiptLink, { color: palette.primaryStrong }]}>View Receipt</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type SubTab = 'coins' | 'earn' | 'history' | 'billing';

export default function WalletScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const responsive = useResponsiveLayout();
  const [activeTab, setActiveTab] = useState<SubTab>('coins');
  const [refreshing, setRefreshing] = useState(false);

  const earnScrollRef = useRef<ScrollView>(null);
  const historyScrollRef = useRef<ScrollView>(null);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const scrollToEarn = useCallback(() => {
    setActiveTab('earn');
  }, []);

  const scrollToSpend = useCallback(() => {
    setActiveTab('history');
  }, []);

  const tabs: Array<{ key: SubTab; label: string }> = [
    { key: 'coins', label: 'My Coins' },
    { key: 'earn', label: 'Earn' },
    { key: 'history', label: 'History' },
    { key: 'billing', label: 'Billing' },
  ];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg, }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.backBtn}
        >
          <Text style={[s.backText, { color: palette.primaryStrong }]}>Back</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: palette.text }]}>KIS Coins</Text>
        <View style={s.backBtn} />
      </View>

      {/* Sub-tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.tabBar, { borderBottomColor: palette.divider }]}
      >
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 4 }}>
          {tabs.map(tab => (
            <Pressable
              key={tab.key}
              style={[
                s.tab,
                activeTab === tab.key && [s.tabActive, { borderBottomColor: palette.primaryStrong }],
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  s.tabText,
                  { color: activeTab === tab.key ? palette.primaryStrong : palette.subtext },
                  activeTab === tab.key && { fontWeight: '800' },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'coins' && (
          <MyCoinsTab
            palette={palette}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onScrollToEarn={scrollToEarn}
            onScrollToSpend={scrollToSpend}
          />
        )}
        {activeTab === 'earn' && (
          <EarnTab
            palette={palette}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            scrollRef={earnScrollRef}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab
            palette={palette}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            scrollRef={historyScrollRef}
          />
        )}
        {activeTab === 'billing' && (
          <BillingTab
            palette={palette}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  backBtn: { width: 60, minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabBar: {
    borderBottomWidth: 1,
    flexGrow: 0,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
  emptyNote: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: 16 },

  // Hero card
  heroCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroCoinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  heroCoinIcon: {
    fontSize: 36,
  },
  heroAmount: {
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 60,
  },
  heroTagline: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  heroSubCards: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  heroSubCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  heroSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroSubValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Disclaimer
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

  // Section headings
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 8 },

  // Earn tab — rule cards
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  ruleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ruleContent: { flex: 1 },
  ruleName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  ruleDesc: { fontSize: 12 },
  ruleCoins: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  ruleCoinsBadge: { fontSize: 16, fontWeight: '900' },
  ruleCoinsLabel: { fontSize: 10, fontWeight: '600' },

  // History tab
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyIconText: {
    fontSize: 16,
    fontWeight: '900',
  },
  historyContent: { flex: 1 },
  historyDesc: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  historyDate: { fontSize: 12 },
  historyCoins: { fontSize: 16, fontWeight: '800', flexShrink: 0 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },

  // Billing tab
  billingCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  billingDesc: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  billingAmount: { fontSize: 15, fontWeight: '800' },
  billingMeta: { fontSize: 12, marginTop: 2 },
  billingReceiptLink: { fontSize: 13, fontWeight: '700' },
});
