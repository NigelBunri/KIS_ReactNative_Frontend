import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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

type JobType = 'all' | 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship';

const JOB_TYPE_FILTERS: { key: JobType; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'full_time', label: 'Full Time' },
  { key: 'part_time', label: 'Part Time' },
  { key: 'contract', label: 'Contract' },
  { key: 'freelance', label: 'Freelance' },
  { key: 'internship', label: 'Internship' },
];

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  freelance: 'Freelance',
  internship: 'Internship',
};

type Job = {
  id: string;
  title: string;
  partner_name?: string;
  partner_id?: string;
  location?: string;
  is_remote?: boolean;
  job_type?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  description?: string;
};

export default function JobsBoardScreen() {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<JobType>('all');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (activeFilter !== 'all') params.set('job_type', activeFilter);
      if (remoteOnly) params.set('is_remote', 'true');
      const url = `${ROUTES.jobs.board}?${params.toString()}`;
      const res = await getRequest(url, { errorMessage: 'Unable to load jobs.' });
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setJobs(Array.isArray(list) ? list : []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeFilter, remoteOnly]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleApply = useCallback((job: Job) => {
    Alert.alert(
      job.title,
      'Would you like to apply for this position?',
      [
        {
          text: 'Apply Now',
          onPress: async () => {
            try {
              if (job.partner_id) {
                await postRequest(
                  `${ROUTES.partners.apply(job.partner_id)}`,
                  { job_post: job.id },
                );
                Alert.alert('Application submitted', 'Your application has been sent successfully.');
              } else {
                await postRequest(ROUTES.business.jobApplications, { job: job.id });
                Alert.alert('Application submitted', 'Your application has been sent successfully.');
              }
            } catch (e: any) {
              Alert.alert('Application failed', e?.message ?? 'Please try again.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, []);

  const renderSalary = (job: Job) => {
    if (!job.salary_min && !job.salary_max) return null;
    const currency = job.salary_currency ?? 'USD';
    const period = job.salary_period === 'hourly' ? '/hr' : '/yr';
    const min = job.salary_min ? job.salary_min.toLocaleString() : '';
    const max = job.salary_max ? job.salary_max.toLocaleString() : '';
    let range = '';
    if (min && max) range = `${currency} ${min} – ${max}${period}`;
    else if (min) range = `${currency} ${min}+${period}`;
    else range = `Up to ${currency} ${max}${period}`;
    return range;
  };

  const renderJob = ({ item }: { item: Job }) => {
    const snippet = item.description ? item.description.slice(0, 120) : '';
    const salaryLabel = renderSalary(item);
    return (
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.jobTitle, { color: palette.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.partner_name ? (
          <Text style={[styles.partnerName, { color: palette.subtext }]}>{item.partner_name}</Text>
        ) : null}
        <View style={styles.metaRow}>
          {item.location ? (
            <Text style={[styles.metaText, { color: palette.subtext }]}>{item.location}</Text>
          ) : null}
          {item.is_remote ? (
            <View style={[styles.badge, { backgroundColor: palette.primary }]}>
              <Text style={[styles.badgeText, { color: palette.onPrimary }]}>Remote</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          {item.job_type && JOB_TYPE_LABELS[item.job_type] ? (
            <View style={[styles.typeBadge, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.typeBadgeText, { color: palette.primary }]}>
                {JOB_TYPE_LABELS[item.job_type]}
              </Text>
            </View>
          ) : null}
          {salaryLabel ? (
            <Text style={[styles.salary, { color: palette.primaryStrong }]}>{salaryLabel}</Text>
          ) : null}
        </View>
        {snippet ? (
          <Text style={[styles.snippet, { color: palette.subtext }]} numberOfLines={3}>
            {snippet}
          </Text>
        ) : null}
        <Pressable
          style={[styles.applyBtn, { backgroundColor: palette.primary }]}
          onPress={() => handleApply(item)}
        >
          <Text style={[styles.applyBtnText, { color: palette.onPrimary }]}>Apply</Text>
        </Pressable>
      </View>
    );
  };

  const s = StyleSheet.create({
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      marginRight: 8,
      borderWidth: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, marginTop: 25 }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Jobs Board</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.searchRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <KISIcon name="search" size={18} color={palette.subtext} />
        <TextInput
          style={[styles.searchInput, { color: palette.text }]}
          placeholder="Search jobs..."
          placeholderTextColor={palette.subtext}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        contentContainerStyle={{ paddingHorizontal: responsive.pageGutter, paddingBottom: 32, width: '100%', maxWidth: responsive.contentMaxWidth, alignSelf: 'center' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchJobs(true)} />
        }
        ListHeaderComponent={
          <View>
            <FlatList
              horizontal
              data={JOB_TYPE_FILTERS}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: 12 }}
              renderItem={({ item }) => {
                const active = activeFilter === item.key;
                return (
                  <Pressable
                    style={[
                      s.filterChip,
                      {
                        backgroundColor: active ? palette.primary : palette.surface,
                        borderColor: active ? palette.primary : palette.border,
                      },
                    ]}
                    onPress={() => setActiveFilter(item.key)}
                  >
                    <Text style={{ color: active ? palette.onPrimary : palette.text, fontSize: 13, fontWeight: '600' }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
            <View style={[styles.toggleRow, { borderColor: palette.border }]}>
              <Text style={[styles.toggleLabel, { color: palette.text }]}>Remote only</Text>
              <Switch
                value={remoteOnly}
                onValueChange={setRemoteOnly}
                trackColor={{ true: palette.primary }}
                thumbColor={remoteOnly ? palette.primaryStrong : palette.subtext}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <KISIcon name="search" size={40} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No jobs found</Text>
              <Text style={[styles.emptyText, { color: palette.subtext, fontSize: 13, fontWeight: '400' }]}>
                Check back soon or adjust your filters
              </Text>
            </View>
          )
        }
      />
      </KeyboardAvoidingView>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 13,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  salary: {
    fontSize: 13,
    fontWeight: '600',
  },
  snippet: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 12,
  },
  applyBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
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
