import React, { useCallback, useMemo, useState } from 'react';
import {
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
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
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

type Props = NativeStackScreenProps<RootStackParamList, 'FastingTracker'>;

type FastingRecord = {
  id: string;
  type: string;
  goal?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  days_remaining?: number;
};

type CommunityFast = {
  id: string;
  title: string;
  type: string;
  start_date: string;
  end_date: string;
  participant_count?: number;
};

const FASTING_TYPES = [
  { value: 'full', label: 'Full Fast' },
  { value: 'partial', label: 'Partial Fast' },
  { value: 'daniel', label: 'Daniel Fast' },
  { value: 'media', label: 'Media Fast' },
  { value: 'intermittent', label: 'Intermittent Fast' },
];

export default function FastingTrackerScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [activeFast, setActiveFast] = useState<FastingRecord | null>(null);
  const [communityFasts, setCommunityFasts] = useState<CommunityFast[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [fastType, setFastType] = useState('full');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      getRequest(ROUTES.church.fasting)
        .then(res => {
          if (res?.success) {
            const raw = res.data;
            const records: FastingRecord[] = Array.isArray(raw) ? raw : raw?.results ?? [];
            const active = records.find(r => r.is_active) ?? null;
            setActiveFast(active);
          }
        })
        .catch(() => {});

      getRequest(`${ROUTES.church.fasting}?is_community=true`)
        .then(res => {
          if (res?.success) {
            const raw = res.data;
            setCommunityFasts(Array.isArray(raw) ? raw : raw?.results ?? []);
          }
        })
        .catch(() => {});
    }, []),
  );

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const handleStartFast = useCallback(async () => {
    if (!startDate || !endDate) {
      Alert.alert('Required', 'Please enter start and end dates (YYYY-MM-DD).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.church.fasting, {
        type: fastType,
        start_date: startDate,
        end_date: endDate,
        goal: goal || undefined,
      });
      if (res?.success) {
        setActiveFast(res.data);
        setShowForm(false);
        setStartDate('');
        setEndDate('');
        setGoal('');
        Alert.alert('Fast Started', 'Your fast has been recorded. May God bless your commitment.');
      } else {
        Alert.alert('Error', res?.message ?? 'Could not start fast.');
      }
    } catch {
      Alert.alert('Error', 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }, [fastType, startDate, endDate, goal]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Fasting Tracker</Text>

          {activeFast ? (
            <View style={styles.activeFastCard}>
              <View style={styles.activeFastHeader}>
                <KISIcon name="heart-outline" size={24} tone="primary" />
                <Text style={styles.activeFastLabel}>Active Fast</Text>
              </View>
              <Text style={styles.fastType}>{FASTING_TYPES.find(t => t.value === activeFast.type)?.label ?? activeFast.type}</Text>
              <View style={styles.fastDates}>
                <Text style={styles.fastDate}>{formatDate(activeFast.start_date)}</Text>
                <KISIcon name="arrow-right" size={16} tone="muted" />
                <Text style={styles.fastDate}>{formatDate(activeFast.end_date)}</Text>
              </View>
              {activeFast.days_remaining != null && (
                <View style={styles.countdownRow}>
                  <Text style={styles.daysRemaining}>{activeFast.days_remaining}</Text>
                  <Text style={styles.daysLabel}>days remaining</Text>
                </View>
              )}
              {activeFast.goal ? (
                <View style={styles.goalRow}>
                  <Text style={styles.goalLabel}>Goal:</Text>
                  <Text style={styles.goalText}>{activeFast.goal}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.noFastCard}>
              <Text style={styles.noFastText}>No active fast at this time.</Text>
              <KISButton
                title="Start a Fast"
                variant="primary"
                style={styles.startBtn}
                onPress={() => setShowForm(v => !v)}
              />
            </View>
          )}

          {showForm && !activeFast && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Start a New Fast</Text>

              <Text style={styles.fieldLabel}>Fasting Type</Text>
              <View style={styles.typeChips}>
                {FASTING_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeChip, fastType === t.value && styles.typeChipActive]}
                    onPress={() => setFastType(t.value)}
                    hitSlop={{ top: 4, bottom: 4 }}
                  >
                    <Text style={[styles.typeChipText, fastType === t.value && styles.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="e.g. 2026-06-20"
                placeholderTextColor={palette.subtext}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="e.g. 2026-06-27"
                placeholderTextColor={palette.subtext}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.fieldLabel}>Goal / Intention (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={goal}
                onChangeText={setGoal}
                placeholder="What are you seeking God for?"
                placeholderTextColor={palette.subtext}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <KISButton
                title={submitting ? 'Starting...' : 'Begin Fast'}
                loading={submitting}
                disabled={submitting}
                onPress={handleStartFast}
                style={styles.submitBtn}
              />
            </View>
          )}

          {communityFasts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Community Fasting Events</Text>
              {communityFasts.map(cf => (
                <View key={cf.id} style={styles.communityCard}>
                  <View style={styles.communityHeader}>
                    <Text style={styles.communityTitle}>{cf.title}</Text>
                    {cf.participant_count != null && (
                      <View style={styles.participantBadge}>
                        <KISIcon name="people-outline" size={12} tone="primary" />
                        <Text style={styles.participantCount}>{cf.participant_count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.communityType}>{FASTING_TYPES.find(t => t.value === cf.type)?.label ?? cf.type}</Text>
                  <Text style={styles.communityDates}>
                    {formatDate(cf.start_date)} — {formatDate(cf.end_date)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    scroll: { padding: sp, paddingBottom: 80 },
    title: { fontSize: 26, fontWeight: '700', color: palette.text, marginBottom: 20 },
    activeFastCard: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: palette.primary,
      marginBottom: 20,
    },
    activeFastHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    activeFastLabel: { fontSize: 12, fontWeight: '700', color: palette.primary, textTransform: 'uppercase', letterSpacing: 1 },
    fastType: { fontSize: 20, fontWeight: '700', color: palette.text, marginBottom: 8 },
    fastDates: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    fastDate: { fontSize: 14, color: palette.subtext },
    countdownRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 },
    daysRemaining: { fontSize: 38, fontWeight: '800', color: palette.primary },
    daysLabel: { fontSize: 16, color: palette.subtext },
    goalRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
    goalLabel: { fontSize: 13, fontWeight: '600', color: palette.subtext },
    goalText: { fontSize: 13, color: palette.text, flex: 1 },
    noFastCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 20,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 20,
    },
    noFastText: { fontSize: 15, color: palette.subtext, marginBottom: 16 },
    startBtn: { minWidth: 160, minHeight: 44 },
    formCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 20,
    },
    formTitle: { fontSize: 17, fontWeight: '600', color: palette.text, marginBottom: 14 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: palette.subtext, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    typeChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 36,
      justifyContent: 'center',
    },
    typeChipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
    typeChipText: { fontSize: 13, color: palette.subtext },
    typeChipTextActive: { color: palette.ivory, fontWeight: '600' },
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
    textArea: { minHeight: 80 },
    submitBtn: { marginTop: 4, minHeight: 48 },
    section: { marginTop: 8 },
    sectionTitle: { fontSize: 17, fontWeight: '600', color: palette.text, marginBottom: 12 },
    communityCard: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    communityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    communityTitle: { fontSize: 15, fontWeight: '600', color: palette.text, flex: 1, marginRight: 8 },
    participantBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.primarySoft,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    participantCount: { fontSize: 12, fontWeight: '600', color: palette.primary },
    communityType: { fontSize: 13, color: palette.subtext, marginBottom: 4 },
    communityDates: { fontSize: 12, color: palette.subtext },
  });
}
