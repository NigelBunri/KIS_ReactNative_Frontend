// src/components/partners/PartnerMembersPanel.tsx
//
// Member directory + moderation (mute/timeout/kick/ban) + admin promote/
// demote in one screen — the backend for all three already existed
// (GET/PATCH /partners/{id}/members/, POST .../moderate/, POST
// .../admins/) with zero RN consumer before this. GET /members/ is
// paginated (see apps/partners/views.py's members() action) so this uses
// a FlatList with onEndReached rather than loading everything at once.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import styles from '@/components/partners/partnersStyles';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { patchRequest } from '@/network/patch';
import { postRequest } from '@/network/post';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  panelTranslateX: Animated.Value;
  partnerId?: string | null;
  isOwner?: boolean;
  onClose: () => void;
  initialTab?: 'members' | 'log';
};

type MemberEntry = {
  user_id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  membership_status: string;
  membership_role: string;
  role_names: string[];
  is_muted?: boolean;
  is_banned?: boolean;
  timed_out_until?: string | null;
  joined_at?: string | null;
};

type ModerationLogEntry = {
  id: string;
  user_name?: string | null;
  actor_name?: string | null;
  action_type: string;
  reason?: string | null;
  created_at?: string | null;
  revoked_at?: string | null;
};

const ROLE_OPTIONS = ['member', 'manager', 'admin'] as const;

