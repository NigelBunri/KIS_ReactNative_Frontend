import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
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
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DiscipleshipJourney'>;

const STAGES = [
  { key: 'seeker', label: 'Seeker', icon: 'search-outline' },
  { key: 'salvation', label: 'Salvation', icon: 'heart-outline' },
  { key: 'baptism', label: 'Baptism', icon: 'water-outline' },
  { key: 'basic', label: 'Basic', icon: 'book-outline' },
  { key: 'intermediate', label: 'Intermediate', icon: 'star-outline' },
  { key: 'leadership', label: 'Leadership', icon: 'people-outline' },
  { key: 'mentor', label: 'Mentor', icon: 'trending-up-outline' },
];

type Milestone = { id: string; title: string; completed: boolean };

type DiscipleshipData = {
  current_stage: string;
  completed_stages: string[];
  milestones: Milestone[];
  mentor?: { id: string; name: string; contact?: string };
};

export default function DiscipleshipScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [data, setData] = useState<DiscipleshipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setFetchError(null);
      getRequest(ROUTES.church.discipleship)
        .then(res => {
          if (res?.success) setData(res.data ?? null);
          else setFetchError('Could not load discipleship data.');
        })
        .catch(() => setFetchError('Unable to load. Check your connection.'))
        .finally(() => setLoading(false));
    }, []),
  );

  const stageIndex = (key: string) => STAGES.findIndex(s => s.key === key);
  const currentIdx = data ? stageIndex(data.current_stage) : -1;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  if (fetchError) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <KISIcon name="wifi-off" size={48} color={palette.subtext} />
        <Text style={[styles.subtitle, { color: palette.danger, marginTop: 12 }]}>{fetchError}</Text>
        <KISButton title="Retry" style={{ marginTop: 16 }} onPress={() => {
          setLoading(true);
          setFetchError(null);
          getRequest(ROUTES.church.discipleship)
            .then(res => { if (res?.success) setData(res.data ?? null); else setFetchError('Could not load.'); })
            .catch(() => setFetchError('Unable to load. Check your connection.'))
            .finally(() => setLoading(false));
        }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.screenTitle}>Discipleship Journey</Text>
        <Text style={styles.subtitle}>Your spiritual growth pathway</Text>

        <View style={styles.stepperCard}>
          {STAGES.map((stage, idx) => {
            const isCompleted = data?.completed_stages?.includes(stage.key) || idx < currentIdx;
            const isCurrent = stage.key === data?.current_stage;
            const isFuture = idx > currentIdx;

            return (
              <View key={stage.key} style={styles.stepRow}>
                <View style={styles.stepConnector}>
                  <View style={[
                    styles.stepCircle,
                    isCompleted && styles.stepCircleCompleted,
                    isCurrent && styles.stepCircleCurrent,
                    isFuture && styles.stepCircleFuture,
                  ]}>
                    {isCompleted ? (
                      <KISIcon name="check" size={14} color={palette.ivory} />
                    ) : (
                      <Text style={[styles.stepNum, isCurrent && styles.stepNumCurrent, isFuture && styles.stepNumFuture]}>
                        {idx + 1}
                      </Text>
                    )}
                  </View>
                  {idx < STAGES.length - 1 && (
                    <View style={[styles.stepLine, isCompleted && styles.stepLineCompleted]} />
                  )}
                </View>

                <View style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent]}>
                  <Text style={[
                    styles.stageName,
                    isCurrent && styles.stageNameCurrent,
                    isFuture && styles.stageNameFuture,
                  ]}>
                    {stage.label}
                  </Text>
                  {isCurrent && <View style={styles.currentPill}><Text style={styles.currentPillText}>Current</Text></View>}
                </View>
              </View>
            );
          })}
        </View>

        {data?.milestones && data.milestones.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              Milestones — {STAGES[currentIdx]?.label ?? 'Current Stage'}
            </Text>
            {data.milestones.map(m => (
              <View key={m.id} style={styles.milestoneRow}>
                <View style={[styles.milestoneCheck, m.completed && styles.milestoneCheckDone]}>
                  {m.completed && <KISIcon name="check" size={12} color={palette.ivory} />}
                </View>
                <Text style={[styles.milestoneText, m.completed && styles.milestoneTextDone]}>
                  {m.title}
                </Text>
              </View>
            ))}
          </View>
        )}

        {data?.mentor && (
          <View style={styles.mentorCard}>
            <Text style={styles.sectionTitle}>Your Mentor</Text>
            <View style={styles.mentorRow}>
              <View style={styles.mentorAvatar}>
                <Text style={styles.mentorAvatarText}>{data.mentor.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.mentorInfo}>
                <Text style={styles.mentorName}>{data.mentor.name}</Text>
                {data.mentor.contact && (
                  <Text style={styles.mentorContact}>{data.mentor.contact}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.contactBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => Alert.alert('Contact', `Contact ${data.mentor?.name} at ${data.mentor?.contact ?? 'N/A'}`)}
              >
                <KISIcon name="send" size={18} tone="primary" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <KISButton
          title="Explore Spiritual Gifts"
          variant="outline"
          style={styles.giftsBtn}
          onPress={() => navigation.navigate('SpiritualGifts')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: sp, paddingBottom: 80 },
    screenTitle: { fontSize: 26, fontWeight: '700', color: palette.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: palette.subtext, marginBottom: 20 },
    stepperCard: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 },
    stepConnector: { alignItems: 'center', width: 32 },
    stepCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: palette.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: palette.divider,
    },
    stepCircleCompleted: { backgroundColor: palette.primary, borderColor: palette.primary },
    stepCircleCurrent: { backgroundColor: palette.primaryStrong, borderColor: palette.primaryStrong },
    stepCircleFuture: { backgroundColor: palette.bg, marginTop: 25, borderColor: palette.divider },
    stepLine: { width: 2, height: 28, backgroundColor: palette.divider, marginTop: 2 },
    stepLineCompleted: { backgroundColor: palette.primary },
    stepNum: { fontSize: 12, fontWeight: '700', color: palette.subtext },
    stepNumCurrent: { color: palette.ivory },
    stepNumFuture: { color: palette.divider },
    stepLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, minHeight: 28, paddingBottom: 28 },
    stepLabelCurrent: {},
    stageName: { fontSize: 14, fontWeight: '600', color: palette.text, flex: 1 },
    stageNameCurrent: { color: palette.primaryStrong, fontSize: 15 },
    stageNameFuture: { color: palette.subtext },
    currentPill: {
      backgroundColor: palette.primarySoft,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    currentPillText: { fontSize: 10, fontWeight: '700', color: palette.primary },
    sectionCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: palette.text, marginBottom: 12 },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
    milestoneCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: palette.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    milestoneCheckDone: { backgroundColor: palette.primary, borderColor: palette.primary },
    milestoneText: { flex: 1, fontSize: 14, color: palette.text },
    milestoneTextDone: { color: palette.subtext, textDecorationLine: 'line-through' },
    mentorCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 14,
    },
    mentorRow: { flexDirection: 'row', alignItems: 'center' },
    mentorAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    mentorAvatarText: { fontSize: 18, fontWeight: '700', color: palette.primary },
    mentorInfo: { flex: 1 },
    mentorName: { fontSize: 15, fontWeight: '600', color: palette.text },
    mentorContact: { fontSize: 13, color: palette.subtext, marginTop: 2 },
    contactBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      backgroundColor: palette.primarySoft,
    },
    giftsBtn: { minHeight: 48 },
  });
}
