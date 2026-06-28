import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessMentorship'>;

type Tab = 'browse' | 'mine';

type Mentor = {
  id: string;
  display_name?: string;
  domain?: string;
  description?: string;
  status?: 'open' | 'closed' | 'busy' | string;
  industry?: string;
  years_experience?: number;
};

type MyMentorship = {
  id: string;
  mentor_name?: string;
  domain?: string;
  status?: string;
  started_at?: string;
};

export default function MentorshipScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [myMentorships, setMyMentorships] = useState<MyMentorship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getRequest(ROUTES.business.mentorship);
      const data = res?.data ?? res;
      if (data?.mentors) {
        setMentors(Array.isArray(data.mentors) ? data.mentors : []);
        setMyMentorships(Array.isArray(data.my_mentorships) ? data.my_mentorships : []);
      } else {
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setMentors(list);
      }
    } catch {
      setMentors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleRequestMatch = useCallback(async (mentor: Mentor) => {
    Alert.alert(
      `Request mentorship`,
      `Request a match with ${mentor.display_name ?? 'this mentor'} in ${mentor.domain ?? 'their domain'}?`,
      [
        {
          text: 'Request', onPress: async () => {
            setRequestingId(mentor.id);
            try {
              const res = await postRequest(ROUTES.business.mentorshipMatch(mentor.id), {});
              if (res?.success || res?.id || res?.data) {
                Alert.alert('Request sent!', 'Your mentorship match request has been submitted.');
                fetchData();
              } else {
                Alert.alert('Failed', res?.error ?? 'Could not send request.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to request match.');
            } finally {
              setRequestingId(null);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [fetchData]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'open': return { bg: palette.success, text: palette.ivory, label: 'Open' };
      case 'busy': return { bg: palette.warning, text: palette.royalInk, label: 'Busy' };
      case 'closed': return { bg: palette.subtext, text: palette.ivory, label: 'Closed' };
      default: return { bg: palette.surface, text: palette.subtext, label: status ?? 'Unknown' };
    }
  };

  const getMentorshipStatus = (status?: string) => {
    switch (status) {
      case 'active': return { color: palette.success, label: 'Active' };
      case 'pending': return { color: palette.warning, label: 'Pending' };
      case 'completed': return { color: palette.subtext, label: 'Completed' };
      default: return { color: palette.subtext, label: status ?? '' };
    }
  };

  const renderMentor = ({ item }: { item: Mentor }) => {
    const badge = getStatusBadge(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <KISIcon name="person-outline" size={22} color={palette.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mentorName}>{item.display_name ?? 'Mentor'}</Text>
            {item.domain ? <Text style={styles.domain}>{item.domain}</Text> : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
        ) : null}

        {item.years_experience ? (
          <View style={styles.metaItem}>
            <KISIcon name="time-outline" size={13} color={palette.subtext} />
            <Text style={styles.metaText}>{item.years_experience} years experience</Text>
          </View>
        ) : null}

        {item.status === 'open' ? (
          <KISButton
            title={requestingId === item.id ? 'Requesting...' : 'Request Match'}
            size="sm"
            loading={requestingId === item.id}
            onPress={() => handleRequestMatch(item)}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </View>
    );
  };

  const renderMentorship = ({ item }: { item: MyMentorship }) => {
    const statusConfig = getMentorshipStatus(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <KISIcon name="school-outline" size={22} color={palette.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mentorName}>{item.mentor_name ?? 'Mentor'}</Text>
            {item.domain ? <Text style={styles.domain}>{item.domain}</Text> : null}
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.mentorshipStatus, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
        {item.started_at ? (
          <Text style={styles.startedText}>
            Since {new Date(item.started_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.navTitle}>Mentorship</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabRow}>
        {(['browse', 'mine'] as Tab[]).map(tab => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tab, active && [styles.tabActive, { borderBottomColor: palette.primary }]]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: active ? palette.primary : palette.subtext }]}>
                {tab === 'browse' ? 'Browse Mentors' : 'My Mentorships'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'browse' ? (
        <FlatList
          data={mentors}
          keyExtractor={item => item.id}
          renderItem={renderMentor}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={palette.primary} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.empty}>
                <KISIcon name="school-outline" size={48} color={palette.subtext} />
                <Text style={[styles.emptyText, { color: palette.subtext }]}>No mentors available</Text>
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={myMentorships}
          keyExtractor={item => item.id}
          renderItem={renderMentorship}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={palette.primary} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.empty}>
                <KISIcon name="person-add-outline" size={48} color={palette.subtext} />
                <Text style={[styles.emptyText, { color: palette.subtext }]}>No active mentorships</Text>
                <Text style={[styles.emptySubText, { color: palette.subtext }]}>Browse mentors to request a match</Text>
              </View>
            )
          }
        />
      )}
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
    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomWidth: 2 },
    tabText: { fontSize: 14, fontWeight: '600' },
    list: { paddingHorizontal: sp, paddingBottom: 80, paddingTop: 12 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mentorName: { fontSize: 15, fontWeight: '700', color: palette.text },
    domain: { fontSize: 13, color: palette.subtext, marginTop: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusText: { fontSize: 12, fontWeight: '700' },
    description: { fontSize: 14, color: palette.subtext, lineHeight: 20, marginBottom: 8 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 13, color: palette.subtext },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
    mentorshipStatus: { fontSize: 13, fontWeight: '600' },
    startedText: { fontSize: 13, color: palette.subtext, marginTop: 4 },
    empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 15, fontWeight: '500' },
    emptySubText: { fontSize: 13 },
  });
}
