import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Crowdfunding'>;

const CATEGORIES = ['All', 'Business', 'Ministry', 'Education', 'Community', 'Health', 'Technology'];

type Campaign = {
  id: string;
  title: string;
  creator_name?: string;
  description?: string;
  target_amount: number;
  raised_amount?: number;
  currency?: string;
  deadline?: string;
  status?: string;
  category?: string;
};

const getStatusBadge = (palette: any, status?: string) => {
  switch (status) {
    case 'active': return { bg: palette.success, text: palette.ivory, label: 'Active' };
    case 'funded': return { bg: palette.gold, text: palette.royalInk, label: 'Funded' };
    case 'closed': return { bg: palette.subtext, text: palette.ivory, label: 'Closed' };
    case 'draft': return { bg: palette.surface, text: palette.subtext, label: 'Draft' };
    default: return { bg: palette.surface, text: palette.subtext, label: status ?? 'Unknown' };
  }
};

export default function CrowdfundScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  const fetchCampaigns = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'All') params.set('category', activeCategory.toLowerCase());
      const res = await getRequest(`${ROUTES.business.crowdfund}?${params.toString()}`);
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setCampaigns(Array.isArray(list) ? list : []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory]);

  useFocusEffect(useCallback(() => { fetchCampaigns(); }, [fetchCampaigns]));

  const renderCampaign = ({ item }: { item: Campaign }) => {
    const raised = item.raised_amount ?? 0;
    const target = item.target_amount ?? 1;
    const pct = Math.min(100, Math.round((raised / target) * 100));
    const cur = item.currency ?? 'USD';
    const statusBadge = getStatusBadge(palette, item.status);
    const deadline = item.deadline
      ? new Date(item.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            {item.creator_name ? (
              <Text style={styles.creator}>by {item.creator_name}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
            <Text style={[styles.statusText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: palette.primary }]} />
        </View>

        <View style={styles.progressRow}>
          <Text style={[styles.raisedText, { color: palette.primaryStrong }]}>
            {cur} {raised.toLocaleString()} raised
          </Text>
          <Text style={styles.pctText}>{pct}%</Text>
        </View>
        <Text style={styles.targetText}>of {cur} {target.toLocaleString()} goal</Text>

        {deadline ? (
          <View style={styles.deadlineRow}>
            <KISIcon name="calendar-outline" size={13} color={palette.subtext} />
            <Text style={styles.deadlineText}>Ends {deadline}</Text>
          </View>
        ) : null}

        <KISButton
          title="Contribute"
          size="sm"
          style={{ marginTop: 12 }}
          onPress={() => navigation.navigate('CrowdfundDetail', { campaignId: item.id })}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.navTitle}>Crowdfunding</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={campaigns}
        keyExtractor={item => item.id}
        renderItem={renderCampaign}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCampaigns(true)} tintColor={palette.primary} />}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat;
              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.filterChip,
                    { backgroundColor: active ? palette.primary : palette.surface, borderColor: active ? palette.primary : palette.divider },
                  ]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.filterChipText, { color: active ? palette.ivory : palette.text }]}>{cat}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <KISIcon name="trending-up-outline" size={48} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No campaigns found</Text>
            </View>
          )
        }
      />

      <Pressable
        style={[styles.fab, { backgroundColor: palette.primary }]}
        onPress={() => navigation.navigate('CreateCampaign')}
      >
        <KISIcon name="add" size={28} color={palette.ivory} />
      </Pressable>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    backBtn: { width: 40, height: 44, justifyContent: 'center' },
    navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: palette.text },
    list: { paddingHorizontal: sp, paddingBottom: 100, paddingTop: 4 },
    filterRow: { gap: 8, paddingVertical: 12 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipText: { fontSize: 13, fontWeight: '600' },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 3 },
    creator: { fontSize: 13, color: palette.subtext },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusText: { fontSize: 12, fontWeight: '700' },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: palette.surface,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: { height: 8, borderRadius: 4 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    raisedText: { fontSize: 14, fontWeight: '700' },
    pctText: { fontSize: 14, fontWeight: '700', color: palette.primary },
    targetText: { fontSize: 13, color: palette.subtext, marginBottom: 6 },
    deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    deadlineText: { fontSize: 13, color: palette.subtext },
    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 15, fontWeight: '500' },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
  });
}
