import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

type Application = {
  id: string;
  job_title?: string;
  partner_name?: string;
  status: ApplicationStatus;
  created_at?: string;
  cancel_url?: string;
};

const getStatusConfig = (palette: ReturnType<typeof useKISTheme>['palette']): Record<ApplicationStatus, { label: string; bg: string; text: string }> => ({
  PENDING: { label: 'Pending', bg: palette.goldHighlight, text: palette.gold },
  APPROVED: { label: 'Approved', bg: palette.successSoft, text: palette.success },
  REJECTED: { label: 'Rejected', bg: palette.dangerSoft, text: palette.danger },
  WITHDRAWN: { label: 'Withdrawn', bg: palette.surface, text: palette.subtext },
});

export default function MyApplicationsScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<Nav>();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const fetchApplications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getRequest(ROUTES.jobs.myApplications, {
        errorMessage: 'Unable to load applications.',
      });
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setApplications(Array.isArray(list) ? list : []);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleWithdraw = useCallback((application: Application) => {
    Alert.alert(
      'Withdraw application',
      `Withdraw your application for "${application.job_title ?? 'this position'}"?`,
      [
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setWithdrawingId(application.id);
            try {
              const url = application.cancel_url ?? ROUTES.jobs.withdrawApplication(application.id);
              await postRequest(url, {});
              setApplications(prev =>
                prev.map(a => a.id === application.id ? { ...a, status: 'WITHDRAWN' as ApplicationStatus } : a),
              );
            } catch (e: any) {
              Alert.alert('Failed', e?.message ?? 'Could not withdraw application.');
            } finally {
              setWithdrawingId(null);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const renderItem = ({ item }: { item: Application }) => {
    const STATUS_CONFIG = getStatusConfig(palette);
    const statusConf = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
    return (
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.jobTitle, { color: palette.text }]} numberOfLines={2}>
              {item.job_title ?? 'General application'}
            </Text>
            {item.partner_name ? (
              <Text style={[styles.partnerName, { color: palette.subtext }]}>{item.partner_name}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
            <Text style={[styles.statusText, { color: statusConf.text }]}>{statusConf.label}</Text>
          </View>
        </View>
        {item.created_at ? (
          <Text style={[styles.dateText, { color: palette.subtext }]}>
            Applied {formatDate(item.created_at)}
          </Text>
        ) : null}
        {item.status === 'PENDING' ? (
          <Pressable
            style={[styles.withdrawBtn, { borderColor: palette.border }]}
            onPress={() => handleWithdraw(item)}
            disabled={withdrawingId === item.id}
          >
            {withdrawingId === item.id ? (
              <ActivityIndicator size="small" color={palette.subtext} />
            ) : (
              <Text style={[styles.withdrawText, { color: palette.subtext }]}>Withdraw</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>My Applications</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: responsive.pageGutter, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchApplications(true)} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <KISIcon name="list" size={40} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No applications yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  partnerName: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  withdrawBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  withdrawText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
