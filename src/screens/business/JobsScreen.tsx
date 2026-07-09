import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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

type Props = NativeStackScreenProps<RootStackParamList, 'JobsBoard'>;

type JobType = 'all' | 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship';

const JOB_TYPE_FILTERS: { key: JobType; label: string }[] = [
  { key: 'all', label: 'All' },
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
  company?: string;
  partner_name?: string;
  location?: string;
  is_remote?: boolean;
  job_type?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  deadline?: string;
  kingdom_certified?: boolean;
  skills?: string[];
  description?: string;
};

export default function JobsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<JobType>('all');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (activeFilter !== 'all') params.set('job_type', activeFilter);
      if (remoteOnly) params.set('is_remote', 'true');
      const url = `${ROUTES.business.jobs}?${params.toString()}`;
      const res = await getRequest(url);
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setJobs(Array.isArray(list) ? list : []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeFilter, remoteOnly]);

  useFocusEffect(useCallback(() => { fetchJobs(); }, [fetchJobs]));

  const formatSalary = (job: Job): string | null => {
    if (!job.salary_min && !job.salary_max) return null;
    const cur = job.salary_currency ?? 'USD';
    const period = job.salary_period === 'hourly' ? '/hr' : '/yr';
    if (job.salary_min && job.salary_max) {
      return `${cur} ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}${period}`;
    }
    if (job.salary_min) return `${cur} ${job.salary_min.toLocaleString()}+${period}`;
    return `Up to ${cur} ${job.salary_max!.toLocaleString()}${period}`;
  };

  const renderJob = ({ item }: { item: Job }) => {
    const salary = formatSalary(item);
    const company = item.company ?? item.partner_name;
    const deadline = item.deadline
      ? new Date(item.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.jobTitle} numberOfLines={2}>{item.title}</Text>
            {company ? <Text style={styles.company}>{company}</Text> : null}
          </View>
          {item.kingdom_certified ? (
            <View style={[styles.certBadge, { borderColor: palette.gold }]}>
              <KISIcon name="ribbon-outline" size={12} color={palette.gold} />
              <Text style={[styles.certText, { color: palette.gold }]}>Certified</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          {item.location ? (
            <View style={styles.metaItem}>
              <KISIcon name="location-outline" size={13} color={palette.subtext} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          ) : null}
          {item.is_remote ? (
            <View style={[styles.chip, { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.chipText, { color: palette.primary }]}>Remote</Text>
            </View>
          ) : null}
          {item.job_type && JOB_TYPE_LABELS[item.job_type] ? (
            <View style={[styles.chip, { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.divider }]}>
              <Text style={[styles.chipText, { color: palette.subtext }]}>{JOB_TYPE_LABELS[item.job_type]}</Text>
            </View>
          ) : null}
        </View>

        {salary ? (
          <Text style={[styles.salary, { color: palette.primaryStrong }]}>{salary}</Text>
        ) : null}

        {deadline ? (
          <View style={styles.metaItem}>
            <KISIcon name="calendar-outline" size={13} color={palette.subtext} />
            <Text style={[styles.metaText, { color: palette.subtext }]}>Deadline: {deadline}</Text>
          </View>
        ) : null}

        <KISButton
          title="Apply"
          size="sm"
          style={{ marginTop: 12 }}
          onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
        />
      </View>
    );
  };

  const ListHeader = (
    <View>
      <View style={styles.searchRow}>
        <KISIcon name="search-outline" size={18} color={palette.subtext} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search title or skills..."
          placeholderTextColor={palette.subtext}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={() => fetchJobs()}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <KISIcon name="close-circle" size={18} color={palette.subtext} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {JOB_TYPE_FILTERS.map(f => {
          const active = activeFilter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[
                styles.filterChip,
                { backgroundColor: active ? palette.primary : palette.surface, borderColor: active ? palette.primary : palette.divider },
              ]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[styles.filterChipText, { color: active ? palette.ivory : palette.text }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.toggleRow}>
        <Text style={[styles.toggleLabel, { color: palette.text }]}>Remote only</Text>
        <Switch
          value={remoteOnly}
          onValueChange={setRemoteOnly}
          trackColor={{ true: palette.primary }}
          thumbColor={remoteOnly ? palette.gold : palette.subtext}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.navTitle}>Jobs Board</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={jobs}
        keyExtractor={item => item.id}
        renderItem={renderJob}
        contentContainerStyle={styles.list}
        ListHeaderComponent={ListHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchJobs(true)} tintColor={palette.primary} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <KISIcon name="briefcase-outline" size={42} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No jobs found</Text>
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
    list: { paddingHorizontal: sp, paddingBottom: 80 },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 4,
      gap: 8,
      marginTop: 12,
      marginBottom: 8,
    },
    searchInput: { flex: 1, fontSize: 15, color: palette.text },
    filterRow: { gap: 8, paddingVertical: 4, paddingBottom: 8 },
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.divider,
      marginBottom: 8,
    },
    toggleLabel: { fontSize: 14, fontWeight: '600' },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    jobTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 2 },
    company: { fontSize: 13, color: palette.subtext },
    certBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      marginLeft: 8,
    },
    certText: { fontSize: 11, fontWeight: '700' },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, color: palette.subtext },
    chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    chipText: { fontSize: 12, fontWeight: '600' },
    salary: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 15, fontWeight: '500' },
  });
}