export default function PartnerMembersPanel({
  isOpen,
  panelWidth,
  panelTranslateX,
  partnerId,
  isOwner,
  onClose,
  initialTab = 'members',
}: Props) {
  const { palette } = useKISTheme();
  const [tab, setTab] = useState<'members' | 'log'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<ModerationLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const backdropOpacity = panelTranslateX.interpolate({
    inputRange: [0, panelWidth],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const loadPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (!partnerId) return;
      const res = await getRequest(`${ROUTES.partners.members(partnerId)}?page=${targetPage}`, {
        errorMessage: 'Unable to load members.',
      });
      const payload = res?.data ?? res ?? {};
      const results = (payload.results ?? payload.members ?? []) as MemberEntry[];
      const totalPages = payload?.meta?.total_pages;
      setHasMore(typeof totalPages === 'number' ? targetPage < totalPages : results.length > 0);
      setMembers((prev) => (replace ? results : [...prev, ...(Array.isArray(results) ? results : [])]));
    },
    [partnerId],
  );

  const loadLog = useCallback(async () => {
    if (!partnerId) return;
    setLogLoading(true);
    const res = await getRequest(ROUTES.partners.moderationActions(partnerId), {
      errorMessage: 'Unable to load moderation log.',
    });
    setLogLoading(false);
    const payload = res?.data ?? res ?? [];
    setLogEntries(Array.isArray(payload) ? payload : []);
  }, [partnerId]);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setPage(1);
    loadPage(1, true).finally(() => setLoading(false));
  }, [isOpen, loadPage]);

  useEffect(() => {
    if (!isOpen || tab !== 'log') return;
    loadLog();
  }, [isOpen, tab, loadLog]);

  const loadMore = () => {
    if (loadingMore || !hasMore || loading) return;
    const next = page + 1;
    setLoadingMore(true);
    setPage(next);
    loadPage(next, false).finally(() => setLoadingMore(false));
  };

  const applyMemberUpdate = (userId: string, patch: Partial<MemberEntry>) => {
    setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, ...patch } : m)));
  };

  const changeRole = async (member: MemberEntry, role: string) => {
    if (!partnerId) return;
    setBusyUserId(member.user_id);
    const res = await patchRequest(
      ROUTES.partners.memberUpdate(partnerId, member.user_id),
      { role },
      { errorMessage: 'Unable to change role.' },
    );
    setBusyUserId(null);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to change role.');
      return;
    }
    applyMemberUpdate(member.user_id, { membership_role: role });
  };

  const moderate = async (member: MemberEntry, action: string, extra?: Record<string, unknown>) => {
    if (!partnerId) return;
    setBusyUserId(member.user_id);
    const res = await postRequest(
      ROUTES.partners.moderateMember(partnerId, member.user_id),
      { action, ...extra },
      { errorMessage: `Unable to ${action} this member.` },
    );
    setBusyUserId(null);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? `Unable to ${action} this member.`);
      return;
    }
    if (action === 'kick') {
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      return;
    }
    const patch: Partial<MemberEntry> = {};
    if (action === 'mute') patch.is_muted = true;
    if (action === 'unmute') patch.is_muted = false;
    if (action === 'ban') patch.is_banned = true;
    if (action === 'unban') patch.is_banned = false;
    if (action === 'timeout') patch.timed_out_until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    applyMemberUpdate(member.user_id, patch);
  };

  const promoteToAdmin = async (member: MemberEntry) => {
    if (!partnerId) return;
    setBusyUserId(member.user_id);
    const res = await postRequest(
      ROUTES.partners.addAdmin(partnerId),
      { user_id: member.user_id },
      { errorMessage: 'Unable to add admin.' },
    );
    setBusyUserId(null);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to add admin.');
      return;
    }
    Alert.alert('Done', `${member.display_name || 'Member'} is now an admin.`);
  };

  const demoteAdmin = async (member: MemberEntry) => {
    if (!partnerId) return;
    setBusyUserId(member.user_id);
    const res = await postRequest(
      ROUTES.partners.removeAdmin(partnerId),
      { user_id: member.user_id },
      { errorMessage: 'Unable to remove admin.' },
    );
    setBusyUserId(null);
    if (!res?.success) {
      Alert.alert('Failed', res?.message ?? 'Unable to remove admin.');
      return;
    }
    Alert.alert('Done', `${member.display_name || 'Member'} is no longer an admin.`);
  };

  const openActions = (member: MemberEntry) => {
    const options: { label: string; onPress: () => void; destructive?: boolean }[] = [];
    for (const role of ROLE_OPTIONS) {
      if (role !== member.membership_role) {
        options.push({ label: `Set role: ${role}`, onPress: () => changeRole(member, role) });
      }
    }
    options.push({ label: 'Promote to admin (conversation)', onPress: () => promoteToAdmin(member) });
    options.push({ label: 'Remove admin (conversation)', onPress: () => demoteAdmin(member) });
    options.push(
      member.is_muted
        ? { label: 'Unmute', onPress: () => moderate(member, 'unmute') }
        : { label: 'Mute', onPress: () => moderate(member, 'mute') },
    );
    options.push({ label: 'Timeout 24h', onPress: () => moderate(member, 'timeout') });
    options.push(
      member.is_banned
        ? { label: 'Unban', onPress: () => moderate(member, 'unban') }
        : { label: 'Ban', onPress: () => moderate(member, 'ban'), destructive: true },
    );
    options.push({
      label: 'Kick',
      destructive: true,
      onPress: () =>
        Alert.alert('Kick member?', `${member.display_name || 'This member'} will be removed from the organization.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Kick', style: 'destructive', onPress: () => moderate(member, 'kick') },
        ]),
    });

    Alert.alert(
      member.display_name || member.username || 'Member actions',
      undefined,
      [...options.map((o) => ({ text: o.label, style: o.destructive ? ('destructive' as const) : undefined, onPress: o.onPress })), { text: 'Cancel', style: 'cancel' as const }],
    );
  };

  const filtered = query.trim()
    ? members.filter((m) =>
        `${m.display_name ?? ''} ${m.username ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : members;

  if (!isOpen) return null;

  return (
    <View style={styles.settingsPanelOverlay} pointerEvents="box-none">
      <Animated.View
        style={[styles.settingsPanelBackdrop, { backgroundColor: palette.backdrop, opacity: backdropOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.settingsPanelContainer,
          {
            width: panelWidth,
            backgroundColor: palette.surfaceElevated,
            borderLeftColor: palette.divider,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <View style={[styles.settingsPanelHeader, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: palette.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsPanelTitle, { color: palette.text }]}>Members</Text>
            <Text style={[styles.settingsPanelDescription, { color: palette.subtext }]}>
              View, promote, and moderate everyone in this organization.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
          {(['members', 'log'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: tab === t ? palette.primary : palette.borderMuted,
              }}
            >
              <Text style={{ color: tab === t ? palette.primary : palette.text, fontSize: 12, fontWeight: '600' }}>
                {t === 'members' ? 'Members' : 'Moderation log'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'members' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search members"
              placeholderTextColor={palette.subtext}
              style={{
                borderWidth: 1,
                borderColor: palette.borderMuted,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                color: palette.text,
              }}
            />
          </View>
        ) : null}

        {tab === 'log' ? (
          logLoading ? (
            <ActivityIndicator size="small" color={palette.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={logEntries}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              ListEmptyComponent={
                <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 24 }}>No moderation actions yet.</Text>
              }
              renderItem={({ item }) => (
                <View style={[styles.settingsFeatureRow, { borderColor: palette.borderMuted, backgroundColor: palette.surface }]}>
                  <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                    {item.action_type} · {item.user_name || 'member'}
                  </Text>
                  <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, marginTop: 2 }]}>
                    by {item.actor_name || 'system'}
                    {item.reason ? ` · ${item.reason}` : ''}
                    {item.revoked_at ? ' · revoked' : ''}
                  </Text>
                </View>
              )}
            />
          )
        ) : loading ? (
          <ActivityIndicator size="small" color={palette.primary} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.user_id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            onEndReachedThreshold={0.4}
            onEndReached={loadMore}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={palette.primary} /> : null}
            ListEmptyComponent={
              <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 24 }}>No members found.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => (isOwner ? openActions(item) : undefined)}
                style={({ pressed }) => [
                  styles.settingsFeatureRow,
                  {
                    borderColor: item.is_banned ? palette.danger : palette.borderMuted,
                    backgroundColor: palette.surface,
                    opacity: pressed || busyUserId === item.user_id ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.settingsFeatureTitle, { color: palette.text }]}>
                  {item.display_name || item.username || 'Member'}
                </Text>
                <Text style={[styles.settingsFeatureDescription, { color: palette.subtext, marginTop: 2 }]}>
                  {item.membership_role}
                  {item.role_names?.length ? ` · ${item.role_names.join(', ')}` : ''}
                  {item.is_muted ? ' · muted' : ''}
                  {item.timed_out_until && new Date(item.timed_out_until) > new Date() ? ' · timed out' : ''}
                  {item.is_banned ? ' · BANNED' : ''}
                </Text>
              </Pressable>
            )}
          />
        )}
      </Animated.View>
    </View>
  );
}
