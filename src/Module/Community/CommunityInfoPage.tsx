import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKISTheme } from '@/theme/useTheme';
import { KIS_TOKENS } from '@/theme/constants';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import WorkStatusRing from '@/components/common/WorkStatusRing';
import ROUTES, { CHAT_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import apiService from '@/services/apiService';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { getAccessToken } from '@/security/authStorage';
import { getFeedPlainText } from '@/components/feeds/richTextValue';
import { useSocket } from '@/SocketProvider';
import { refreshFromDeviceAndBackend, type KISContact } from '@/Module/AddContacts/contactsService';
import QrCodeShareModal from '@/components/common/QrCodeShareModal';

type MemberUser = {
  id?: string;
  display_name?: string | null;
  username?: string | null;
  phone?: string | null;
};

type CommunityMember = {
  id?: number | string;
  user?: MemberUser | number | string | null;
  base_role?: string;
  role?: string;
  display_name?: string;
};

type CommunityPost = {
  id: string;
  text?: unknown;
  text_plain?: string;
  text_preview?: string;
  created_at?: string;
  author?: { display_name?: string | null };
};

type CommunityJoinRequestItem = {
  id: number | string;
  user?: MemberUser | number | string | null;
  message?: string;
  status?: string;
  created_at?: string;
};

type CommunityInfoPageProps = {
  communityId: string;
  communityName: string;
  currentUserId: string | null;
  onBack: () => void;
};

const resolveUserName = (user?: MemberUser | number | string | null) => {
  if (!user) return '';
  if (typeof user === 'string' || typeof user === 'number') return String(user);
  return (
    user.display_name ||
    user.username ||
    user.phone ||
    user.id ||
    ''
  );
};

const resolveUserPhone = (user?: MemberUser | number | string | null) => {
  if (!user || typeof user === 'string' || typeof user === 'number') return '';
  return user.phone || '';
};

export const CommunityInfoPage: React.FC<CommunityInfoPageProps> = ({
  communityId,
  communityName,
  currentUserId,
  onBack,
}) => {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState<string>(communityName);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState<string>('');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);
  // "Admin" is always admin OF ONE OF THE COMMUNITY'S OWN GROUPS, never a
  // bare community-wide toggle (see promote_member_to_group_admin on the
  // backend) — "Promote to admin" only appears in the member action sheet
  // below when this is non-empty, and promoting asks the owner to pick
  // one of these.
  const [communityGroups, setCommunityGroups] = useState<{ id: string; name: string }[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [showInviteQr, setShowInviteQr] = useState(false);
  // Authoritative, pagination-independent role signal from the community
  // detail response itself (CommunityDetailSerializer.is_owner/
  // current_user_role — a direct per-request DB lookup, not derived from
  // scanning any list). See the `me`/`isAdmin` memo below for why this
  // exists.
  const [viewerRole, setViewerRole] = useState<string | null>(null);

  // Edit community (name/description) — avatar already had its own upload
  // flow; name/description had no edit UI at all even though the backend
  // (PATCH .../chat-communities/{id}/, owner/admin-gated) already supports
  // both.
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Join requests (pending approval) — approve_request/reject_request were
  // fully built and permission-checked server-side but unreachable: there
  // was no endpoint to even list pending requests, and no UI anywhere to
  // call approve/reject with a request_id.
  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequestItem[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);

  // "Can't generate an invite link nor add members" — the invite link half
  // was actually a visibility bug (isAdmin always computed false, see the
  // `me` lookup above), but "add members" had no UI at all: the backend
  // action (apps/communities/views.py's add_members, POST .../add-members/)
  // and even the frontend ROUTES.community.addMembers constant already
  // existed — nothing in the app ever called it.
  const [addMembersModalVisible, setAddMembersModalVisible] = useState(false);
  const [addMembersContacts, setAddMembersContacts] = useState<KISContact[]>([]);
  const [addMembersContactsLoading, setAddMembersContactsLoading] = useState(false);
  const [addMembersSearch, setAddMembersSearch] = useState('');
  const [addMembersSubmitting, setAddMembersSubmitting] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadCommunity = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await getRequest(ROUTES.community.detail(communityId), {
        errorMessage: 'Failed to load community',
      });
      const detailData = detail?.data ?? detail ?? {};
      if (mountedRef.current) {
        setName(detailData.name ?? communityName);
        setAvatarUrl(detailData.avatar_url ?? detailData.avatarUrl ?? undefined);
        setDescription(detailData.description ?? '');
        setViewerRole(
          detailData.is_owner ? 'owner' : (detailData.current_user_role ?? null),
        );
      }

      // CONFIRMED ROOT CAUSE of "I can't see other members" for any
      // community past one page: this only ever fetched page 1
      // (membersRes?.data?.count was also reading the wrong shape - the
      // real pagination class, common.pagination.StandardResultsSetPagination,
      // nests it under meta.count/meta.total_pages, not a bare `count`/
      // `next`, so that check silently always fell through to the
      // page's own .length anyway). Members are ordered newest-first
      // (-joined_at), so the OWNER — who joined before everyone else —
      // sits on the LAST page, never fetched here before. Request the
      // max allowed page_size first; only loop for the rare community
      // that still exceeds it (bounded well past any realistic size, so
      // a malformed response can't spin forever).
      const allMembers: CommunityMember[] = [];
      let totalCount = 0;
      let page = 1;
      const MAX_PAGES = 50;
      while (page <= MAX_PAGES) {
        const membersRes = await getRequest(
          `${ROUTES.community.members(communityId)}?page_size=100&page=${page}`,
          { errorMessage: 'Failed to load members' },
        );
        const body = membersRes?.data ?? membersRes ?? {};
        const list = body.results ?? (Array.isArray(body) ? body : []);
        if (!Array.isArray(list) || list.length === 0) break;
        allMembers.push(...list);
        totalCount = typeof body?.meta?.count === 'number' ? body.meta.count : allMembers.length;
        const totalPages = body?.meta?.total_pages;
        if (typeof totalPages === 'number' ? page >= totalPages : list.length < 100) break;
        page += 1;
      }
      if (mountedRef.current) {
        setMembers(allMembers);
        setMemberCount(totalCount || allMembers.length);
      }

      const postsRes = await getRequest(`${ROUTES.community.posts}?community=${communityId}`, {
        errorMessage: 'Failed to load community posts',
      });
      const postList =
        postsRes?.data?.results ??
        postsRes?.results ??
        postsRes?.data ??
        postsRes ??
        [];
      if (mountedRef.current) {
        setPosts(Array.isArray(postList) ? postList : []);
      }

      const groupsRes = await getRequest(`${ROUTES.groups.list}?community=${communityId}`, {
        errorMessage: '',
      });
      const groupsList =
        groupsRes?.data?.results ??
        groupsRes?.results ??
        groupsRes?.data ??
        groupsRes ??
        [];
      if (mountedRef.current) {
        setCommunityGroups(
          Array.isArray(groupsList)
            ? groupsList.map((g: any) => ({ id: String(g.id), name: String(g.name ?? 'Group') }))
            : [],
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [communityId, communityName]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  // Live updates: another member's join/leave/ban/role-change or a new
  // post/comment nudges this screen (if open) to refetch instead of the
  // user having to manually pull-to-refresh. Same "event -> refetch"
  // pattern already used for main-tab badges (see AppNavigator.tsx),
  // scoped here to just this community's own room instead of globally.
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket || !communityId) return undefined;
    const events = [
      'community.member_joined',
      'community.member_left',
      'community.member_banned',
      'community.role_changed',
      'community.join_request_created',
      'community.join_request_decided',
      'community.settings_changed',
      'community.post_created',
      'community.post_updated',
      'community.post_deleted',
      'community.comment_created',
    ];
    const handler = (payload: any) => {
      if (String(payload?.communityId ?? '') !== String(communityId)) return;
      loadCommunity();
    };
    events.forEach((eventName) => socket.on(eventName, handler));
    // A socket that reconnects after being offline (backgrounded app, dead
    // wifi) doesn't get missed community.* events replayed - without this,
    // a screen left mounted through a disconnect would show stale state
    // indefinitely until the next live event happened to arrive. Same
    // reconnect->refetch pattern already used for main-tab badges.
    socket.on('connect', loadCommunity);
    return () => {
      events.forEach((eventName) => socket.off(eventName, handler));
      socket.off('connect', loadCommunity);
    };
  }, [socket, communityId, loadCommunity]);

  const resolveUserId = (member: CommunityMember): string => {
    const u = member.user;
    if (typeof u === 'object' && u && u.id) return String(u.id);
    if (typeof u === 'string' || typeof u === 'number') return String(u);
    return '';
  };

  // Was only matching object-shaped member.user (missing the string/number
  // ID shape resolveUserId already accounts for elsewhere in this file) -
  // a mismatch here silently made `me` always null, so isAdmin was always
  // false regardless of the viewer's real role, hiding invite-link/
  // member-management controls from actual owners/admins.
  const me = useMemo(() => {
    if (!currentUserId) return null;
    return members.find((m) => resolveUserId(m) === String(currentUserId)) ?? null;
  }, [members, currentUserId]);

  // CONFIRMED ROOT CAUSE of "as owner I still can't see community settings/
  // members/owner actions": `me` is found by scanning `members`, which is
  // only ever the FIRST page of CommunityViewSet.members (order_by
  // "-joined_at", i.e. newest-first) - this screen never fetches further
  // pages. For any community with more active members than one page
  // (PAGE_SIZE=25), the owner - who joined before everyone else, so has
  // the OLDEST joined_at - is sorted onto a LATER page that's never
  // fetched, making `me` null and isAdmin false regardless of their real
  // role. viewerRole comes from the community detail response's own
  // is_owner/current_user_role fields (CommunityDetailSerializer), a
  // direct per-request DB lookup with no pagination involved - prefer it,
  // falling back to the member-list scan only if the detail response
  // hasn't loaded yet.
  const role = String(viewerRole ?? me?.role ?? me?.base_role ?? '').toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin' || role === 'mod' || role === 'moderator';

  // "Admin" here always means admin of one of the community's own groups
  // (promote_member_to_group_admin on the backend sets both the group's
  // own GroupMembership/ConversationMember roles AND
  // CommunityMembership.role=admin in one call) - this prompts the owner
  // to pick which group when there's more than one, and promotes
  // directly when there's exactly one.
  const promoteToGroupAdmin = useCallback(async (userId: string, groupId: string) => {
    const res = await postRequest(
      ROUTES.community.promoteMemberToGroupAdmin(communityId),
      { user_id: userId, group_id: groupId },
      { errorMessage: 'Failed to promote member' },
    );
    if (res.success) {
      setMembers((prev) =>
        prev.map((m) =>
          resolveUserId(m) === userId ? { ...m, role: 'admin', base_role: 'admin' } : m,
        ),
      );
    } else {
      Alert.alert('Error', res.message || 'Unable to promote member.');
    }
  }, [communityId]);

  const promptPromoteToGroupAdmin = useCallback((userId: string, label: string) => {
    if (communityGroups.length === 1) {
      Alert.alert(
        'Promote to admin',
        `Make ${label} an admin of "${communityGroups[0].name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Promote', onPress: () => promoteToGroupAdmin(userId, communityGroups[0].id) },
        ],
      );
      return;
    }
    const groupNames = communityGroups.map((g) => g.name);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Make ${label} admin of which group?`,
          options: [...groupNames, 'Cancel'],
          cancelButtonIndex: groupNames.length,
        },
        (index) => {
          if (index < groupNames.length) {
            void promoteToGroupAdmin(userId, communityGroups[index].id);
          }
        },
      );
    } else {
      const buttons = communityGroups.map((g) => ({
        text: g.name,
        onPress: () => void promoteToGroupAdmin(userId, g.id),
      }));
      buttons.push({ text: 'Cancel', style: 'cancel' as any, onPress: () => {} } as any);
      Alert.alert(`Make ${label} admin of which group?`, undefined, buttons as any);
    }
  }, [communityGroups, promoteToGroupAdmin]);

  const handleMemberAction = (member: CommunityMember) => {
    const userId = resolveUserId(member);
    if (!userId) return;
    const label = member.display_name || resolveUserName(member.user) || 'Member';
    const memberRole = String(member.role ?? member.base_role ?? '').toLowerCase();
    const isOwner = memberRole === 'owner';
    // Django's CommunityRole only ever produces 'mod', never 'moderator' —
    // this previously never matched a real mod's role, so the action
    // sheet offered "Promote to admin" (promoting them further) instead
    // of "Demote from admin" for anyone already holding the mod role.
    const isMemberAdmin = memberRole === 'admin' || memberRole === 'owner' || memberRole === 'mod';

    const options: string[] = [];
    const actions: (() => void)[] = [];

    if (!isOwner) {
      options.push('Remove from community');
      actions.push(() => {
        Alert.alert(
          'Remove member',
          `Remove ${label} from this community? They can rejoin later.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                // members/remove is non-permanent - the member can rejoin
                // through the community's normal join_policy later. This
                // previously called ban() by mistake, which is permanent
                // until an admin explicitly unbans them.
                const res = await postRequest(ROUTES.community.removeMember(communityId), { user_id: userId }, {
                  errorMessage: 'Failed to remove member',
                });
                if (res.success) {
                  setMembers((prev) => prev.filter((m) => resolveUserId(m) !== userId));
                } else {
                  Alert.alert('Error', res.message || 'Unable to remove member.');
                }
              },
            },
          ],
        );
      });

      if (isMemberAdmin) {
        options.push('Demote from admin');
        actions.push(async () => {
          const res = await postRequest(
            ROUTES.community.setMemberRole(communityId),
            { user_id: userId, role: 'member' },
            { errorMessage: 'Failed to demote member' },
          );
          if (res.success) {
            setMembers((prev) =>
              prev.map((m) =>
                resolveUserId(m) === userId ? { ...m, role: 'member', base_role: 'member' } : m,
              ),
            );
          } else {
            Alert.alert('Error', res.message || 'Unable to demote member.');
          }
        });
      } else if (communityGroups.length > 0) {
        // No "Promote to admin" at all when the community has no groups
        // yet - there's nothing to scope an admin to (see
        // promoteToGroupAdmin's docstring above).
        options.push('Promote to admin');
        actions.push(() => promptPromoteToGroupAdmin(userId, label));
      }
    }

    options.push('Cancel');
    actions.push(() => {});

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: label,
          options,
          destructiveButtonIndex: 0,
          cancelButtonIndex: options.length - 1,
        },
        (index) => {
          actions[index]?.();
        },
      );
    } else {
      // Android fallback via Alert
      const alertButtons = options.slice(0, -1).map((opt, i) => ({
        text: opt,
        style: (i === 0 ? 'destructive' : 'default') as 'destructive' | 'default',
        onPress: () => actions[i]?.(),
      }));
      alertButtons.push({ text: 'Cancel', style: 'cancel' as any, onPress: () => {} });
      Alert.alert(label, 'Choose an action', alertButtons);
    }
  };

  const handleLeaveCommunity = () => {
    Alert.alert(
      'Leave community',
      'Are you sure you want to leave this community?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            // Leaving must close this info panel AND the community room
            // overlay underneath it (community.close_all, mirroring
            // chat.close_all's identical gap for groups/DMs), and refresh
            // the Messages list (conversation.refresh) - otherwise the
            // user stayed on this same screen with just the member list
            // locally filtered, and the community's room stayed fully
            // visible and composable despite the backend having already
            // deactivated both CommunityMembership and ConversationMember.
            const closeAndRefresh = () => {
              DeviceEventEmitter.emit('community.close_all');
              DeviceEventEmitter.emit('conversation.refresh');
              onBack?.();
            };
            try {
              await deleteRequest(ROUTES.community.leave(communityId), {
                errorMessage: 'Failed to leave community',
              });
              closeAndRefresh();
            } catch {
              // Some backends use POST for leave
              try {
                await postRequest(ROUTES.community.leave(communityId), {}, {
                  errorMessage: 'Failed to leave community',
                });
                closeAndRefresh();
              } catch (err2: any) {
                Alert.alert('Error', err2?.message || 'Unable to leave community.');
              }
            }
          },
        },
      ],
    );
  };

  const handleFetchInviteLink = async () => {
    if (!communityId || inviteLinkLoading) return;
    setInviteLinkLoading(true);
    try {
      const res = await postRequest(
        ROUTES.community.inviteLink(communityId),
        {},
        { errorMessage: 'Failed to generate invite link' },
      );
      const link = res?.data?.invite_link ?? res?.data?.url ?? null;
      if (link) {
        setInviteLink(String(link));
      } else {
        Alert.alert('Invite link', 'Could not retrieve an invite link.');
      }
    } catch {
      Alert.alert('Error', 'Failed to fetch invite link.');
    } finally {
      setInviteLinkLoading(false);
    }
  };

  useEffect(() => {
    if (!addMembersModalVisible) return;
    let cancelled = false;
    setAddMembersContactsLoading(true);
    refreshFromDeviceAndBackend()
      .then((contacts) => {
        if (cancelled) return;
        const existingUserIds = new Set(
          members.map((m) => (typeof m.user === 'object' ? m.user?.id : m.user)).filter(Boolean).map(String),
        );
        setAddMembersContacts(
          contacts.filter((c) => c.isRegistered && !!c.userId && !existingUserIds.has(String(c.userId))),
        );
      })
      .catch(() => { if (!cancelled) setAddMembersContacts([]); })
      .finally(() => { if (!cancelled) setAddMembersContactsLoading(false); });
    return () => { cancelled = true; };
  }, [addMembersModalVisible, members]);

  const filteredAddMembersContacts = useMemo(() => {
    const q = addMembersSearch.trim().toLowerCase();
    if (!q) return addMembersContacts;
    return addMembersContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [addMembersContacts, addMembersSearch]);

  const handleAddMember = async (contact: KISContact) => {
    if (!communityId || !contact.userId || addMembersSubmitting) return;
    setAddMembersSubmitting(true);
    try {
      const res = await postRequest(
        ROUTES.community.addMembers(communityId),
        { userIds: [contact.userId] },
        { errorMessage: 'Unable to add member.' },
      );
      if (res?.success !== false && (res?.data?.count ?? 0) > 0) {
        setAddMembersContacts((prev) => prev.filter((c) => c.userId !== contact.userId));
        await loadCommunity();
      } else if ((res?.data?.skipped_banned ?? []).length > 0) {
        Alert.alert('Add member', `${contact.name} can't be added (banned from this community).`);
      } else {
        Alert.alert('Add member', res?.message || 'Unable to add member.');
      }
    } catch {
      Alert.alert('Add member', 'Unable to add member.');
    } finally {
      setAddMembersSubmitting(false);
    }
  };

  const handleChangeAvatar = async () => {
    if (!isAdmin || saving) return;
    const picked = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    if (picked.didCancel) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('No image selected', 'Please pick a valid image.');
      return;
    }

    const token = await getAccessToken();
    const deviceId = await AsyncStorage.getItem('device_id');
    if (!token) {
      Alert.alert('Not signed in', 'Please log in again.');
      return;
    }

    const file = {
      uri: asset.uri,
      name: asset.fileName ?? 'community-avatar.jpg',
      type: asset.type ?? 'image/jpeg',
      size: asset.fileSize ?? undefined,
    };

    try {
      setSaving(true);
      const uploaded = await uploadFileToBackend({
        file,
        authToken: token,
        baseUrl: CHAT_BASE_URL,
      });

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (deviceId) headers['X-Device-Id'] = deviceId;

      const res = await apiService.patch(
        ROUTES.community.detail(communityId),
        { avatar_url: uploaded.url },
        headers
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.detail || data?.message || 'Unable to update community photo.'
        );
      }

      const nextAvatar = data?.avatar_url ?? uploaded.url;
      setAvatarUrl(nextAvatar);
    } catch (err: any) {
      Alert.alert(
        'Update failed',
        err?.message || 'Unable to update the community photo.'
      );
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = useCallback(() => {
    setEditName(name);
    setEditDescription(description);
    setEditModalVisible(true);
  }, [name, description]);

  const handleSaveEdit = useCallback(async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a community name.');
      return;
    }
    setEditSaving(true);
    try {
      const res = await patchRequest(
        ROUTES.community.detail(communityId),
        { name: trimmedName, description: editDescription },
        { errorMessage: 'Failed to update community' },
      );
      if (res?.success) {
        setName(trimmedName);
        setDescription(editDescription);
        setEditModalVisible(false);
      } else {
        Alert.alert('Update failed', res?.message || 'Unable to update community.');
      }
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Unable to update community.');
    } finally {
      setEditSaving(false);
    }
  }, [communityId, editName, editDescription]);

  const loadJoinRequests = useCallback(async () => {
    setJoinRequestsLoading(true);
    try {
      const res = await getRequest(ROUTES.community.joinRequests(communityId), { errorMessage: '' });
      const list = res?.data?.results ?? res?.data ?? [];
      if (mountedRef.current) setJoinRequests(Array.isArray(list) ? list : []);
    } catch {
      if (mountedRef.current) setJoinRequests([]);
    } finally {
      if (mountedRef.current) setJoinRequestsLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (isAdmin) void loadJoinRequests();
    // Also refreshed by the community.join_request_created/_decided socket
    // listener above (via loadCommunity -> ... no, that doesn't cover
    // this list) - re-run whenever a join-request event fires for this
    // community while this screen is open.
  }, [isAdmin, loadJoinRequests]);

  useEffect(() => {
    if (!socket || !communityId || !isAdmin) return undefined;
    const handler = (payload: any) => {
      if (String(payload?.communityId ?? '') !== String(communityId)) return;
      void loadJoinRequests();
    };
    socket.on('community.join_request_created', handler);
    socket.on('community.join_request_decided', handler);
    return () => {
      socket.off('community.join_request_created', handler);
      socket.off('community.join_request_decided', handler);
    };
  }, [socket, communityId, isAdmin, loadJoinRequests]);

  const handleDecideJoinRequest = useCallback(async (request: CommunityJoinRequestItem, approve: boolean) => {
    const route = approve ? ROUTES.community.approveRequest(communityId) : ROUTES.community.rejectRequest(communityId);
    const res = await postRequest(route, { request_id: request.id }, {
      errorMessage: approve ? 'Failed to approve request' : 'Failed to reject request',
    });
    if (res?.success) {
      setJoinRequests((prev) => prev.filter((r) => r.id !== request.id));
      if (approve) await loadCommunity();
    } else {
      Alert.alert('Error', res?.message || 'Unable to process this request.');
    }
  }, [communityId, loadCommunity]);

  const handleDeletePost = useCallback((post: CommunityPost) => {
    Alert.alert('Delete post?', 'This removes the post from the community feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await postRequest(ROUTES.community.postDelete(post.id), {}, {
              errorMessage: 'Failed to delete post',
            });
            setPosts((items) => items.filter((item) => item.id !== post.id));
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message || 'Unable to delete post.');
          }
        },
      },
    ]);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: palette.divider }]}>
        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: palette.selectedBg, borderColor: palette.inputBorder }]}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
        >
          <KISIcon name="close" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          Community info
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <ImagePlaceholder size={88} radius={44} style={styles.avatar} />
          )}
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {name}
          </Text>
          {description ? (
            <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={2}>
              {description}
            </Text>
          ) : null}

          {isAdmin && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable
                onPress={handleChangeAvatar}
                style={({ pressed }) => [
                  styles.editButton,
                  {
                    backgroundColor: palette.primary,
                    opacity: pressed || saving ? 0.7 : 1,
                  },
                ]}
              >
                <KISIcon name="camera" size={16} color={palette.onPrimary} />
                <Text style={[styles.editButtonText, { color: palette.onPrimary }]}>
                  {saving ? 'Updating...' : 'Change photo'}
                </Text>
              </Pressable>
              <Pressable
                onPress={openEditModal}
                style={({ pressed }) => [
                  styles.editButton,
                  {
                    borderWidth: 1,
                    borderColor: palette.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <KISIcon name="edit" size={16} color={palette.text} />
                <Text style={[styles.editButtonText, { color: palette.text }]}>
                  Edit name & description
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Members{memberCount > 0 ? ` (${memberCount})` : ''}
          </Text>
          {loading ? (
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              Loading members...
            </Text>
          ) : members.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No members found.
            </Text>
          ) : (
            members.map((m, index) => {
              const label = m.display_name || resolveUserName(m.user) || 'Member';
              const phone = resolveUserPhone(m.user);
              const memberId = resolveUserId(m);
              const memberRole = String(m.role ?? m.base_role ?? '').toLowerCase();
              const isOwnerMember = memberRole === 'owner';
              // Django's CommunityRole only ever produces 'mod', never
              // 'moderator' - matches isMemberAdmin's own mapping in
              // handleMemberAction above.
              const isAdminMember = memberRole === 'admin' || memberRole === 'mod';
              const isMe = memberId && memberId === String(currentUserId ?? '');
              const initials = label.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
              const badgeColor = isOwnerMember ? '#F59E0B' : palette.primary;
              return (
                <View
                  key={`${typeof m.user === 'object' && m.user ? m.user.id : index}`}
                  style={[
                    styles.memberRow,
                    { backgroundColor: palette.card, borderColor: palette.divider },
                    KIS_TOKENS.elevation.card,
                  ]}
                >
                  <WorkStatusRing size={44} workStatus={(typeof m.user === 'object' ? (m.user as any)?.profile?.work_status : undefined)}>
                    <View style={[styles.memberAvatar, { backgroundColor: palette.surfaceSoft ?? palette.surface, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: palette.subtext, fontSize: 15, fontWeight: '700' }}>{initials}</Text>
                    </View>
                  </WorkStatusRing>
                  <View style={styles.memberInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.memberName, { color: palette.text }]} numberOfLines={1}>
                        {label}
                      </Text>
                      {isMe && (
                        <View style={[styles.youPill, { backgroundColor: palette.surfaceSoft ?? palette.surface }]}>
                          <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: '700' }}>YOU</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.memberRole, { color: palette.subtext }]} numberOfLines={1}>
                      {phone || 'No phone'}
                    </Text>
                  </View>
                  {(isOwnerMember || isAdminMember) && (
                    <View style={[styles.roleBadge, { backgroundColor: badgeColor + '1F', borderColor: badgeColor + '40' }]}>
                      <KISIcon name={isOwnerMember ? 'crown' : 'shield'} size={12} color={badgeColor} />
                      <Text style={{ color: badgeColor, fontSize: 11, fontWeight: '700' }}>
                        {isOwnerMember ? 'Owner' : 'Admin'}
                      </Text>
                    </View>
                  )}
                  {isAdmin && !isMe && !isOwnerMember && (
                    <Pressable
                      onPress={() => handleMemberAction(m)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Actions for ${label}`}
                      style={styles.memberActionBtn}
                    >
                      <KISIcon name="menu" size={18} color={palette.subtext} />
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>

        {isAdmin ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Manage posts
            </Text>
            {posts.length === 0 ? (
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                No community posts.
              </Text>
            ) : (
              posts.map((post) => (
                <View
                  key={post.id}
                  style={[styles.postRow, { borderBottomColor: palette.divider }]}
                >
                  <View style={styles.postInfo}>
                    <Text style={[styles.postAuthor, { color: palette.text }]} numberOfLines={1}>
                      {post.author?.display_name || 'Member'}
                    </Text>
                    <Text style={[styles.postPreview, { color: palette.subtext }]} numberOfLines={2}>
                      {getFeedPlainText(post) || 'Media post'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDeletePost(post)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete post"
                    style={styles.memberActionBtn}
                  >
                    <KISIcon name="trash" size={18} color={palette.danger} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : null}

        {isAdmin && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Join requests{joinRequests.length > 0 ? ` (${joinRequests.length})` : ''}
            </Text>
            {joinRequestsLoading ? (
              <Text style={[styles.emptyText, { color: palette.subtext }]}>Loading...</Text>
            ) : joinRequests.length === 0 ? (
              <Text style={[styles.emptyText, { color: palette.subtext }]}>No pending requests.</Text>
            ) : (
              joinRequests.map((req) => {
                const label = resolveUserName(req.user) || 'User';
                return (
                  <View
                    key={String(req.id)}
                    style={[styles.memberRow, { backgroundColor: palette.card, borderColor: palette.divider }, KIS_TOKENS.elevation.card]}
                  >
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: palette.text }]} numberOfLines={1}>
                        {label}
                      </Text>
                      {req.message ? (
                        <Text style={[styles.memberRole, { color: palette.subtext }]} numberOfLines={2}>
                          {req.message}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleDecideJoinRequest(req, true)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Approve ${label}`}
                      style={[styles.inviteLinkBtn, { backgroundColor: palette.primary, marginRight: 6 }]}
                    >
                      <Text style={[styles.inviteLinkBtnText, { color: palette.onPrimary }]}>Approve</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDecideJoinRequest(req, false)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Reject ${label}`}
                      style={[styles.inviteLinkBtn, { borderWidth: 1, borderColor: palette.danger }]}
                    >
                      <Text style={[styles.inviteLinkBtnText, { color: palette.danger }]}>Reject</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        )}

        {isAdmin && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Invite link</Text>
            {inviteLink ? (
              <View>
                <Text
                  selectable
                  style={{ fontSize: 12, color: palette.subtext, marginBottom: 8, fontFamily: 'monospace' }}
                  numberOfLines={2}
                >
                  {inviteLink}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => { Clipboard.setString(inviteLink); Alert.alert('Copied', 'Invite link copied.'); }}
                    style={({ pressed }) => [styles.inviteLinkBtn, { backgroundColor: palette.primary, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.inviteLinkBtnText, { color: palette.onPrimary }]}>Copy</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => Share.share({ message: inviteLink }).catch(() => {})}
                    style={({ pressed }) => [styles.inviteLinkBtn, { borderWidth: 1, borderColor: palette.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.inviteLinkBtnText, { color: palette.text }]}>Share</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowInviteQr(true)}
                    style={({ pressed }) => [styles.inviteLinkBtn, { borderWidth: 1, borderColor: palette.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.inviteLinkBtnText, { color: palette.text }]}>QR</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { setInviteLink(null); handleFetchInviteLink(); }}
                    style={({ pressed }) => [styles.inviteLinkBtn, { borderWidth: 1, borderColor: palette.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.inviteLinkBtnText, { color: palette.text }]}>Reset</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={handleFetchInviteLink}
                style={({ pressed }) => [styles.inviteLinkBtn, { backgroundColor: palette.primary, opacity: pressed || inviteLinkLoading ? 0.7 : 1 }]}
              >
                <Text style={[styles.inviteLinkBtnText, { color: palette.onPrimary }]}>
                  {inviteLinkLoading ? 'Loading...' : 'Generate invite link'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {isAdmin && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Add members</Text>
            <Pressable
              onPress={() => { setAddMembersSearch(''); setAddMembersModalVisible(true); }}
              style={({ pressed }) => [styles.inviteLinkBtn, { backgroundColor: palette.primary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.inviteLinkBtnText, { color: palette.onPrimary }]}>Add members</Text>
            </Pressable>
          </View>
        )}

        {/* Leave community — shown to non-owner members */}
        {me && role !== 'owner' && (
          <View style={[styles.section, { paddingTop: 24 }]}>
            <Pressable
              onPress={handleLeaveCommunity}
              style={({ pressed }) => [
                styles.leaveButton,
                {
                  backgroundColor: pressed ? (palette.dangerSoft ?? '#ffeaea') : 'transparent',
                  borderColor: palette.danger,
                },
              ]}
            >
              <KISIcon name="arrow-left" size={16} color={palette.danger} />
              <Text style={[styles.leaveButtonText, { color: palette.danger }]}>
                Leave community
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <QrCodeShareModal
        visible={showInviteQr}
        onClose={() => setShowInviteQr(false)}
        link={inviteLink ?? ''}
        title="Community QR code"
        subtitle="Anyone who scans this can join the community."
      />

      <Modal
        visible={addMembersModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddMembersModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onPress={() => setAddMembersModalVisible(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{ width: '100%', maxHeight: '80%', borderRadius: 20, backgroundColor: palette.surface ?? palette.card, padding: 24, gap: 16 }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Add members</Text>
            <Text style={{ fontSize: 13, color: palette.subtext }}>Pick a contact with a KIS account to add to this community.</Text>
            <TextInput
              value={addMembersSearch}
              onChangeText={setAddMembersSearch}
              placeholder="Search contacts by name or phone"
              placeholderTextColor={palette.subtext}
              style={{
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: palette.divider ?? palette.border,
                backgroundColor: palette.inputBg ?? palette.bg,
                color: palette.text,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 15,
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {addMembersContactsLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={palette.primary} />
              </View>
            ) : filteredAddMembersContacts.length === 0 ? (
              <Text style={{ color: palette.subtext, fontSize: 13, paddingVertical: 12 }}>
                {addMembersContacts.length === 0
                  ? 'No contacts on this device have a KIS account (or they’re already members).'
                  : 'No contacts match your search.'}
              </Text>
            ) : (
              <FlatList
                data={filteredAddMembersContacts}
                keyExtractor={(c) => c.userId ?? c.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleAddMember(item)}
                    disabled={addMembersSubmitting}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: palette.divider ?? palette.border,
                      opacity: pressed || addMembersSubmitting ? 0.6 : 1,
                    })}
                  >
                    <View>
                      <Text style={{ color: palette.text, fontSize: 15, fontWeight: '600' }}>{item.name}</Text>
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>{item.phone}</Text>
                    </View>
                    <KISIcon name="add" size={20} color={palette.primary} />
                  </Pressable>
                )}
              />
            )}
            <Pressable
              onPress={() => setAddMembersModalVisible(false)}
              style={({ pressed }) => ({ paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: palette.divider ?? palette.border, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ color: palette.text, fontSize: 15, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onPress={() => setEditModalVisible(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{ width: '100%', maxHeight: '80%', borderRadius: 20, backgroundColor: palette.surface ?? palette.card, padding: 24, gap: 14 }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Edit community</Text>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: palette.subtext, marginBottom: 6 }}>Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Community name"
                placeholderTextColor={palette.subtext}
                style={{
                  borderWidth: 1,
                  borderColor: palette.border ?? palette.divider,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: palette.text,
                  fontSize: 15,
                }}
              />
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: palette.subtext, marginBottom: 6 }}>Description</Text>
              <TextInput
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="What's this community about?"
                placeholderTextColor={palette.subtext}
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1,
                  borderColor: palette.border ?? palette.divider,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: palette.text,
                  fontSize: 15,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />
            </View>
            <Pressable
              onPress={handleSaveEdit}
              disabled={editSaving}
              style={({ pressed }) => ({
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: palette.primary,
                alignItems: 'center',
                opacity: pressed || editSaving ? 0.7 : 1,
              })}
            >
              <Text style={{ color: palette.onPrimary, fontSize: 15, fontWeight: '700' }}>
                {editSaving ? 'Saving...' : 'Save changes'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setEditModalVisible(false)}
              style={({ pressed }) => ({ paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: palette.divider ?? palette.border, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ color: palette.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  content: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 10, fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 6, fontSize: 13, textAlign: 'center' },
  editButton: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButtonText: { fontSize: 12, fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 13 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 22 },
  memberInfo: { marginLeft: 12, flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberRole: { fontSize: 12, marginTop: 2 },
  memberActionBtn: { padding: 6, marginLeft: 4 },
  youPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 8,
  },
  postRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: 10,
  },
  postInfo: { flex: 1, paddingRight: 10 },
  postAuthor: { fontSize: 13, fontWeight: '600' },
  postPreview: { fontSize: 12, marginTop: 3 },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  leaveButtonText: { fontSize: 14, fontWeight: '600' },
  inviteLinkBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  inviteLinkBtnText: { fontSize: 13, fontWeight: '600' },
});

export default CommunityInfoPage;
