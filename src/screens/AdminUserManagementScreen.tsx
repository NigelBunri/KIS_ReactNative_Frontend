// src/screens/AdminUserManagementScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout, type ResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

import type { RootStackParamList } from '@/navigation/types';
import type { AdminUser, AdminUsersPagination } from '@/screens/tabs/partners/useAdminUsersPanel';

const TIERS = ['Free', 'Pro', 'Business', 'Business Pro', 'Partner', 'Partner Pro'];

export default function AdminUserManagementScreen() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<AdminUsersPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [localQuery, setLocalQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async (opts?: { q?: string; p?: number; refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    const q = opts?.q ?? query;
    const pg = opts?.p ?? page;
    if (q) params.set('q', q);
    params.set('page', String(pg));
    params.set('per_page', '20');

    const baseUrl = ROUTES.adminUsers.list;
    const url = `${baseUrl}?${params.toString()}`;
    try {
      const res = await getRequest(url, { errorMessage: 'Failed to load users.' });
      if (res.success) {
        setUsers(res.data?.users ?? res.data?.results ?? []);
        setPagination(res.data?.pagination ?? null);
      } else {
        setError(res.message ?? 'Failed to load users.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, page]);

  useEffect(() => {
    void loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(() => {
    setQuery(localQuery);
    setPage(1);
    void loadUsers({ q: localQuery, p: 1 });
  }, [localQuery, loadUsers]);

  const handleLoadPage = useCallback((nextPage: number) => {
    setPage(nextPage);
    void loadUsers({ p: nextPage });
  }, [loadUsers]);

  const handleBan = useCallback((user: AdminUser) => {
    Alert.alert(
      'Ban User',
      `Ban ${user.display_name ?? user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend (temp)',
          onPress: async () => {
            setActionLoading(user.id);
            try {
              const endpoint = ROUTES.adminUsers.ban(user.id);
              const res = await postRequest(endpoint, { reason: 'Policy violation', permanent: false }, { errorMessage: 'Unable to suspend user.' });
              if (res.success) {
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'suspended' } : u));
              } else {
                Alert.alert('Suspend User', res.message ?? 'Unable to suspend user.');
              }
            } catch (err: any) {
              Alert.alert('Suspend User', err?.message ?? 'Unable to suspend user.');
            } finally {
              setActionLoading(null);
            }
          },
        },
        {
          text: 'Ban (permanent)',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(user.id);
            try {
              const endpoint = ROUTES.adminUsers.ban(user.id);
              const res = await postRequest(endpoint, { reason: 'Policy violation', permanent: true }, { errorMessage: 'Unable to ban user.' });
              if (res.success) {
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'banned' } : u));
              } else {
                Alert.alert('Ban User', res.message ?? 'Unable to ban user.');
              }
            } catch (err: any) {
              Alert.alert('Ban User', err?.message ?? 'Unable to ban user.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, []);

  const handleUnban = useCallback(async (user: AdminUser) => {
    setActionLoading(user.id);
    try {
      const endpoint = ROUTES.adminUsers.unban(user.id);
      const res = await postRequest(endpoint, {}, { errorMessage: 'Unable to unban user.' });
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'active' } : u));
      } else {
        Alert.alert('Unban User', res.message ?? 'Unable to unban user.');
      }
    } catch (err: any) {
      Alert.alert('Unban User', err?.message ?? 'Unable to unban user.');
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleSetTier = useCallback((user: AdminUser) => {
    Alert.alert(
      'Change Tier',
      `Current: ${user.tier}`,
      [
        ...TIERS.map(tier => ({
          text: tier === user.tier ? `✓ ${tier}` : tier,
          onPress: async () => {
            setActionLoading(user.id);
            try {
              const endpoint = ROUTES.adminUsers.setTier(user.id);
              const res = await postRequest(endpoint, { tier }, { errorMessage: 'Unable to change tier.' });
              if (res.success) {
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, tier } : u));
              } else {
                Alert.alert('Change Tier', res.message ?? 'Unable to change tier.');
              }
            } catch (err: any) {
              Alert.alert('Change Tier', err?.message ?? 'Unable to change tier.');
            } finally {
              setActionLoading(null);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, []);

  const styles = createStyles(palette, responsive);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <KISIcon name="arrow-back" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>User Management</Text>
        <View style={{ width: responsive.minTouchTarget }} />
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: palette.divider, backgroundColor: palette.surface }]}>
        <TextInput
          value={localQuery}
          onChangeText={setLocalQuery}
          onSubmitEditing={handleSearch}
          placeholder="Search email, username, phone..."
          placeholderTextColor={palette.subtext}
          style={[styles.searchInput, { color: palette.text, borderColor: palette.divider, backgroundColor: palette.card ?? palette.bg }]}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          onPress={handleSearch}
          style={[styles.searchBtn, { backgroundColor: palette.primaryStrong ?? palette.primary }]}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      {/* Pagination bar */}
      {pagination ? (
        <View style={[styles.statsBar, { borderBottomColor: palette.divider, backgroundColor: palette.surface }]}>
          <Text style={[styles.statsText, { color: palette.subtext }]}>
            {pagination.total_items.toLocaleString()} users · page {pagination.page}/{pagination.total_pages}
          </Text>
          <View style={styles.pageRow}>
            {pagination.page > 1 ? (
              <Pressable onPress={() => handleLoadPage(pagination.page - 1)} style={styles.pageBtnHit} hitSlop={8}>
                <Text style={[styles.pageBtn, { color: palette.primaryStrong ?? palette.primary }]}>&#8592; Prev</Text>
              </Pressable>
            ) : null}
            {pagination.page < pagination.total_pages ? (
              <Pressable onPress={() => handleLoadPage(pagination.page + 1)} style={styles.pageBtnHit} hitSlop={8}>
                <Text style={[styles.pageBtn, { color: palette.primaryStrong ?? palette.primary }]}>Next &#8594;</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primaryStrong ?? palette.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          <Pressable onPress={() => loadUsers()} style={[styles.retryBtn, { borderColor: palette.primaryStrong ?? palette.primary }]}>
            <Text style={[styles.retryBtnText, { color: palette.primaryStrong ?? palette.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              palette={palette}
              isActioning={actionLoading === item.id}
              selected={selectedUserId === item.id}
              onSelect={() => setSelectedUserId(prev => prev === item.id ? null : item.id)}
              onBan={() => handleBan(item)}
              onUnban={() => void handleUnban(item)}
              onChangeTier={() => handleSetTier(item)}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadUsers({ refresh: true })} tintColor={palette.primaryStrong} colors={[palette.primaryStrong]} />
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.divider, marginLeft: 16 }} />
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No users found.</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

type UserRowProps = {
  user: AdminUser;
  palette: any;
  isActioning: boolean;
  selected: boolean;
  onSelect: () => void;
  onBan: () => void;
  onUnban: () => void;
  onChangeTier: () => void;
};

function UserRow({ user, palette, isActioning, selected, onSelect, onBan, onUnban, onChangeTier }: UserRowProps) {
  const statusColor =
    user.status === 'active' ? (palette.success) :
    user.status === 'banned' ? (palette.danger) :
    palette.warning;

  return (
    <Pressable
      onPress={onSelect}
      style={[
        userRowStyles.row,
        selected && { backgroundColor: (palette.primarySoft ?? palette.primary) + '18' },
      ]}
    >
      <View style={userRowStyles.main}>
        <View style={userRowStyles.nameRow}>
          <Text style={[userRowStyles.name, { color: palette.text }]} numberOfLines={1}>
            {user.display_name ?? user.username ?? user.email ?? 'Unknown'}
          </Text>
          <View style={[userRowStyles.statusDot, { backgroundColor: statusColor }]} />
          {user.is_superuser ? (
            <View style={[userRowStyles.badge, { backgroundColor: palette.primaryStrong }]}>
              <Text style={[userRowStyles.badgeText, { color: palette.onPrimary }]}>GO</Text>
            </View>
          ) : user.is_staff ? (
            <View style={[userRowStyles.badge, { backgroundColor: palette.primary }]}>
              <Text style={[userRowStyles.badgeText, { color: palette.onPrimary }]}>Staff</Text>
            </View>
          ) : null}
        </View>
        <Text style={[userRowStyles.email, { color: palette.subtext }]} numberOfLines={1}>
          {user.email ?? user.phone ?? ''}
        </Text>
        <View style={userRowStyles.metaRow}>
          <TierPill tier={user.tier} />
          {user.country ? (
            <Text style={[userRowStyles.meta, { color: palette.subtext }]}>{user.country}</Text>
          ) : null}
          {user.trust_score != null ? (
            <Text style={[userRowStyles.meta, { color: palette.subtext }]}>
              Trust: {Math.round(user.trust_score)}
            </Text>
          ) : null}
        </View>
      </View>

      {selected ? (
        <View style={userRowStyles.actions}>
          {isActioning ? (
            <ActivityIndicator size="small" color={palette.primaryStrong ?? palette.primary} />
          ) : (
            <>
              <ActionButton label="Tier" color={palette.primaryStrong ?? palette.primary} onPress={onChangeTier} />
              {user.status === 'active' ? (
                <ActionButton label="Ban" color={palette.danger} onPress={onBan} />
              ) : (
                <ActionButton label="Unban" color={palette.success} onPress={onUnban} />
              )}
            </>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

function TierPill({ tier }: { tier: string }) {
  const { palette: tierpPalette } = useKISTheme();
  const color =
    tier.toLowerCase().includes('partner') ? tierpPalette.primaryStrong :
    tier.toLowerCase().includes('business') ? tierpPalette.primary :
    tier.toLowerCase() === 'pro' ? tierpPalette.success :
    tierpPalette.subtext;
  return (
    <View style={[userRowStyles.tierPill, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[userRowStyles.tierText, { color }]}>{tier}</Text>
    </View>
  );
}

function ActionButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[userRowStyles.actionBtn, { backgroundColor: color + '18', borderColor: color }]}
    >
      <Text style={[userRowStyles.actionBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const userRowStyles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 12 },
  main: {},
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '700', flex: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  email: { fontSize: 11, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  meta: { fontSize: 10 },
  tierPill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  tierText: { fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: { fontWeight: '700', fontSize: 12 },
});

function createStyles(palette: any, responsive: ResponsiveLayout) {
  const gutter = responsive.pageGutter;
  return StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: gutter,
      paddingVertical: 14,
      minHeight: responsive.minTouchTarget,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backButton: { width: responsive.minTouchTarget, minHeight: responsive.minTouchTarget, alignItems: 'flex-start', justifyContent: 'center' },
    headerTitle: { fontSize: responsive.bodyFontSize + 2, fontWeight: '700' },
    searchRow: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      minHeight: responsive.minTouchTarget,
      fontSize: responsive.labelFontSize + 1,
    },
    searchBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: responsive.minTouchTarget,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBtnText: { color: palette.onPrimary, fontWeight: '700', fontSize: responsive.labelFontSize + 1 },
    statsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    statsText: { fontSize: responsive.labelFontSize - 1 },
    pageRow: { flexDirection: 'row', gap: 12 },
    pageBtnHit: { minHeight: responsive.minTouchTarget, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    pageBtn: { fontSize: responsive.labelFontSize, fontWeight: '700' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorBox: { padding: 24, alignItems: 'center', gap: 12 },
    errorText: { fontSize: responsive.bodyFontSize - 1, textAlign: 'center' },
    retryBtn: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: responsive.minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryBtnText: { fontSize: responsive.labelFontSize + 1, fontWeight: '700' },
    emptyBox: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: responsive.bodyFontSize - 1 },
  });
}
