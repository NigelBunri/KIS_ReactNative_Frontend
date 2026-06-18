/**
 * AdminUsersPanel — full user management panel for KCAN admin.
 * Search, filter, ban, unban, tier-change any user on the platform.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { AdminUser, AdminUsersPagination } from '@/screens/tabs/partners/useAdminUsersPanel';

const TIERS = ['Free', 'Pro', 'Business', 'Business Pro', 'Partner', 'Partner Pro'];
const STATUSES = ['active', 'suspended', 'banned'];

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  users: AdminUser[];
  pagination: AdminUsersPagination | null;
  loading: boolean;
  actionLoading: string | null;
  error: string | null;
  query: string;
  onSearch: (q: string) => void;
  onBan: (id: string, reason: string, permanent: boolean) => Promise<boolean>;
  onUnban: (id: string) => Promise<boolean>;
  onSetTier: (id: string, tier: string) => Promise<boolean>;
  onLoadPage: (page: number) => void;
  onClose: () => void;
};

export default function AdminUsersPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  users,
  pagination,
  loading,
  actionLoading,
  error,
  query,
  onSearch,
  onBan,
  onUnban,
  onSetTier,
  onLoadPage,
  onClose,
}: Props) {
  const { palette } = useKISTheme();
  const [localQuery, setLocalQuery] = useState(query);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  if (!isOpen) return null;

  const handleBan = (user: AdminUser) => {
    Alert.alert(
      'Ban User',
      `Ban ${user.display_name ?? user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend (temp)',
          onPress: () => void onBan(user.id, 'Policy violation', false),
        },
        {
          text: 'Ban (permanent)',
          style: 'destructive',
          onPress: () => void onBan(user.id, 'Policy violation', true),
        },
      ],
    );
  };

  const handleTierChange = (user: AdminUser) => {
    Alert.alert(
      'Change Tier',
      `Current: ${user.tier}`,
      [
        ...TIERS.map(tier => ({
          text: tier === user.tier ? `✓ ${tier}` : tier,
          onPress: () => void onSetTier(user.id, tier),
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          width: panelWidth,
          backgroundColor: palette.surface ?? palette.bg,
          borderLeftColor: palette.border,
          transform: [{ translateX: panelTranslateX }],
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>User Management</Text>
        <Pressable onPress={onClose}>
          <Text style={{ color: palette.subtext, fontSize: 20 }}>✕</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: palette.border }]}>
        <TextInput
          value={localQuery}
          onChangeText={setLocalQuery}
          onSubmitEditing={() => onSearch(localQuery)}
          placeholder="Search email, username, phone…"
          placeholderTextColor={palette.subtext}
          style={[styles.searchInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card ?? palette.surface }]}
          returnKeyType="search"
        />
        <Pressable
          onPress={() => onSearch(localQuery)}
          style={[styles.searchBtn, { backgroundColor: palette.primary }]}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Search</Text>
        </Pressable>
      </View>

      {/* Stats bar */}
      {pagination && (
        <View style={[styles.statsBar, { borderBottomColor: palette.border }]}>
          <Text style={[styles.statsText, { color: palette.subtext }]}>
            {pagination.total_items.toLocaleString()} users · page {pagination.page}/{pagination.total_pages}
          </Text>
          <View style={styles.pageRow}>
            {pagination.page > 1 && (
              <Pressable onPress={() => onLoadPage(pagination.page - 1)}>
                <Text style={[styles.pageBtn, { color: palette.primary }]}>← Prev</Text>
              </Pressable>
            )}
            {pagination.page < pagination.total_pages && (
              <Pressable onPress={() => onLoadPage(pagination.page + 1)}>
                <Text style={[styles.pageBtn, { color: palette.primary }]}>Next →</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
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
              onBan={() => handleBan(item)}
              onUnban={() => void onUnban(item.id)}
              onChangeTier={() => handleTierChange(item)}
              onSelect={() => setSelectedUser(selectedUser?.id === item.id ? null : item)}
              selected={selectedUser?.id === item.id}
            />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: palette.border + '55' }} />
          )}
        />
      )}
    </Animated.View>
  );
}

function UserRow({ user, palette, isActioning, onBan, onUnban, onChangeTier, onSelect, selected }: any) {
  const statusColor = user.status === 'active' ? palette.success
    : user.status === 'banned' ? palette.danger
    : '#f0ad4e';

  return (
    <Pressable onPress={onSelect} style={[styles.userRow, selected && { backgroundColor: palette.primarySoft + '18' }]}>
      <View style={styles.userMain}>
        <View style={styles.userHeader}>
          <Text style={[styles.userName, { color: palette.text }]} numberOfLines={1}>
            {user.display_name ?? user.username ?? user.email ?? 'Unknown'}
          </Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          {user.is_superuser && <Text style={[styles.superBadge, { backgroundColor: palette.goldHighlight, color: palette.royalInk }]}>GO</Text>}
          {user.is_staff && !user.is_superuser && <Text style={[styles.staffBadge, { backgroundColor: palette.primary, color: palette.onPrimary }]}>Staff</Text>}
        </View>
        <Text style={[styles.userEmail, { color: palette.subtext }]} numberOfLines={1}>
          {user.email ?? user.phone ?? ''}
        </Text>
        <View style={styles.userMeta}>
          <TierPill tier={user.tier} palette={palette} />
          <Text style={[styles.metaText, { color: palette.subtext }]}>{user.country}</Text>
          {user.trust_score != null && (
            <Text style={[styles.metaText, { color: palette.subtext }]}>
              Trust: {Math.round(user.trust_score)}
            </Text>
          )}
        </View>
      </View>

      {selected && (
        <View style={styles.actionRow}>
          {isActioning ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <>
              <ActionBtn label="Tier" color={palette.primary} onPress={onChangeTier} />
              {user.status === 'active' ? (
                <ActionBtn label="Ban" color={palette.danger} onPress={onBan} />
              ) : (
                <ActionBtn label="Unban" color={palette.success} onPress={onUnban} />
              )}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

function TierPill({ tier, palette }: { tier: string; palette: any }) {
  const color = tier.toLowerCase().includes('partner') ? '#9B59B6'
    : tier.toLowerCase().includes('business') ? '#2980B9'
    : tier.toLowerCase() === 'pro' ? '#27AE60'
    : '#7F8C8D';
  return (
    <View style={[styles.tierPill, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.tierPillText, { color }]}>{tier}</Text>
    </View>
  );
}

function ActionBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.actionBtn, { backgroundColor: color + '18', borderColor: color }]}>
      <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    zIndex: 130,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '900' },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  searchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statsText: { fontSize: 11 },
  pageRow: { flexDirection: 'row', gap: 12 },
  pageBtn: { fontSize: 12, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBox: { padding: 16 },
  errorText: { fontSize: 13 },
  userRow: { paddingHorizontal: 14, paddingVertical: 12 },
  userMain: {},
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: '700', flex: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  superBadge: {
    fontSize: 10, fontWeight: '900',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  staffBadge: {
    fontSize: 10, fontWeight: '700',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  userEmail: { fontSize: 11, marginTop: 2 },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { fontSize: 10 },
  tierPill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  tierPillText: { fontSize: 10, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
});
