import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatorAnalytics'>;

type MonthlyTrend = {
  month: string;
  plays: number;
  downloads: number;
  revenue: number;
};

type RoyaltyRow = {
  id: string;
  track_title: string;
  period: string;
  play_count: number;
  royalty_amount: number;
  currency?: string;
};

type AnalyticsData = {
  total_plays: number;
  total_downloads: number;
  total_revenue: number;
  currency?: string;
  monthly_trends: MonthlyTrend[];
  royalties: RoyaltyRow[];
};

function formatCurrency(amount: number, currency = 'USD'): string {
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(1)}K`;
  return `${currency} ${amount.toFixed(2)}`;
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function CreatorAnalyticsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.mediaExtended.creatorAnalytics)
        .then((res: any) => {
          if (active) setData(res?.data ?? res ?? null);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const trends: MonthlyTrend[] = (data?.monthly_trends ?? []).slice(-6);
  const maxPlays = Math.max(...trends.map((t) => t.plays), 1);
  const royalties: RoyaltyRow[] = data?.royalties ?? [];

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { padding: sp, paddingBottom: sp + 4 },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 44 },
    backLabel: { fontSize: 16, color: palette.ivory, marginLeft: 4 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: palette.ivory },
    scroll: { flex: 1 },
    content: { padding: sp, paddingBottom: 80 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    statIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    statValue: { fontSize: 18, fontWeight: '800', color: palette.primary, marginBottom: 2 },
    statLabel: { fontSize: 11, color: palette.subtext, textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 12 },
    chartCard: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: sp,
      marginBottom: 20,
    },
    chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100 },
    barWrap: { flex: 1, alignItems: 'center' },
    bar: { width: '100%', borderRadius: 4, minHeight: 4 },
    barLabel: { fontSize: 10, color: palette.subtext, marginTop: 4, textAlign: 'center' },
    royaltyCard: {
      backgroundColor: palette.card,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 20,
    },
    royaltyHeader: {
      flexDirection: 'row',
      paddingHorizontal: sp,
      paddingVertical: 10,
      backgroundColor: palette.surface,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    royaltyHeaderText: { fontSize: 12, fontWeight: '700', color: palette.subtext },
    royaltyRow: {
      flexDirection: 'row',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
      alignItems: 'center',
      minHeight: 52,
    },
    royaltyTrack: { flex: 3 },
    royaltyTrackTitle: { fontSize: 14, color: palette.text, fontWeight: '500' },
    royaltyPeriod: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    royaltyPlays: { flex: 1, alignItems: 'center' },
    royaltyPlaysText: { fontSize: 14, color: palette.text },
    royaltyAmount: { flex: 1.5, alignItems: 'flex-end' },
    royaltyAmountText: { fontSize: 14, fontWeight: '600', color: palette.primary },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noData: { textAlign: 'center', color: palette.subtext, marginTop: 40 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.ivory} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Creator Analytics</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <KISIcon name="play-outline" size={20} color={palette.primary} />
            </View>
            <Text style={styles.statValue}>{formatCount(data?.total_plays ?? 0)}</Text>
            <Text style={styles.statLabel}>Total Plays</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <KISIcon name="download-outline" size={20} color={palette.primary} />
            </View>
            <Text style={styles.statValue}>{formatCount(data?.total_downloads ?? 0)}</Text>
            <Text style={styles.statLabel}>Downloads</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <KISIcon name="cash-outline" size={20} color={palette.gold} />
            </View>
            <Text style={[styles.statValue, { color: palette.gold }]}>
              {formatCurrency(data?.total_revenue ?? 0, data?.currency)}
            </Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>

        {/* Monthly Trend Chart */}
        {trends.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Monthly Plays (Last 6 Months)</Text>
            <View style={styles.chartCard}>
              <View style={styles.chartRow}>
                {trends.map((t, i) => {
                  const heightPct = maxPlays > 0 ? (t.plays / maxPlays) * 100 : 4;
                  return (
                    <View key={i} style={styles.barWrap}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(4, heightPct),
                            backgroundColor: palette.primary,
                            opacity: 0.7 + 0.3 * (i / Math.max(trends.length - 1, 1)),
                          },
                        ]}
                      />
                      <Text style={styles.barLabel} numberOfLines={1}>
                        {t.month?.substring(0, 3) ?? ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* Royalties Table */}
        <Text style={styles.sectionTitle}>Royalty Breakdown</Text>
        {royalties.length === 0 ? (
          <Text style={styles.noData}>No royalty data yet.</Text>
        ) : (
          <View style={styles.royaltyCard}>
            <View style={styles.royaltyHeader}>
              <Text style={[styles.royaltyHeaderText, { flex: 3 }]}>TRACK</Text>
              <Text style={[styles.royaltyHeaderText, { flex: 1, textAlign: 'center' }]}>PLAYS</Text>
              <Text style={[styles.royaltyHeaderText, { flex: 1.5, textAlign: 'right' }]}>ROYALTY</Text>
            </View>
            {royalties.map((row) => (
              <View key={row.id} style={styles.royaltyRow}>
                <View style={styles.royaltyTrack}>
                  <Text style={styles.royaltyTrackTitle} numberOfLines={1}>{row.track_title}</Text>
                  <Text style={styles.royaltyPeriod}>{row.period}</Text>
                </View>
                <View style={styles.royaltyPlays}>
                  <Text style={styles.royaltyPlaysText}>{formatCount(row.play_count)}</Text>
                </View>
                <View style={styles.royaltyAmount}>
                  <Text style={styles.royaltyAmountText}>
                    {formatCurrency(row.royalty_amount, row.currency ?? data?.currency)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
