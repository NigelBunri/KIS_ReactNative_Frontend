import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EvangelismTracker'>;

type ImpactStats = {
  total_shares?: number;
  follow_ups?: number;
  salvations?: number;
};

type EvangelismCampaign = {
  id: string;
  title: string;
  target: number;
  current: number;
  metric?: string;
};

export default function EvangelismScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [impact, setImpact] = useState<ImpactStats | null>(null);
  const [campaigns, setCampaigns] = useState<EvangelismCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [shares, setShares] = useState('');
  const [followUps, setFollowUps] = useState('');
  const [salvations, setSalvations] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([
        getRequest(ROUTES.church.evangelismImpact),
        getRequest(ROUTES.church.evangelism),
      ])
        .then(([impactRes, campaignsRes]) => {
          if (impactRes?.success) setImpact(impactRes.data ?? {});
          if (campaignsRes?.success) {
            const raw = campaignsRes.data;
            setCampaigns(Array.isArray(raw) ? raw : raw?.results ?? []);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []),
  );

  const handleSubmitOutreach = useCallback(async () => {
    if (!date.trim()) {
      Alert.alert('Required', 'Please enter the outreach date.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.church.evangelism, {
        date: date.trim(),
        shares: parseInt(shares || '0', 10),
        follow_ups: parseInt(followUps || '0', 10),
        salvations: parseInt(salvations || '0', 10),
        notes: notes.trim() || undefined,
      });
      if (res?.success) {
        Alert.alert('Outreach Logged', 'Your evangelism record has been saved.');
        setShowForm(false);
        setDate('');
        setShares('');
        setFollowUps('');
        setSalvations('');
        setNotes('');
        setImpact(prev => prev ? {
          total_shares: (prev.total_shares ?? 0) + parseInt(shares || '0', 10),
          follow_ups: (prev.follow_ups ?? 0) + parseInt(followUps || '0', 10),
          salvations: (prev.salvations ?? 0) + parseInt(salvations || '0', 10),
        } : prev);
      } else {
        Alert.alert('Error', res?.message ?? 'Could not save outreach log.');
      }
    } catch {
      Alert.alert('Error', 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }, [date, shares, followUps, salvations, notes]);

  const progressPercent = (c: EvangelismCampaign) => {
    if (!c.target) return 0;
    return Math.min(100, Math.round((c.current / c.target) * 100));
  };

  const STAT_ITEMS = [
    { label: 'Total Shares', value: impact?.total_shares ?? 0, icon: 'share-social-outline' },
    { label: 'Follow-ups', value: impact?.follow_ups ?? 0, icon: 'people-outline' },
    { label: 'Salvations', value: impact?.salvations ?? 0, icon: 'heart-outline' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.screenTitle}>Evangelism & Outreach</Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={palette.primary} />
            </View>
          ) : (
            <>
              <View style={styles.statsRow}>
                {STAT_ITEMS.map(stat => (
                  <View key={stat.label} style={styles.statCard}>
                    <KISIcon name={stat.icon as any} size={22} tone="primary" />
                    <Text style={styles.statValue}>{stat.value.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {campaigns.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Active Campaigns</Text>
                  {campaigns.map(c => (
                    <View key={c.id} style={styles.campaignCard}>
                      <Text style={styles.campaignTitle}>{c.title}</Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progressPercent(c)}%` as any }]} />
                      </View>
                      <View style={styles.progressLabels}>
                        <Text style={styles.progressCurrent}>
                          {c.current.toLocaleString()} {c.metric ?? 'reached'}
                        </Text>
                        <Text style={styles.progressTarget}>
                          {progressPercent(c)}% of {c.target.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <KISButton
                title={showForm ? 'Hide Form' : 'Log Outreach'}
                variant={showForm ? 'ghost' : 'primary'}
                onPress={() => setShowForm(v => !v)}
                style={styles.logBtn}
                left={showForm ? undefined : <KISIcon name="add" size={18} color={palette.ivory} />}
              />

              {showForm && (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>Log Outreach Activity</Text>

                  <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={date}
                    onChangeText={setDate}
                    placeholder="e.g. 2026-06-20"
                    placeholderTextColor={palette.subtext}
                    keyboardType="numbers-and-punctuation"
                  />

                  <View style={styles.numbersRow}>
                    <View style={styles.numberField}>
                      <Text style={styles.fieldLabel}>Shares</Text>
                      <TextInput
                        style={styles.input}
                        value={shares}
                        onChangeText={setShares}
                        placeholder="0"
                        placeholderTextColor={palette.subtext}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.numberField}>
                      <Text style={styles.fieldLabel}>Follow-ups</Text>
                      <TextInput
                        style={styles.input}
                        value={followUps}
                        onChangeText={setFollowUps}
                        placeholder="0"
                        placeholderTextColor={palette.subtext}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.numberField}>
                      <Text style={styles.fieldLabel}>Salvations</Text>
                      <TextInput
                        style={styles.input}
                        value={salvations}
                        onChangeText={setSalvations}
                        placeholder="0"
                        placeholderTextColor={palette.subtext}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>Notes (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any observations or highlights from this outreach..."
                    placeholderTextColor={palette.subtext}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  <KISButton
                    title={submitting ? 'Saving...' : 'Save Outreach Log'}
                    loading={submitting}
                    disabled={submitting}
                    onPress={handleSubmitOutreach}
                    style={styles.submitBtn}
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    scroll: { padding: sp, paddingBottom: 80 },
    screenTitle: { fontSize: 26, fontWeight: '700', color: palette.text, marginBottom: 20 },
    center: { alignItems: 'center', paddingVertical: 40 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      minHeight: 100,
      justifyContent: 'center',
    },
    statValue: { fontSize: 26, fontWeight: '800', color: palette.primary, marginTop: 6 },
    statLabel: { fontSize: 11, color: palette.subtext, marginTop: 4, textAlign: 'center' },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 17, fontWeight: '600', color: palette.text, marginBottom: 12 },
    campaignCard: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    campaignTitle: { fontSize: 15, fontWeight: '600', color: palette.text, marginBottom: 10 },
    progressTrack: { height: 8, backgroundColor: palette.primarySoft, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
    progressFill: { height: 8, backgroundColor: palette.primary, borderRadius: 4 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    progressCurrent: { fontSize: 12, fontWeight: '600', color: palette.primary },
    progressTarget: { fontSize: 12, color: palette.subtext },
    logBtn: { minHeight: 50, marginBottom: 16 },
    formCard: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    formTitle: { fontSize: 17, fontWeight: '600', color: palette.text, marginBottom: 16 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: palette.subtext, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      backgroundColor: palette.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.divider,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: palette.text,
      minHeight: 44,
      marginBottom: 14,
    },
    numbersRow: { flexDirection: 'row', gap: 8 },
    numberField: { flex: 1 },
    textArea: { minHeight: 90 },
    submitBtn: { minHeight: 48 },
  });
}
