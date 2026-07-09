import React, { useCallback, useState } from 'react';
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
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'GriefSupport'>;

type GriefGroup = {
  id: string;
  name: string;
  grief_type: string;
  facilitator_name?: string;
  member_count: number;
  description?: string;
};

const FILTER_TYPES = ['All', 'Spouse', 'Child', 'Parent', 'Sibling'] as const;
type FilterType = typeof FILTER_TYPES[number];

const GRIEF_TYPE_ICONS: Record<string, string> = {
  Spouse: 'rose-outline',
  Child: 'heart-outline',
  Parent: 'people-outline',
  Sibling: 'person-outline',
};

export default function GriefSupportScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [groups, setGroups] = useState<GriefGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('All');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.griefGroups)
        .then((res: any) => {
          if (!active) return;
          setGroups(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setGroups([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  function handleJoin(group: GriefGroup) {
    Alert.alert(
      'Join Group Anonymously?',
      'You can join this group anonymously. Your identity will not be shared with other members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join Anonymously',
          onPress: () => submitJoin(group.id, true),
        },
        {
          text: 'Join with Name',
          onPress: () => submitJoin(group.id, false),
        },
      ],
    );
  }

  async function submitJoin(groupId: string, anonymous: boolean) {
    setJoiningId(groupId);
    try {
      await postRequest(ROUTES.family.griefGroupJoin(groupId), { anonymous });
      Alert.alert('Joined', 'You have joined the group. You are not alone.');
      setGroups((prev) =>
        prev.map((g) => g.id === groupId ? { ...g, member_count: g.member_count + 1 } : g),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to join group');
    } finally {
      setJoiningId(null);
    }
  }

  const gutter = layout.pageGutter;
  const filtered = filter === 'All'
    ? groups
    : groups.filter((g) => g.grief_type?.toLowerCase() === filter.toLowerCase());

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <View style={{ paddingHorizontal: gutter, paddingTop: 20 }}>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Grief Support</Text>
        <Text style={[styles.subtitle, { color: palette.subtext }]}>
          You are not alone. Find a group that understands.
        </Text>

        {/* Filter bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
          {FILTER_TYPES.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === f ? palette.primary : palette.surface,
                  borderColor: filter === f ? palette.primary : palette.divider,
                },
              ]}
              onPress={() => setFilter(f)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.filterLabel, { color: filter === f ? palette.ivory : palette.text }]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 80, paddingTop: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <KISIcon name="hand-left-outline" size={48} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No groups found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = GRIEF_TYPE_ICONS[item.grief_type] ?? 'heart-outline';
          const isJoining = joiningId === item.id;
          return (
            <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIconCircle, { backgroundColor: palette.primarySoft }]}>
                  <KISIcon name={icon as any} size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupName, { color: palette.text }]}>{item.name}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: palette.surface }]}>
                    <Text style={[styles.typeText, { color: palette.subtext }]}>{item.grief_type}</Text>
                  </View>
                </View>
              </View>

              {item.description && (
                <Text style={[styles.groupDesc, { color: palette.subtext }]} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              <View style={styles.groupFooter}>
                <View style={styles.groupMeta}>
                  {item.facilitator_name && (
                    <Text style={[styles.facilitator, { color: palette.subtext }]}>
                      Facilitator: {item.facilitator_name}
                    </Text>
                  )}
                  <View style={styles.memberCount}>
                    <KISIcon name="people-outline" size={14} color={palette.subtext} />
                    <Text style={[styles.memberCountText, { color: palette.subtext }]}>
                      {item.member_count} members
                    </Text>
                  </View>
                </View>
                <KISButton
                  title={isJoining ? 'Joining…' : 'Join'}
                  size="sm"
                  onPress={() => handleJoin(item)}
                  disabled={isJoining}
                  loading={isJoining}
                />
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  filterBar: { marginBottom: 4 },
  filterChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterLabel: { fontSize: 14, fontWeight: '600' },
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  groupIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 12 },
  groupDesc: { fontSize: 13, lineHeight: 18 },
  groupFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupMeta: { flex: 1, gap: 4 },
  facilitator: { fontSize: 12 },
  memberCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberCountText: { fontSize: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
