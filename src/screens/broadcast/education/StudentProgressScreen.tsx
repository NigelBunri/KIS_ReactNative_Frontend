import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'StudentProgress'>;

type TranscriptItem = {
  classroom_id: string;
  classroom_title: string;
  attendance_count: number;
  assignments_submitted: number;
  average_score: number;
  total_assignments: number;
};

type TranscriptData = {
  items: TranscriptItem[];
  total_courses: number;
  avg_score: number;
  assignments_submitted: number;
};

export default function StudentProgressScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [data, setData] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.education.transcript)
        .then((res: any) => {
          if (active) setData(res?.data ?? res ?? null);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    header: { padding: sp, paddingBottom: sp + 4 },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      minHeight: 44,
    },
    backLabel: { fontSize: 16, color: palette.ivory, marginLeft: 4 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: palette.ivory },
    scroll: { flex: 1 },
    content: { padding: sp, paddingBottom: 80 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '800', color: palette.primary, marginBottom: 4 },
    statLabel: { fontSize: 12, color: palette.subtext, textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 12 },
    progressCard: {
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: sp,
      marginBottom: 12,
    },
    classTitle: { fontSize: 15, fontWeight: '600', color: palette.text, marginBottom: 8 },
    metaRow: { flexDirection: 'row', gap: 16, marginBottom: 10, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, color: palette.subtext },
    progressLabel: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    progressLabelText: { fontSize: 12, color: palette.subtext },
    progressLabelValue: { fontSize: 12, fontWeight: '600', color: palette.primary },
    progressBar: {
      height: 6,
      backgroundColor: palette.divider,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: palette.primary },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { textAlign: 'center', color: palette.subtext, marginTop: 40 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const items: TranscriptItem[] = data?.items ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.ivory} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>My Progress</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data?.total_courses ?? 0}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {data?.avg_score != null ? `${Math.round(data.avg_score)}%` : 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data?.assignments_submitted ?? 0}</Text>
            <Text style={styles.statLabel}>Submitted</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Per-Classroom Progress</Text>

        {items.length === 0 && (
          <Text style={styles.empty}>No progress data yet.</Text>
        )}

        {items.map((item) => {
          const pct = item.total_assignments > 0
            ? (item.average_score / 100)
            : 0;
          return (
            <View key={item.classroom_id} style={styles.progressCard}>
              <Text style={styles.classTitle}>{item.classroom_title}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <KISIcon name="calendar-outline" size={14} color={palette.subtext} />
                  <Text style={styles.metaText}>{item.attendance_count} attended</Text>
                </View>
                <View style={styles.metaItem}>
                  <KISIcon name="document-text-outline" size={14} color={palette.subtext} />
                  <Text style={styles.metaText}>{item.assignments_submitted} submitted</Text>
                </View>
              </View>
              <View style={styles.progressLabel}>
                <Text style={styles.progressLabelText}>Average Score</Text>
                <Text style={styles.progressLabelValue}>
                  {item.average_score != null ? `${Math.round(item.average_score)}%` : 'N/A'}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.round(pct * 100))}%` as any }]} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
