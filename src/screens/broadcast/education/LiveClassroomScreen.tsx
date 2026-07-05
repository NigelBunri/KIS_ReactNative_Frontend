import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveClassroom'>;

type Classroom = {
  id: string;
  title: string;
  host_name: string;
  status: 'live' | 'scheduled' | 'ended';
  participant_count: number;
  meeting_url?: string;
  recording_url?: string;
  is_host?: boolean;
};

export default function LiveClassroomScreen({ route, navigation }: Props) {
  const { classroomId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const sp = layout.pageGutter;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.education.classroom(classroomId))
        .then((res: any) => {
          if (active) setClassroom(res?.data ?? res ?? null);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [classroomId]),
  );

  const handleAction = async (type: 'start' | 'end') => {
    const url = type === 'start'
      ? ROUTES.education.classroomStart(classroomId)
      : ROUTES.education.classroomEnd(classroomId);
    const label = type === 'start' ? 'Start' : 'End';
    Alert.alert(`${label} Class`, `${label} this classroom session?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        style: type === 'end' ? 'destructive' : 'default',
        onPress: async () => {
          setActionLoading(true);
          try {
            await postRequest(url, {});
            const res: any = await getRequest(ROUTES.education.classroom(classroomId));
            setClassroom(res?.data ?? res ?? null);
          } catch {
            Alert.alert('Error', `Failed to ${label.toLowerCase()} class.`);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const statusColor = (s?: string) => {
    if (s === 'live') return palette.danger;
    if (s === 'scheduled') return palette.gold;
    return palette.subtext;
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    scroll: { flex: 1 },
    content: { paddingBottom: 80 },
    header: { padding: sp },
    title: { fontSize: 22, fontWeight: '700', color: palette.text, marginBottom: 6 },
    host: { fontSize: 14, color: palette.subtext, marginBottom: 10 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: palette.ivory },
    participantRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    participantText: { fontSize: 14, color: palette.subtext },
    section: {
      marginHorizontal: sp,
      marginTop: 16,
      backgroundColor: palette.card,
      borderRadius: 12,
      padding: sp,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: palette.text, marginBottom: 12 },
    divider: { height: 1, backgroundColor: palette.divider, marginVertical: 8 },
    recordingText: { fontSize: 14, color: palette.subtext },
    linkText: { fontSize: 14, color: palette.primary },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingTop: 8,
      minHeight: 44,
    },
    backLabel: { fontSize: 16, color: palette.primary, marginLeft: 4 },
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

  if (!classroom) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={{ color: palette.subtext }}>Classroom not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        style={styles.header}
      >
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-left" size={22} color={palette.ivory} />
          <Text style={[styles.backLabel, { color: palette.ivory }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: palette.ivory }]}>{classroom.title}</Text>
        <Text style={[styles.host, { color: palette.ivory, opacity: 0.85 }]}>
          Host: {classroom.host_name}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: statusColor(classroom.status) }]}>
            <Text style={styles.badgeText}>{classroom.status?.toUpperCase()}</Text>
          </View>
          <View style={styles.participantRow}>
            <KISIcon name="people" size={16} color={palette.ivory} />
            <Text style={[styles.participantText, { color: palette.ivory }]}>
              {classroom.participant_count ?? 0} participants
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Join Whiteboard */}
        {classroom.meeting_url ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Whiteboard</Text>
            <KISButton
              title="Join Whiteboard"
              variant="primary"
              onPress={() => Linking.openURL(classroom.meeting_url!)}
              left={<KISIcon name="screen-share" size={18} color={palette.ivory} />}
            />
          </View>
        ) : null}

        {/* Host Controls */}
        {classroom.is_host && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Host Controls</Text>
            {classroom.status !== 'live' ? (
              <KISButton
                title="Start Class"
                variant="primary"
                loading={actionLoading}
                onPress={() => handleAction('start')}
                left={<KISIcon name="play" size={18} color={palette.ivory} />}
              />
            ) : (
              <KISButton
                title="End Class"
                variant="danger"
                loading={actionLoading}
                onPress={() => handleAction('end')}
                left={<KISIcon name="stop" size={18} color={palette.ivory} />}
              />
            )}
          </View>
        )}

        {/* Recording */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recording</Text>
          {classroom.recording_url ? (
            <Pressable
              onPress={() => Linking.openURL(classroom.recording_url!)}
              hitSlop={8}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={styles.linkText}>Watch Recording</Text>
            </Pressable>
          ) : (
            <Text style={styles.recordingText}>No recording yet</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
