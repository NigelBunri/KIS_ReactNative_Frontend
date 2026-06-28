import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChurchGiving'>;

type GivingStats = {
  total_given_year?: number;
  pledges_active?: number;
  campaigns_count?: number;
};

type Campaign = {
  id: string;
  title: string;
  description?: string;
  target_amount: number;
  raised_amount: number;
  currency?: string;
};

export default function GivingDashboardScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [stats, setStats] = useState<GivingStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError(null);
      Promise.all([
        getRequest(ROUTES.church.givingStats),
        getRequest(ROUTES.church.campaigns),
      ])
        .then(([statsRes, campaignsRes]) => {
          if (statsRes?.success) setStats(statsRes.data ?? {});
          if (campaignsRes?.success) {
            const raw = campaignsRes.data;
            setCampaigns(Array.isArray(raw) ? raw : raw?.results ?? []);
          }
        })
        .catch(() => setError('Failed to load giving data.'))
        .finally(() => setLoading(false));
    }, []),
  );

  const formatCurrency = (val?: number) =>
    val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$0.00';

  const progressPercent = (campaign: Campaign) => {
    if (!campaign.target_amount) return 0;
    return Math.min(100, Math.round((campaign.raised_amount / campaign.target_amount) * 100));
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.errorText}>{error}</Text>
        <KISButton title="Retry" onPress={() => setLoading(true)} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <KISIcon name="wallet-outline" size={32} color={palette.ivory} />
          <Text style={styles.headerTitle}>Giving & Stewardship</Text>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats?.total_given_year)}</Text>
            <Text style={styles.statLabel}>Given This Year</Text>
          </View>
          <View style={[styles.statCard, styles.statBorder]}>
            <Text style={styles.statValue}>{stats?.pledges_active ?? 0}</Text>
            <Text style={styles.statLabel}>Active Pledges</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.campaigns_count ?? 0}</Text>
            <Text style={styles.statLabel}>Campaigns</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Campaigns</Text>
          {campaigns.length === 0 && (
            <Text style={styles.emptyText}>No active campaigns at this time.</Text>
          )}
          {campaigns.map(c => (
            <View key={c.id} style={styles.campaignCard}>
              <Text style={styles.campaignTitle}>{c.title}</Text>
              {c.description ? (
                <Text style={styles.campaignDesc}>{c.description}</Text>
              ) : null}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent(c)}%` as any }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressRaised}>{formatCurrency(c.raised_amount)} raised</Text>
                <Text style={styles.progressTarget}>
                  {progressPercent(c)}% of {formatCurrency(c.target_amount)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.ctaRow}>
          <KISButton
            title="Give Now"
            variant="primary"
            style={styles.ctaBtn}
            onPress={() => navigation.navigate('GiveNow')}
          />
          <KISButton
            title="My Statement"
            variant="outline"
            style={styles.ctaBtn}
            onPress={() => navigation.navigate('TitheStatement')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: 80 },
    header: {
      paddingTop: 28,
      paddingBottom: 24,
      paddingHorizontal: sp,
      alignItems: 'center',
    },
    headerTitle: {
      marginTop: 8,
      fontSize: 22,
      fontWeight: '700',
      color: palette.ivory,
    },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      marginHorizontal: sp,
      marginTop: 16,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
    },
    statBorder: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.primary,
    },
    statLabel: {
      fontSize: 11,
      color: palette.subtext,
      marginTop: 4,
      textAlign: 'center',
    },
    section: { paddingHorizontal: sp, marginTop: 20 },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 12,
    },
    emptyText: { fontSize: 14, color: palette.subtext, textAlign: 'center', paddingVertical: 24 },
    campaignCard: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    campaignTitle: { fontSize: 15, fontWeight: '600', color: palette.text, marginBottom: 4 },
    campaignDesc: { fontSize: 13, color: palette.subtext, marginBottom: 10 },
    progressTrack: {
      height: 8,
      backgroundColor: palette.primarySoft,
      borderRadius: 4,
      overflow: 'hidden',
      marginVertical: 8,
    },
    progressFill: {
      height: 8,
      backgroundColor: palette.primary,
      borderRadius: 4,
    },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    progressRaised: { fontSize: 12, color: palette.primary, fontWeight: '600' },
    progressTarget: { fontSize: 12, color: palette.subtext },
    ctaRow: {
      flexDirection: 'row',
      paddingHorizontal: sp,
      marginTop: 20,
      gap: 12,
    },
    ctaBtn: { flex: 1 },
    errorText: { fontSize: 15, color: palette.danger, textAlign: 'center' },
  });
}
