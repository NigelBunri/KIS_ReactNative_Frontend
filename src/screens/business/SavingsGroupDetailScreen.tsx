import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SavingsGroupDetail'>;

type Member = {
  id: string;
  display_name?: string;
  payout_position?: number;
  is_me?: boolean;
};

type Contribution = {
  id: string;
  amount: number;
  currency?: string;
  date?: string;
  status?: string;
};

type GroupDetail = {
  id: string;
  name: string;
  group_type?: string;
  contribution_amount?: number;
  currency?: string;
  cycle?: string;
  current_round?: number;
  total_rounds?: number;
  round_status?: string;
  next_payout_date?: string;
  members?: Member[];
  my_contributions?: Contribution[];
  my_payout_position?: number;
};

export default function SavingsGroupDetailScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getRequest(ROUTES.business.savingsGroup(groupId))
        .then(res => {
          const data = res?.data ?? res;
          if (data?.id) setGroup(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [groupId]),
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator color={palette.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <View style={styles.empty}>
          <KISIcon name="people-outline" size={48} color={palette.subtext} />
          <Text style={[styles.emptyText, { color: palette.subtext }]}>Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cur = group.currency ?? 'USD';
  const typeName = group.group_type
    ? group.group_type.charAt(0).toUpperCase() + group.group_type.slice(1)
    : 'Group';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtnNav} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="arrow-back-outline" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>{group.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Group Info Card */}
        <LinearGradient
          colors={[palette.goldSoft, palette.primarySoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.infoCard}
        >
          <Text style={[styles.groupName, { color: palette.text }]}>{group.name}</Text>
          <Text style={[styles.groupType, { color: palette.subtext }]}>{typeName}</Text>
          <View style={styles.infoRow}>
            {group.contribution_amount ? (
              <View style={styles.infoChip}>
                <KISIcon name="cash-outline" size={14} color={palette.primary} />
                <Text style={[styles.infoChipText, { color: palette.primary }]}>
                  {cur} {group.contribution_amount.toLocaleString()}/{group.cycle ?? 'cycle'}
                </Text>
              </View>
            ) : null}
            {group.total_rounds ? (
              <View style={styles.infoChip}>
                <KISIcon name="refresh-outline" size={14} color={palette.primary} />
                <Text style={[styles.infoChipText, { color: palette.primary }]}>
                  Round {group.current_round ?? '?'}/{group.total_rounds}
                </Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        {/* Current Round Indicator */}
        {(group.current_round || group.round_status || group.next_payout_date) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Round</Text>
            <View style={[styles.roundCard, { backgroundColor: palette.card, borderColor: palette.gold }]}>
              <View style={styles.roundRow}>
                <KISIcon name="trophy-outline" size={22} color={palette.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roundLabel, { color: palette.text }]}>
                    Round {group.current_round ?? '—'}
                    {group.round_status ? ` · ${group.round_status}` : ''}
                  </Text>
                  {group.next_payout_date ? (
                    <Text style={[styles.roundSub, { color: palette.subtext }]}>
                      Next payout: {new Date(group.next_payout_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Member Payout Order */}
        {group.members && group.members.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payout Order</Text>
            {group.members.map((member, idx) => (
              <View
                key={member.id}
                style={[
                  styles.memberRow,
                  member.is_me && { backgroundColor: palette.primarySoft, borderRadius: 10 },
                ]}
              >
                <View style={[styles.positionBubble, { backgroundColor: member.is_me ? palette.primary : palette.surface }]}>
                  <Text style={[styles.positionText, { color: member.is_me ? palette.ivory : palette.subtext }]}>
                    {member.payout_position ?? idx + 1}
                  </Text>
                </View>
                <Text style={[styles.memberName, { color: palette.text, fontWeight: member.is_me ? '700' : '400' }]}>
                  {member.display_name ?? `Member ${idx + 1}`}
                  {member.is_me ? ' (You)' : ''}
                </Text>
                {member.is_me ? (
                  <KISIcon name="person-circle-outline" size={18} color={palette.primary} />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Contribution History */}
        {group.my_contributions && group.my_contributions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Contributions</Text>
            {group.my_contributions.map(c => (
              <View key={c.id} style={styles.contributionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contributionAmount, { color: palette.primaryStrong }]}>
                    {c.currency ?? cur} {c.amount.toLocaleString()}
                  </Text>
                  {c.date ? (
                    <Text style={[styles.contributionDate, { color: palette.subtext }]}>
                      {new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  ) : null}
                </View>
                {c.status ? (
                  <View style={[styles.statusDot, {
                    backgroundColor: c.status === 'confirmed' ? palette.success : palette.warning,
                  }]} />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(palette: any, layout: any) {
  const sp = layout.pageGutter;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg, marginTop: 25 },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    backBtnNav: { width: 40, height: 44, justifyContent: 'center' },
    navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: palette.text },
    scroll: { paddingBottom: 80 },
    infoCard: { paddingHorizontal: sp, paddingVertical: 24, alignItems: 'center' },
    groupName: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
    groupType: { fontSize: 14, marginBottom: 14 },
    infoRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: palette.ivory,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    infoChipText: { fontSize: 13, fontWeight: '600' },
    section: {
      paddingHorizontal: sp,
      paddingTop: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 12 },
    roundCard: {
      borderRadius: 12,
      borderWidth: 1.5,
      padding: 14,
    },
    roundRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    roundLabel: { fontSize: 15, fontWeight: '700' },
    roundSub: { fontSize: 13, marginTop: 2 },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 8,
      marginBottom: 2,
    },
    positionBubble: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    positionText: { fontSize: 14, fontWeight: '700' },
    memberName: { flex: 1, fontSize: 14 },
    contributionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.divider,
    },
    contributionAmount: { fontSize: 15, fontWeight: '700' },
    contributionDate: { fontSize: 13, marginTop: 1 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
    emptyText: { fontSize: 16, fontWeight: '500' },
    backBtn: { width: 40, height: 44, justifyContent: 'center', marginLeft: sp },
  });
}
