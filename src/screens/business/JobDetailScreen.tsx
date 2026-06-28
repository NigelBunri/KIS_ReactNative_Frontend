import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'JobDetail'>;

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
  requirements?: string;
};

export default function JobDetailScreen({ navigation, route }: Props) {
  const { jobId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getRequest(ROUTES.business.job(jobId))
        .then(res => {
          const data = res?.data ?? res;
          if (data?.id) setJob(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [jobId]),
  );

  const handleApply = async () => {
    if (!coverLetter.trim()) {
      Alert.alert('Cover letter required', 'Please write a brief cover letter before applying.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.business.jobApplications, {
        listing: jobId,
        cover_letter: coverLetter.trim(),
        resume_url: resumeUrl.trim() || undefined,
      });
      if (res?.success || res?.id || res?.data?.id) {
        Alert.alert('Application submitted!', 'Your application has been sent successfully.', [
          { text: 'View Applications', onPress: () => navigation.navigate('MyApplications') },
          { text: 'OK', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Submission failed', res?.error ?? 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSalary = (): string | null => {
    if (!job) return null;
    if (!job.salary_min && !job.salary_max) return null;
    const cur = job.salary_currency ?? 'USD';
    const period = job.salary_period === 'hourly' ? '/hr' : '/yr';
    if (job.salary_min && job.salary_max) {
      return `${cur} ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}${period}`;
    }
    if (job.salary_min) return `${cur} ${job.salary_min.toLocaleString()}+${period}`;
    return `Up to ${cur} ${job.salary_max!.toLocaleString()}${period}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator color={palette.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <View style={styles.empty}>
          <KISIcon name="briefcase-outline" size={48} color={palette.subtext} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>Job not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const salary = formatSalary();
  const company = job.company ?? job.partner_name;
  const deadline = job.deadline
    ? new Date(job.deadline).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>Job Detail</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.section}>
            <View style={styles.titleRow}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              {job.kingdom_certified ? (
                <View style={[styles.certBadge, { borderColor: palette.gold }]}>
                  <KISIcon name="ribbon-outline" size={12} color={palette.gold} />
                  <Text style={[styles.certText, { color: palette.gold }]}>Certified</Text>
                </View>
              ) : null}
            </View>

            {company ? <Text style={styles.company}>{company}</Text> : null}

            <View style={styles.metaGrid}>
              {job.location ? (
                <View style={styles.metaItem}>
                  <KISIcon name="location-outline" size={15} color={palette.subtext} />
                  <Text style={styles.metaText}>{job.location}</Text>
                </View>
              ) : null}
              {job.is_remote ? (
                <View style={styles.metaItem}>
                  <KISIcon name="wifi-outline" size={15} color={palette.subtext} />
                  <Text style={styles.metaText}>Remote</Text>
                </View>
              ) : null}
              {salary ? (
                <View style={styles.metaItem}>
                  <KISIcon name="cash-outline" size={15} color={palette.subtext} />
                  <Text style={[styles.metaText, { color: palette.primaryStrong, fontWeight: '600' }]}>{salary}</Text>
                </View>
              ) : null}
              {deadline ? (
                <View style={styles.metaItem}>
                  <KISIcon name="calendar-outline" size={15} color={palette.subtext} />
                  <Text style={styles.metaText}>Deadline: {deadline}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {job.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this role</Text>
              <Text style={styles.body}>{job.description}</Text>
            </View>
          ) : null}

          {job.requirements ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Requirements</Text>
              <Text style={styles.body}>{job.requirements}</Text>
            </View>
          ) : null}

          {job.skills && job.skills.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Required Skills</Text>
              <View style={styles.skillsRow}>
                {job.skills.map(skill => (
                  <View key={skill} style={[styles.skillChip, { backgroundColor: palette.primarySoft }]}>
                    <Text style={[styles.skillText, { color: palette.primary }]}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={[styles.section, styles.applySection]}>
            <Text style={styles.sectionTitle}>Apply for this Position</Text>

            <Text style={styles.label}>Cover Letter *</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
              placeholder="Tell us why you're a great fit..."
              placeholderTextColor={palette.subtext}
              value={coverLetter}
              onChangeText={setCoverLetter}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <Text style={[styles.label, { marginTop: 14 }]}>Resume / Portfolio URL (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.divider, color: palette.text }]}
              placeholder="https://..."
              placeholderTextColor={palette.subtext}
              value={resumeUrl}
              onChangeText={setResumeUrl}
              keyboardType="url"
              autoCapitalize="none"
            />

            <KISButton
              title="Submit Application"
              loading={submitting}
              onPress={handleApply}
              style={{ marginTop: 16 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    scroll: { paddingBottom: 80 },
    section: {
      paddingHorizontal: sp,
      paddingTop: 20,
      paddingBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    applySection: {
      borderBottomWidth: 0,
      paddingBottom: 20,
    },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
    jobTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: palette.text },
    certBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 2,
    },
    certText: { fontSize: 11, fontWeight: '700' },
    company: { fontSize: 15, color: palette.subtext, marginBottom: 12 },
    metaGrid: { gap: 8, marginBottom: 8 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 14, color: palette.subtext },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 10 },
    body: { fontSize: 15, lineHeight: 23, color: palette.text },
    skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    skillChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    skillText: { fontSize: 13, fontWeight: '600' },
    label: { fontSize: 14, fontWeight: '600', color: palette.text, marginBottom: 6 },
    textArea: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      fontSize: 15,
      minHeight: 120,
    },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      fontSize: 15,
      minHeight: 44,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 16, fontWeight: '500' },
  });
}
