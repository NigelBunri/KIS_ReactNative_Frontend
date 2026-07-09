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

type Props = NativeStackScreenProps<RootStackParamList, 'SmallGroupDetail'>;

type GroupDetail = {
  id: string;
  name: string;
  description?: string;
  leader_name?: string;
  leader_contact?: string;
  type: string;
  member_count: number;
  meeting_day?: string;
  meeting_time?: string;
  meeting_location?: string;
  is_member: boolean;
  members?: GroupMember[];
  next_meeting?: { date: string; location?: string; topic?: string };
  attendance_log?: AttendanceLog[];
};

type GroupMember = { id: string; name: string; role?: string };
type AttendanceLog = { id: string; date: string; present_count: number };

export default function SmallGroupDetailScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [attendanceExpanded, setAttendanceExpanded] = useState(false);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getRequest(ROUTES.church.group(groupId))
        .then(res => {
          if (res?.success) setGroup(res.data ?? null);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [groupId]),
  );

  const handleJoinLeave = useCallback(async () => {
    if (!group) return;
    setActionLoading(true);
    try {
      const endpoint = group.is_member
        ? ROUTES.church.groupLeave(groupId)
        : ROUTES.church.groupJoin(groupId);
      const res = await postRequest(endpoint, {});
      if (res?.success) {
        setGroup(prev => prev ? { ...prev, is_member: !prev.is_member } : prev);
        Alert.alert(
          group.is_member ? 'Left Group' : 'Joined Group',
          group.is_member ? `You have left ${group.name}.` : `Welcome to ${group.name}!`,
        );
      } else {
        Alert.alert('Error', res?.message ?? 'Action failed.');
      }
    } catch {
      Alert.alert('Error', 'Network error.');
    } finally {
      setActionLoading(false);
    }
  }, [group, groupId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.errorText}>Group not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.iconWrap}>
              <KISIcon name="people-outline" size={28} tone="primary" />
            </View>
            <View style={styles.infoMeta}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupType}>{group.type}</Text>
            </View>
          </View>

          {group.description ? (
            <Text style={styles.description}>{group.description}</Text>
          ) : null}

          <View style={styles.detailRows}>
            {group.leader_name && (
              <View style={styles.detailRow}>
                <KISIcon name="person" size={16} tone="muted" />
                <Text style={styles.detailText}>Led by {group.leader_name}</Text>
              </View>
            )}
            {group.meeting_day && (
              <View style={styles.detailRow}>
                <KISIcon name="calendar-outline" size={16} tone="muted" />
                <Text style={styles.detailText}>
                  {group.meeting_day}
                  {group.meeting_time ? ` at ${group.meeting_time}` : ''}
                </Text>
              </View>
            )}
            {group.meeting_location && (
              <View style={styles.detailRow}>
                <KISIcon name="location-outline" size={16} tone="muted" />
                <Text style={styles.detailText}>{group.meeting_location}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <KISIcon name="people-outline" size={16} tone="muted" />
              <Text style={styles.detailText}>{group.member_count} members</Text>
            </View>
          </View>

          <KISButton
            title={group.is_member ? 'Leave Group' : 'Join Group'}
            variant={group.is_member ? 'danger' : 'primary'}
            loading={actionLoading}
            disabled={actionLoading}
            onPress={handleJoinLeave}
            style={styles.joinBtn}
          />
        </View>

        {group.next_meeting && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Next Meeting</Text>
            <View style={styles.nextMeeting}>
              <Text style={styles.meetingDate}>
                {new Date(group.next_meeting.date).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'short', day: 'numeric',
                })}
              </Text>
              {group.next_meeting.location && (
                <Text style={styles.meetingDetail}>{group.next_meeting.location}</Text>
              )}
              {group.next_meeting.topic && (
                <Text style={styles.meetingTopic}>Topic: {group.next_meeting.topic}</Text>
              )}
            </View>
          </View>
        )}

        {group.members && group.members.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Members ({group.members.length})</Text>
            {group.members.map(m => (
              <View key={m.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{m.name[0]?.toUpperCase()}</Text>
                </View>
                <Text style={styles.memberName}>{m.name}</Text>
                {m.role && <View style={styles.roleBadge}><Text style={styles.roleText}>{m.role}</Text></View>}
              </View>
            ))}
          </View>
        )}

        {group.attendance_log && group.attendance_log.length > 0 && (
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => setAttendanceExpanded(v => !v)}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <Text style={styles.sectionTitle}>Attendance Log</Text>
              <KISIcon name={attendanceExpanded ? 'chevron-up' : 'chevron-down'} size={18} tone="muted" />
            </TouchableOpacity>
            {attendanceExpanded && group.attendance_log.map(log => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logDate}>
                  {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Text style={styles.logCount}>{log.present_count} present</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: sp, paddingBottom: 80 },
    errorText: { fontSize: 15, color: palette.danger },
    infoCard: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 16,
    },
    infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    infoMeta: { flex: 1 },
    groupName: { fontSize: 20, fontWeight: '700', color: palette.text },
    groupType: { fontSize: 13, color: palette.subtext, marginTop: 2 },
    description: { fontSize: 14, color: palette.subtext, marginBottom: 14, lineHeight: 20 },
    detailRows: { gap: 8, marginBottom: 16 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailText: { fontSize: 14, color: palette.text },
    joinBtn: { minHeight: 48 },
    sectionCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: palette.text, marginBottom: 10 },
    nextMeeting: { gap: 4 },
    meetingDate: { fontSize: 15, fontWeight: '600', color: palette.primary },
    meetingDetail: { fontSize: 13, color: palette.subtext },
    meetingTopic: { fontSize: 13, color: palette.text, fontStyle: 'italic' },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    memberAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    memberAvatarText: { fontSize: 14, fontWeight: '700', color: palette.primary },
    memberName: { flex: 1, fontSize: 14, color: palette.text },
    roleBadge: {
      backgroundColor: palette.surface,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    roleText: { fontSize: 11, color: palette.subtext },
    collapsibleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    logRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    logDate: { fontSize: 13, color: palette.text },
    logCount: { fontSize: 13, fontWeight: '600', color: palette.primary },
  });
}
