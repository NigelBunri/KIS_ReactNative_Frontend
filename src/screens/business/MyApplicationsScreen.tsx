import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MyApplications'>;

type ApplicationStatus = 'submitted' | 'shortlisted' | 'offered' | 'rejected' | string;

type Application = {
  id: string;
  job_title?: string;
  listing_title?: string;
  company?: string;
  partner_name?: string;
  applied_at?: string;
  created_at?: string;
  status: ApplicationStatus;
  cover_letter?: string;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  submitted: { label: 'Submitted', bg: 'info', text: 'ivory' },
  shortlisted: { label: 'Shortlisted', bg: 'gold', text: 'royalInk' },
  offered: { label: 'Offered', bg: 'success', text: 'ivory' },
  rejected: { label: 'Rejected', bg: 'danger', text: 'ivory' },
};

export default function MyApplicationsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  const getBadgeColors = useCallback((status: ApplicationStatus) => {
    switch (status) {
      case 'submitted': return { bg: palette.info, text: palette.ivory };
      case 'shortlisted': return { bg: palette.gold, text: palette.royalInk };
      case 'offered': return { bg: palette.success, text: palette.ivory };
      case 'rejected': return { bg: palette.danger, text: palette.ivory };
      default: return { bg: palette.surface, text: palette.subtext };
    }
  }, [palette]);

  const fetchApplications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getRequest(ROUTES.business.myApplications);
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setApplications(Array.isArray(list) ? list : []);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchApplications(); }, [fetchApplications]));

  const renderItem = ({ item }: { item: Application }) => {
    const title = item.job_title ?? item.listing_title ?? 'Job Application';
    const company = item.company ?? item.partner_name;
    const dateStr = item.applied_at ?? item.created_at;
    const date = dateStr
      ? new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
    const badge = getBadgeColors(item.status);
    const statusLabel = STATUS_CONFIG[item.status]?.label ?? item.status;

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.jobTitle} numberOfLines={2}>{title}</Text>
            {company ? <Text style={styles.company}>{company}</Text> : null}
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{statusLabel}</Text>
          </View>
        </View>

        {date ? (
          <View style={styles.metaItem}>
            <KISIcon name="calendar-outline" size={13} color={palette.subtext} />
            <Text style={styles.dateText}>Applied {date}</Text>
          </View>
        ) : null}

        {item.cover_letter ? (
          <Text style={styles.snippet} numberOfLines={2}>{item.cover_letter}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.navTitle}>My Applications</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={applications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchApplications(true)} tintColor={palette.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <KISIcon name="document-text-outline" size={48} color={palette.subtext} />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>No applications yet</Text>
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                Browse the Jobs Board and apply to kingdom-aligned roles.
              </Text>
              <Pressable
                style={[styles.browseBtn, { backgroundColor: palette.primary }]}
                onPress={() => navigation.navigate('JobsBoard')}
              >
                <Text style={[styles.browseBtnText, { color: palette.ivory }]}>Browse Jobs</Text>
              </Pressable>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
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
    list: { paddingHorizontal: sp, paddingBottom: 80, paddingTop: 12 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      padding: 16,
      marginBottom: 12,
    },
    cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
    jobTitle: { fontSize: 15, fontWeight: '700', color: palette.text, marginBottom: 2 },
    company: { fontSize: 13, color: palette.subtext },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, minHeight: 26, justifyContent: 'center' },
    badgeText: { fontSize: 12, fontWeight: '700' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
    dateText: { fontSize: 13, color: palette.subtext },
    snippet: { fontSize: 13, color: palette.subtext, lineHeight: 18, marginTop: 4 },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: sp, gap: 10 },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    browseBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, minHeight: 44 },
    browseBtnText: { fontSize: 15, fontWeight: '700' },
  });
}
