import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberDirectory'>;

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  tier: string;
  avatar?: string;
};

const TIERS = ['All', 'Visitor', 'Member', 'Deacon', 'Elder', 'Staff'];

const TIER_COLORS: Record<string, string> = {
  Visitor: '#6B7280',
  Member: '#3B82F6',
  Deacon: '#8B5CF6',
  Elder: '#F59E0B',
  Staff: '#10B981',
};

export default function MemberDirectoryScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('All');

  const styles = useMemo(() => makeStyles(palette, layout), [palette, layout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (tierFilter !== 'All') params.set('tier', tierFilter.toLowerCase());
      getRequest(`${ROUTES.church.memberships}?${params.toString()}`)
        .then(res => {
          if (res?.success) {
            const raw = res.data;
            setMembers(Array.isArray(raw) ? raw : raw?.results ?? []);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [search, tierFilter]),
  );

  const getInitials = (m: Member) =>
    `${m.first_name?.[0] ?? ''}${m.last_name?.[0] ?? ''}`.toUpperCase();

  const renderItem = ({ item }: { item: Member }) => {
    const tierColor = TIER_COLORS[item.tier] ?? palette.subtext;
    return (
      <TouchableOpacity
        style={styles.memberRow}
        onPress={() => navigation.navigate('MemberProfile', { memberId: item.id })}
        activeOpacity={0.7}
        hitSlop={{ top: 4, bottom: 4 }}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item)}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {item.first_name} {item.last_name}
          </Text>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: tierColor + '22', borderColor: tierColor }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>{item.tier}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.searchBar}>
        <KISIcon name="search" size={18} tone="muted" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search members..."
          placeholderTextColor={palette.subtext}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.filterRow}>
        {TIERS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.filterChip, tierFilter === t && styles.filterChipActive]}
            onPress={() => setTierFilter(t)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={[styles.filterText, tierFilter === t && styles.filterTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No members found.</Text>
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
    safe: { flex: 1, backgroundColor: palette.bg },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 12,
      marginHorizontal: sp,
      marginTop: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      height: 44,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.divider,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: palette.text,
      marginLeft: 8,
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: sp,
      paddingBottom: 12,
      gap: 6,
    },
    filterChip: {
      paddingHorizontal: 12,
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
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp,
      paddingVertical: 12,
      minHeight: 60,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarText: { fontSize: 16, fontWeight: '700', color: palette.primary },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 15, fontWeight: '600', color: palette.text },
    tierBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    tierText: { fontSize: 12, fontWeight: '600' },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: palette.divider,
      marginLeft: sp + 56,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, color: palette.subtext },
  });
}
