import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

type Props = NativeStackScreenProps<RootStackParamList, 'SmallGroups'>;

type SmallGroup = {
  id: string;
  name: string;
  leader_name?: string;
  type: string;
  member_count: number;
  meeting_day?: string;
  description?: string;
  is_member?: boolean;
};

const GROUP_FILTERS = ['All', 'Cell', 'Youth', 'Women', 'Men', 'Couples'];

export default function SmallGroupsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [groups, setGroups] = useState<SmallGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      const params = filter !== 'All' ? `?type=${filter.toLowerCase()}` : '';
      getRequest(`${ROUTES.church.groups}${params}`)
        .then(res => {
          if (res?.success) {
            const raw = res.data;
            setGroups(Array.isArray(raw) ? raw : raw?.results ?? []);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [filter]),
  );

  const handleJoin = useCallback(async (group: SmallGroup) => {
    setJoiningId(group.id);
    try {
      const res = await postRequest(ROUTES.church.groupJoin(group.id), {});
      if (res?.success) {
        Alert.alert('Joined!', `You have joined ${group.name}.`);
        setGroups(prev => prev.map(g => g.id === group.id ? { ...g, is_member: true } : g));
      } else {
        Alert.alert('Error', res?.message ?? 'Could not join group.');
      }
    } catch {
      Alert.alert('Error', 'Network error.');
    } finally {
      setJoiningId(null);
    }
  }, []);

  const renderGroup = ({ item }: { item: SmallGroup }) => (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <View style={styles.groupIconWrap}>
          <KISIcon name="people-outline" size={22} tone="primary" />
        </View>
        <View style={styles.groupMeta}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupLeader}>
            {item.leader_name ? `Led by ${item.leader_name}` : 'Leader TBD'}
          </Text>
        </View>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{item.type}</Text>
        </View>
      </View>

      <View style={styles.groupStats}>
        <View style={styles.statItem}>
          <KISIcon name="people-outline" size={14} tone="muted" />
          <Text style={styles.statItemText}>{item.member_count} members</Text>
        </View>
        {item.meeting_day && (
          <View style={styles.statItem}>
            <KISIcon name="calendar-outline" size={14} tone="muted" />
            <Text style={styles.statItemText}>{item.meeting_day}</Text>
          </View>
        )}
      </View>

      <View style={styles.groupActions}>
        <KISButton
          title={item.is_member ? 'Joined' : joiningId === item.id ? 'Joining...' : 'Join'}
          variant={item.is_member ? 'secondary' : 'primary'}
          size="sm"
          disabled={item.is_member || joiningId === item.id}
          loading={joiningId === item.id}
          onPress={() => handleJoin(item)}
          style={styles.actionBtn}
        />
        <KISButton
          title="View"
          variant="outline"
          size="sm"
          style={styles.actionBtn}
          onPress={() => navigation.navigate('SmallGroupDetail', { groupId: item.id })}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
        style={styles.filterScroll}
      >
        {GROUP_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No groups found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
    filterScroll: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.divider },
    filterContainer: { paddingHorizontal: sp, paddingVertical: 10, gap: 8 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
      minHeight: 34,
      justifyContent: 'center',
    },
    filterChipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
    filterText: { fontSize: 13, color: palette.subtext },
    filterTextActive: { color: palette.ivory, fontWeight: '600' },
    list: { padding: sp, gap: 12, paddingBottom: 80 },
    groupCard: {
      backgroundColor: palette.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    groupIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    groupMeta: { flex: 1 },
    groupName: { fontSize: 15, fontWeight: '700', color: palette.text },
    groupLeader: { fontSize: 12, color: palette.subtext, marginTop: 2 },
    typeBadge: {
      backgroundColor: palette.surface,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    typeText: { fontSize: 12, fontWeight: '500', color: palette.text },
    groupStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statItemText: { fontSize: 12, color: palette.subtext },
    groupActions: { flexDirection: 'row', gap: 8 },
    actionBtn: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, color: palette.subtext },
  });
}
