import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
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

type Props = NativeStackScreenProps<RootStackParamList, 'SavingsGroups'>;

type GroupType = 'All' | 'Susu' | 'ROSCA' | 'Investment';
const GROUP_TYPES: GroupType[] = ['All', 'Susu', 'ROSCA', 'Investment'];

type SavingsGroup = {
  id: string;
  name: string;
  group_type?: string;
  contribution_amount?: number;
  currency?: string;
  cycle?: string;
  member_count?: number;
  payout_order?: number;
  description?: string;
  is_member?: boolean;
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {};

export default function SavingsGroupsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [groups, setGroups] = useState<SavingsGroup[]>([]);
  const [activeType, setActiveType] = useState<GroupType>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  const fetchGroups = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeType !== 'All') params.set('group_type', activeType.toLowerCase());
      const res = await getRequest(`${ROUTES.business.savingsGroups}?${params.toString()}`);
      const list = res?.data?.results ?? res?.data ?? res?.results ?? res ?? [];
      setGroups(Array.isArray(list) ? list : []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeType]);

  useFocusEffect(useCallback(() => { fetchGroups(); }, [fetchGroups]));

  const handleJoin = useCallback(async (group: SavingsGroup) => {
    Alert.alert(
      `Join ${group.name}`,
      `Contribution: ${group.currency ?? 'USD'} ${group.contribution_amount?.toLocaleString() ?? 'N/A'} per ${group.cycle ?? 'cycle'}\n\nAre you sure you want to join?`,
      [
        {
          text: 'Join', onPress: async () => {
            setJoiningId(group.id);
            try {
              const res = await postRequest(ROUTES.business.savingsGroupJoin(group.id), {});
              if (res?.success || res?.id || res?.data) {
                Alert.alert('Joined!', `You have joined ${group.name}.`, [
                  { text: 'View Group', onPress: () => navigation.navigate('SavingsGroupDetail', { groupId: group.id }) },
                  { text: 'OK', style: 'cancel' },
                ]);
                fetchGroups();
              } else {
                Alert.alert('Failed', res?.error ?? 'Could not join group.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to join.');
            } finally {
              setJoiningId(null);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [fetchGroups, navigation]);

  const getTypeColor = (type?: string) => {
    switch ((type ?? '').toLowerCase()) {
      case 'susu': return { bg: palette.goldSoft, text: palette.goldDeep };
      case 'rosca': return { bg: palette.primarySoft, text: palette.primary };
      case 'investment': return { bg: palette.purpleSoft, text: palette.imperialPurple };
      default: return { bg: palette.surface, text: palette.subtext };
    }
  };

  const renderGroup = ({ item }: { item: SavingsGroup }) => {
    const typeColor = getTypeColor(item.group_type);
    const typeName = item.group_type ? item.group_type.charAt(0).toUpperCase() + item.group_type.slice(1) : 'Group';

    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('SavingsGroupDetail', { groupId: item.id })}
        hitSlop={4}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupName}>{item.name}</Text>
            <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
              <Text style={[styles.typeText, { color: typeColor.text }]}>{typeName}</Text>
            </View>
          </View>
          {item.is_member ? (
            <View style={[styles.memberBadge, { borderColor: palette.success }]}>
              <KISIcon name="checkmark-circle-outline" size={14} color={palette.success} />
              <Text style={[styles.memberText, { color: palette.success }]}>Member</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaGrid}>
          {item.contribution_amount ? (
            <View style={styles.metaItem}>
              <KISIcon name="cash-outline" size={14} color={palette.subtext} />
              <Text style={styles.metaText}>
                {item.currency ?? 'USD'} {item.contribution_amount.toLocaleString()}
                {item.cycle ? ` / ${item.cycle}` : ''}
              </Text>
            </View>
          ) : null}
          {item.member_count != null ? (
            <View style={styles.metaItem}>
              <KISIcon name="people-outline" size={14} color={palette.subtext} />
              <Text style={styles.metaText}>{item.member_count} members</Text>
            </View>
          ) : null}
          {item.payout_order != null ? (
            <View style={styles.metaItem}>
              <KISIcon name="list-outline" size={14} color={palette.subtext} />
              <Text style={styles.metaText}>Payout position #{item.payout_order}</Text>
            </View>
          ) : null}
        </View>

        {!item.is_member ? (
          <KISButton
            title={joiningId === item.id ? 'Joining...' : 'Join Group'}
            size="sm"
            loading={joiningId === item.id}
            onPress={() => handleJoin(item)}
            style={{ marginTop: 12 }}
          />
        ) : (
          <Pressable
            style={[styles.viewBtn, { borderColor: palette.primary }]}
            onPress={() => navigation.navigate('SavingsGroupDetail', { groupId: item.id })}
          >
            <Text style={[styles.viewBtnText, { color: palette.primary }]}>View Details</Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.navTitle}>Savings Groups</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={groups}
        keyExtractor={item => item.id}
        renderItem={renderGroup}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchGroups(true)} tintColor={palette.primary} />}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {GROUP_TYPES.map(t => {
              const active = activeType === t;
              return (
                <Pressable
                  key={t}
                  style={[
                    styles.filterChip,
                    { backgroundColor: active ? palette.primary : palette.surface, borderColor: active ? palette.primary : palette.divider },
                  ]}
                  onPress={() => setActiveType(t)}
                >
                  <Text style={[styles.filterChipText, { color: active ? palette.ivory : palette.text }]}>{t}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <KISIcon name="people-outline" size={48} color={palette.subtext} />
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No savings groups found</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, },
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
    list: { paddingHorizontal: sp, paddingBottom: 80, paddingTop: 4 },
    filterRow: { gap: 8, paddingVertical: 12 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipText: { fontSize: 13, fontWeight: '600' },
    card: {
      backgroundColor: palette.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
    groupName: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 6 },
    typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
    typeText: { fontSize: 12, fontWeight: '700' },
    memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    memberText: { fontSize: 12, fontWeight: '600' },
    metaGrid: { gap: 6, marginBottom: 4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 13, color: palette.subtext },
    viewBtn: { marginTop: 12, borderRadius: 10, borderWidth: 1.5, paddingVertical: 10, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
    viewBtnText: { fontSize: 14, fontWeight: '700' },
    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 15, fontWeight: '500' },
  });
}
