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
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

type TierPlan = {
  id: string;
  name?: string;
  price?: number | string;
  subscriber_count?: number;
  currency?: string;
};

type TierSubscription = {
  id: string;
  plan?: string | { name?: string; price?: number };
  status?: string;
  amount?: number;
};

type TierStats = {
  totalPlans: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  estimatedRevenue: number;
};

export default function TiersDashboardScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const [plans, setPlans] = useState<TierPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<TierSubscription[]>([]);
  const [stats, setStats] = useState<TierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, subsRes] = await Promise.allSettled([
        getRequest(ROUTES.billing.tierPlans, { errorMessage: 'Unable to load tier plans.' }),
        getRequest(ROUTES.billing.tierSubscriptions, {
          errorMessage: 'Unable to load subscriptions.',
        }),
      ]);

      const planItems: TierPlan[] =
        plansRes.status === 'fulfilled'
          ? plansRes.value.data?.results ?? plansRes.value.data ?? []
          : [];
      const subItems: TierSubscription[] =
        subsRes.status === 'fulfilled'
          ? subsRes.value.data?.results ?? subsRes.value.data ?? []
          : [];

      setPlans(planItems);
      setSubscriptions(subItems.slice(0, 30));

      const activeCount = subItems.filter(
        (s) => s.status === 'active' || s.status === 'trialing',
      ).length;

      const revenue = planItems.reduce(
        (sum, p) => sum + (Number(p.price ?? 0) * (p.subscriber_count ?? 0)),
        0,
      );

      setStats({
        totalPlans: planItems.length,
        totalSubscriptions: subItems.length,
        activeSubscriptions: activeCount,
        estimatedRevenue: revenue,
      });
    } catch (e: any) {
      setError(e?.message || 'Unable to load tiers data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statCards: { label: string; value: string }[] = stats
    ? [
        { label: 'Tier Plans', value: String(stats.totalPlans) },
        { label: 'Total Subs', value: String(stats.totalSubscriptions) },
        { label: 'Active Subs', value: String(stats.activeSubscriptions) },
        {
          label: 'Est. Revenue',
          value: stats.estimatedRevenue > 0 ? `$${stats.estimatedRevenue.toFixed(0)}` : '—',
        },
      ]
    : [];

  // Bar-chart-style plan breakdown using Views
  const maxSubscribers =
    plans.length > 0 ? Math.max(...plans.map((p) => p.subscriber_count ?? 0), 1) : 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg, }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.title, { color: palette.text }]}>Tiers</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          Plan distribution, subscription health, and revenue per tier.
        </Text>
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
          {/* Stat cards */}
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

          {/* Bar chart: users per tier */}
          {plans.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Users per Tier
              </Text>
              {plans.map((plan, idx) => {
                const subs = plan.subscriber_count ?? 0;
                const pct = maxSubscribers > 0 ? (subs / maxSubscribers) * 100 : 0;
                const barColor =
                  idx === 0
                    ? palette.primaryStrong
                    : idx === 1
                    ? palette.success
                    : idx === 2
                    ? palette.gold
                    : palette.primaryStrong;
                return (
                  <View key={String(plan.id)} style={styles.barRow}>
                    <Text
                      style={[styles.barLabel, { color: palette.text }]}
                      numberOfLines={1}
                    >
                      {plan.name ?? `Plan ${plan.id}`}
                    </Text>
                    <View
                      style={[
                        styles.barTrack,
                        { backgroundColor: palette.divider },
                      ]}
                    >
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.max(pct, 2)}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barCount, { color: palette.subtext }]}>
                      {subs}
                    </Text>
                  </View>
                );
              })}
            </>
          )}

          {/* Subscription list */}
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Recent Subscriptions
          </Text>

          {subscriptions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ color: palette.subtext }}>No subscription data available.</Text>
            </View>
          ) : (
            subscriptions.slice(0, 15).map((sub) => {
              const planName =
                typeof sub.plan === 'string'
                  ? sub.plan
                  : (sub.plan as any)?.name ?? 'Unknown plan';
              const statusColor =
                sub.status === 'active' || sub.status === 'trialing'
                  ? palette.success
                  : palette.gold;
              return (
                <View
                  key={String(sub.id)}
                  style={[
                    styles.card,
                    { backgroundColor: palette.card, borderColor: palette.divider },
                  ]}
                >
                  <View style={styles.cardRow}>
                    <Text style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>
                      {planName}
                    </Text>
                    {sub.status ? (
                      <Text style={[styles.statusBadge, { color: statusColor }]}>
                        {sub.status}
                      </Text>
                    ) : null}
                  </View>
                  {sub.amount ? (
                    <Text style={[styles.cardMeta, { color: palette.subtext }]}>
                      ${Number(sub.amount).toFixed(2)}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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
    minWidth: '45%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: { fontSize: 13, fontWeight: '600', width: 80 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  barCount: { fontSize: 12, width: 32, textAlign: 'right' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  statusBadge: { fontSize: 12, fontWeight: '700' },
  cardMeta: { fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  empty: { paddingVertical: 24, alignItems: 'center' },
});
