import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';
import { useProfileController } from '@/screens/tabs/profile/useProfileController';
import { useAuth } from '../../../App';

const CATEGORY_LABELS: Record<string, string> = {
  health: 'Health & Medical',
  finances: 'Financial Hardship',
  relationships: 'Relationships & Marriage',
  faith: 'Faith & Spirituality',
  business: 'Business & Career',
  grief: 'Loss & Grief',
  addiction: 'Addiction & Recovery',
  family: 'Family & Parenting',
  mental_health: 'Mental Health',
  other: 'Other',
};
const CATEGORY_EMOJI: Record<string, string> = {
  health: '🏥',
  finances: '💰',
  relationships: '💑',
  faith: '🙏',
  business: '💼',
  grief: '🕊️',
  addiction: '🌱',
  family: '👨‍👩‍👧',
  mental_health: '🧠',
  other: '💙',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type TabId = 'for_you' | 'sent';

export default function TestimonyReachInboxScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setAuth, setPhone, callingCode } = useAuth();
  const c = useProfileController({ setAuth, setPhone, locationCallingCode: callingCode });
  const currentUserId = useMemo(() => {
    const uid = c.profile?.user?.id;
    return uid ? String(uid) : null;
  }, [c.profile?.user?.id]);

  const [activeTab, setActiveTab] = useState<TabId>('for_you');
  const [reachOuts, setReachOuts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(palette), [palette]);

  const loadData = useCallback(async () => {
    const res = await getRequest(ROUTES.testimony.reach);
    if (res?.success) {
      const data = res.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      setReachOuts(list);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const received = useMemo(
    () => reachOuts.filter(r => String(r?.to_user?.id) === currentUserId),
    [reachOuts, currentUserId],
  );
  const sent = useMemo(
    () => reachOuts.filter(r => String(r?.from_user?.id) === currentUserId),
    [reachOuts, currentUserId],
  );

  const handleUpdateStatus = useCallback(
    async (id: string, status: 'accepted' | 'declined') => {
      setUpdatingId(id);
      try {
        const res = await patchRequest(ROUTES.testimony.reachDetail(id), { status });
        if (res?.success) {
          if (status === 'accepted') {
            Alert.alert('Connected!', 'You can now message them.');
          }
          await loadData();
        } else {
          Alert.alert('Error', res?.message ?? 'Unable to update status.');
        }
      } catch (err: any) {
        Alert.alert('Error', err?.message ?? 'Unable to update status.');
      } finally {
        setUpdatingId(null);
      }
    },
    [loadData],
  );

  const renderReceived = (item: any) => {
    const fromName = item?.from_user?.display_name ?? 'Someone';
    const initials = fromName[0].toUpperCase();
    const cat = item?.season?.category ?? item?.category ?? '';
    const isPending = item.status === 'pending';
    const isAccepted = item.status === 'accepted';
    const isDeclined = item.status === 'declined';
    const isUpdating = updatingId === String(item.id);

    return (
      <View key={item.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.cardRow}>
          {item?.from_user?.avatar_url ? (
            <Image source={{ uri: item.from_user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.name, { color: palette.text }]}>{fromName}</Text>
            {item?.testimony?.title ? (
              <Text style={[styles.testimonyItalic, { color: palette.subtext }]} numberOfLines={1}>
                "{item.testimony.title}"
              </Text>
            ) : null}
            {cat ? (
              <View style={[styles.catChip, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.catChipText, { color: palette.subtext }]}>
                  {CATEGORY_EMOJI[cat] ?? '💙'} {CATEGORY_LABELS[cat] ?? cat}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {item.message ? (
          <Text style={[styles.message, { color: palette.text }]}>{item.message}</Text>
        ) : null}
        {item.created_at ? (
          <Text style={[styles.timeAgo, { color: palette.subtext }]}>{timeAgo(item.created_at)}</Text>
        ) : null}
        {isPending && (
          <View style={styles.actionRow}>
            <Pressable
              disabled={isUpdating}
              onPress={() => handleUpdateStatus(String(item.id), 'accepted')}
              style={[styles.acceptBtn, { borderColor: '#2E7D32' }]}
            >
              <Text style={[styles.acceptBtnText]}>Accept</Text>
            </Pressable>
            <Pressable
              disabled={isUpdating}
              onPress={() => handleUpdateStatus(String(item.id), 'declined')}
              style={[styles.declineBtn, { borderColor: palette.border }]}
            >
              <Text style={[styles.declineBtnText, { color: palette.subtext }]}>Decline</Text>
            </Pressable>
          </View>
        )}
        {isAccepted && (
          <View style={styles.actionRow}>
            <View style={[styles.statusChip, { backgroundColor: '#E8F5E9' }]}>
              <Text style={{ color: '#2E7D32', fontWeight: '700', fontSize: 13 }}>✓ Accepted</Text>
            </View>
            <Pressable
              onPress={() => DeviceEventEmitter.emit('chat.open', {
                userId: item.from_user.id,
                name: item.from_user.display_name ?? '',
                kind: 'dm',
              })}
              style={[styles.messageBtn, { borderColor: palette.primary }]}
            >
              <Text style={[styles.messageBtnText, { color: palette.primary }]}>Message</Text>
            </Pressable>
          </View>
        )}
        {isDeclined && (
          <View style={[styles.statusChip, { backgroundColor: palette.surface }]}>
            <Text style={{ color: palette.subtext, fontWeight: '600', fontSize: 13 }}>Declined</Text>
          </View>
        )}
      </View>
    );
  };

  const renderSent = (item: any) => {
    const toName = item?.to_user?.display_name ?? 'Someone';
    const initials = toName[0].toUpperCase();
    const statusColors: Record<string, { bg: string; text: string }> = {
      pending: { bg: '#FFF8E1', text: '#F57F17' },
      accepted: { bg: '#E8F5E9', text: '#2E7D32' },
      declined: { bg: palette.surface, text: palette.subtext },
    };
    const statusStyle = statusColors[item.status] ?? statusColors.pending;

    return (
      <View key={item.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.cardRow}>
          {item?.to_user?.avatar_url ? (
            <Image source={{ uri: item.to_user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.name, { color: palette.text }]}>{toName}</Text>
            {item?.season?.title ? (
              <Text style={[styles.seasonTitle, { color: palette.subtext }]} numberOfLines={1}>
                {item.season.title}
              </Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {(item.status ?? 'pending').toUpperCase()}
            </Text>
          </View>
        </View>
        {item.created_at ? (
          <Text style={[styles.timeAgo, { color: palette.subtext }]}>{timeAgo(item.created_at)}</Text>
        ) : null}
      </View>
    );
  };

  const currentList = activeTab === 'for_you' ? received : sent;

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: palette.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.bg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Reach-out Inbox</Text>
      </View>

      <View style={[styles.tabs, { borderBottomColor: palette.divider }]}>
        {(['for_you', 'sent'] as TabId[]).map(tab => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                { borderBottomColor: isActive ? palette.primary : 'transparent', borderBottomWidth: 2 },
              ]}
            >
              <Text style={[styles.tabText, { color: isActive ? palette.primary : palette.subtext }]}>
                {tab === 'for_you' ? 'For You' : 'Sent'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={{ backgroundColor: palette.bg }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} colors={[palette.primary]} />
        }
      >
        {currentList.length === 0 ? (
          <View style={styles.emptyState}>
            <KISIcon name="bell" size={40} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>Nothing here yet.</Text>
          </View>
        ) : (
          currentList.map(item =>
            activeTab === 'for_you' ? renderReceived(item) : renderSent(item),
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    tabs: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabText: { fontSize: 15, fontWeight: '700' },
    list: { paddingHorizontal: 16, paddingBottom: 80, gap: 12, paddingTop: 8 },
    card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
    cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
    name: { fontSize: 15, fontWeight: '700' },
    testimonyItalic: { fontSize: 13, fontStyle: 'italic' },
    catChip: { alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
    catChipText: { fontSize: 12 },
    message: { fontSize: 14, lineHeight: 20 },
    timeAgo: { fontSize: 12 },
    actionRow: { flexDirection: 'row', gap: 10 },
    acceptBtn: { flex: 1, borderWidth: 1.5, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
    acceptBtnText: { color: '#2E7D32', fontWeight: '700', fontSize: 14 },
    declineBtn: { flex: 1, borderWidth: 1.5, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
    declineBtnText: { fontWeight: '700', fontSize: 14 },
    statusChip: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
    messageBtn: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
    messageBtnText: { fontWeight: '700', fontSize: 14 },
    statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
    statusBadgeText: { fontSize: 11, fontWeight: '800' },
    seasonTitle: { fontSize: 13 },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: 16 },
    emptyText: { fontSize: 15, textAlign: 'center' },
  });
}
