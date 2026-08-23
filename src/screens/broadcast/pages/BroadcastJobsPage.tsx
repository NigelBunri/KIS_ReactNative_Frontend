import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type Job = {
  id: string;
  partner_id?: string;
  partner_name?: string;
  title: string;
  description?: string;
  location?: string;
  is_remote?: boolean;
  job_type?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
};

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  freelance: 'Freelance',
  internship: 'Internship',
};

type Props = {
  searchTerm?: string;
  searchContext?: string;
};

export default function BroadcastJobsPage({ searchTerm = '', searchContext = 'all' }: Props) {
  const { palette } = useKISTheme();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [applyTarget, setApplyTarget] = useState<Job | null>(null);
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [shareProfile, setShareProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (searchContext === 'remote') params.set('is_remote', 'true');
      else if (searchContext === 'full_time' || searchContext === 'part_time') params.set('job_type', searchContext);
      const url = `${ROUTES.partners.globalJobs}?${params.toString()}`;
      const res = await getRequest(url, { errorMessage: 'Unable to load jobs.' });
      const list = res?.data ?? res ?? [];
      setJobs(Array.isArray(list) ? list : []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchTerm, searchContext]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const openApply = useCallback((job: Job) => {
    setApplyTarget(job);
    setRole(job.title);
    setMessage('');
    setApplyError(null);
    setShareProfile(true);
  }, []);

  const submitApply = useCallback(async () => {
    if (!applyTarget?.partner_id) return;
    setSubmitting(true);
    setApplyError(null);
    try {
      await postRequest(ROUTES.partners.apply(applyTarget.partner_id), {
        method: 'application',
        job_post: applyTarget.id,
        message,
        answers: role ? { role } : {},
        profile_visible: shareProfile,
      });
      setAppliedIds(prev => new Set(prev).add(applyTarget.id));
      setApplyTarget(null);
    } catch (e: any) {
      setApplyError(e?.message ?? 'Unable to submit your application.');
    } finally {
      setSubmitting(false);
    }
  }, [applyTarget, message, role, shareProfile]);

  const renderSalary = (job: Job) => {
    if (!job.salary_min && !job.salary_max) return null;
    const currency = job.salary_currency ?? 'USD';
    const min = job.salary_min ? job.salary_min.toLocaleString() : '';
    const max = job.salary_max ? job.salary_max.toLocaleString() : '';
    if (min && max) return `${currency} ${min} – ${max}`;
    if (min) return `${currency} ${min}+`;
    return `Up to ${currency} ${max}`;
  };

  const renderJob = ({ item }: { item: Job }) => {
    const salaryLabel = renderSalary(item);
    const alreadyApplied = appliedIds.has(item.id);
    return (
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.jobTitle, { color: palette.text }]} numberOfLines={2}>{item.title}</Text>
        {item.partner_name ? (
          <Text style={[styles.partnerName, { color: palette.subtext }]}>{item.partner_name}</Text>
        ) : null}
        <View style={styles.metaRow}>
          {item.location ? <Text style={[styles.metaText, { color: palette.subtext }]}>{item.location}</Text> : null}
          {item.is_remote ? (
            <View style={[styles.badge, { backgroundColor: palette.primary }]}>
              <Text style={[styles.badgeText, { color: palette.onPrimary }]}>Remote</Text>
            </View>
          ) : null}
          {item.job_type && JOB_TYPE_LABELS[item.job_type] ? (
            <View style={[styles.typeBadge, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.typeBadgeText, { color: palette.primary }]}>{JOB_TYPE_LABELS[item.job_type]}</Text>
            </View>
          ) : null}
          {salaryLabel ? <Text style={[styles.salary, { color: palette.primaryStrong }]}>{salaryLabel}</Text> : null}
        </View>
        {item.description ? (
          <Text style={[styles.snippet, { color: palette.subtext }]} numberOfLines={3}>{item.description}</Text>
        ) : null}
        <Pressable
          style={[styles.applyBtn, { backgroundColor: alreadyApplied ? palette.surface : palette.primary }]}
          disabled={alreadyApplied}
          onPress={() => openApply(item)}
        >
          <Text style={[styles.applyBtnText, { color: alreadyApplied ? palette.subtext : palette.onPrimary }]}>
            {alreadyApplied ? 'Applied' : 'Apply'}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={jobs}
        keyExtractor={item => item.id}
        renderItem={renderJob}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchJobs(true)} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <KISIcon name="briefcase" size={40} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No jobs found</Text>
              <Text style={[styles.emptyText, { color: palette.subtext, fontSize: 13, fontWeight: '400' }]}>
                Check back soon or adjust your search
              </Text>
            </View>
          )
        }
      />

      <Modal visible={!!applyTarget} animationType="slide" transparent onRequestClose={() => setApplyTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={[styles.sheet, { backgroundColor: palette.surfaceElevated ?? palette.card }]}>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>
              Apply to {applyTarget?.title}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
              at {applyTarget?.partner_name}
            </Text>
            <TextInput
              value={role}
              onChangeText={setRole}
              placeholder="Desired role or department"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { color: palette.text, borderColor: palette.border }]}
            />
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Why are you a good fit? (optional)"
              placeholderTextColor={palette.subtext}
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textarea, { color: palette.text, borderColor: palette.border }]}
            />
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }}>Share my profile as your CV</Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>Headline, bio, experience, education, and skills</Text>
              </View>
              <Switch value={shareProfile} onValueChange={setShareProfile} trackColor={{ true: palette.primary }} />
            </View>
            {applyError ? <Text style={{ color: palette.danger ?? '#c0392b', fontSize: 12, marginTop: 4 }}>{applyError}</Text> : null}
            <View style={styles.sheetActions}>
              <Pressable style={[styles.sheetBtn, { borderColor: palette.border }]} onPress={() => setApplyTarget(null)}>
                <Text style={{ color: palette.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetBtn, { backgroundColor: palette.primary, borderColor: palette.primary }]}
                onPress={submitApply}
                disabled={submitting}
              >
                <Text style={{ color: palette.onPrimary, fontWeight: '700' }}>{submitting ? 'Submitting…' : 'Submit'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  jobTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  partnerName: { fontSize: 13, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  metaText: { fontSize: 13 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  salary: { fontSize: 13, fontWeight: '600' },
  snippet: { fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 12 },
  applyBtn: { borderRadius: 10, paddingVertical: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  applyBtnText: { fontSize: 14, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12, fontSize: 14 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetBtn: { flex: 1, borderWidth: 1, borderRadius: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
