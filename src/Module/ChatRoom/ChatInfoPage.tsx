import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  DeviceEventEmitter,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKISTheme } from '../../theme/useTheme';
import { useResponsiveLayout } from '../../theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import type { Chat, ParticipantWire, UserWire } from './messagesUtils';
import { directConversationAvatar, participantsToIds } from './messagesUtils';
import ROUTES, { CHAT_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { handleRemoveGroupMember } from './ChatRoomHandlers';
import { loadMessages } from './Storage/chatStorage';
import apiService from '@/services/apiService';
import { uploadFileToBackend } from './uploadFileToBackend';
import Skeleton from '@/components/common/Skeleton';
import { getAccessToken } from '@/security/authStorage';
import { useSocket } from '../../../SocketProvider';

type ChatInfoPageProps = {
  chat: Chat;
  currentUserId: string | null;
  onBack: () => void;
  onChatUpdated?: (chat: Chat) => void;
};

const resolveUserId = (user?: UserWire | number | string | null) => {
  if (!user) return null;
  if (typeof user === 'string' || typeof user === 'number') {
    return String(user);
  }
  return user.id ? String(user.id) : null;
};

const resolveUserName = (user?: UserWire | number | string | null) => {
  if (!user) return '';
  if (typeof user === 'string' || typeof user === 'number') {
    return String(user);
  }
  return (
    user.display_name ||
    user.username ||
    user.phone ||
    user.id ||
    ''
  );
};

const resolveUserPhone = (user?: UserWire | number | string | null) => {
  if (!user || typeof user === 'string' || typeof user === 'number') return '';
  return user.phone || '';
};

export const ChatInfoPage: React.FC<ChatInfoPageProps> = ({
  chat,
  currentUserId,
  onBack,
  onChatUpdated,
}) => {
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { startCall, socket } = useSocket();

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    chat.avatarUrl ||
      directConversationAvatar(chat.participants ?? [], currentUserId ?? undefined) ||
      undefined,
  );
  const [saving, setSaving] = useState(false);
  const [memberList, setMemberList] = useState<ParticipantWire[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [publicProfile, setPublicProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [statusHas, setStatusHas] = useState(false);
  const [statusHasUnseen, setStatusHasUnseen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<{ uri: string } | null>(null);
  const [avatarPreviewFull, setAvatarPreviewFull] = useState(false);
  const avatarAnim = useMemo(() => new Animated.Value(0), []);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [groupIdFetchDone, setGroupIdFetchDone] = useState(
    !!(chat.groupId ?? (chat as any).group_id),
  );
  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState<string>(
    (chat as any).description ?? '',
  );
  const [savingDescription, setSavingDescription] = useState(false);

  // Group settings toggles
  const [reactionsAdminOnly, setReactionsAdminOnly] = useState(false);
  const [messagingRestricted, setMessagingRestricted] = useState(
    !!(chat as any).messagingRestricted || !!(chat as any).messaging_restricted,
  );
  const [editInfoRestricted, setEditInfoRestricted] = useState(
    !!(chat as any).editInfoRestricted || !!(chat as any).edit_info_restricted,
  );
  const [approvalRequired, setApprovalRequired] = useState(
    !!(chat as any).approvalRequired || !!(chat as any).approval_required,
  );

  // Group name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState<string>(chat.name ?? '');
  const [savingName, setSavingName] = useState(false);

  // ── Media browser ──────────────────────────────────────────────────────────
  type MediaTab = 'Images' | 'Files' | 'Links';
  type MediaItem = { id: string; url: string; kind: string; name?: string; mimeType?: string; size?: number; sentAt?: string };
  type LinkItem  = { url: string; title?: string; description?: string; image?: string; site_name?: string; sentAt?: string };

  const [mediaTab, setMediaTab]         = useState<MediaTab>('Images');
  const [mediaImages, setMediaImages]   = useState<MediaItem[]>([]);
  const [mediaFiles, setMediaFiles]     = useState<MediaItem[]>([]);
  const [mediaLinks, setMediaLinks]     = useState<LinkItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [showAllImages, setShowAllImages] = useState(false);
  const [showAllFiles, setShowAllFiles]   = useState(false);
  const [showAllLinks, setShowAllLinks]   = useState(false);

  useEffect(() => {
    const roomId = String(chat.conversationId ?? chat.id ?? '');
    if (!roomId) { setMediaLoading(false); return; }
    setMediaLoading(true);
    loadMessages(roomId, currentUserId).then((msgs) => {
      const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
      const imgs: MediaItem[] = [];
      const files: MediaItem[] = [];
      const links: LinkItem[]  = [];
      const seenLinks = new Set<string>();

      for (const msg of msgs) {
        const atts = msg.attachments ?? [];
        for (const att of atts) {
          const kind = att.kind ?? '';
          const item: MediaItem = { id: att.id, url: att.url, kind, name: att.originalName, mimeType: att.mimeType, size: att.size, sentAt: (msg as any).createdAt };
          if (kind === 'image' || kind === 'video') imgs.push(item);
          else files.push(item);
        }

        if (!atts.length) {
          const k: string = (msg.kind as string | undefined) ?? '';
          const url: string = (msg as any).url ?? (msg as any).mediaUrl ?? '';
          if (k === 'image' || k === 'video') {
            if (url) imgs.push({ id: msg.id, url, kind: k, sentAt: (msg as any).createdAt });
          } else if (k === 'file' || k === 'audio' || k === 'voice') {
            if (url) files.push({ id: msg.id, url, kind: k, name: (msg as any).fileName, sentAt: (msg as any).createdAt });
          }
        }

        const lp = (msg as any).linkPreview;
        if (lp?.url && !seenLinks.has(lp.url)) {
          seenLinks.add(lp.url);
          links.push({ url: lp.url, title: lp.title, description: lp.description, image: lp.image, site_name: lp.site_name, sentAt: (msg as any).createdAt });
        } else if ((msg.kind === 'text' || !msg.kind) && !lp) {
          const matches = ((msg as any).text ?? '').match(URL_RE) as string[] | null;
          if (matches) {
            for (const u of [...new Set(matches)]) {
              if (!seenLinks.has(u)) { seenLinks.add(u); links.push({ url: u, sentAt: (msg as any).createdAt }); }
            }
          }
        }
      }

      setMediaImages(imgs.reverse());
      setMediaFiles(files.reverse());
      setMediaLinks(links.reverse());
    }).catch(() => {}).finally(() => setMediaLoading(false));
  }, [chat.conversationId, chat.id, currentUserId]);

  const isGroup =
    chat.isGroupChat || chat.isGroup || chat.kind === 'group';

  if (__DEV__) console.log('ChatInfoPage rendered for chat:', chat);

  const participants = useMemo(() => {
    if (!Array.isArray(chat.participants)) return [];
    return chat.participants as ParticipantWire[];
  }, [chat.participants]);

  const [resolvedGroupId, setResolvedGroupId] = useState<string | null>(
    chat.groupId ? String(chat.groupId) : ((chat as any).group_id ? String((chat as any).group_id) : null),
  );
  const groupId = resolvedGroupId;

  const conversationId = String(chat.conversationId ?? chat.id ?? '');

  useEffect(() => {
    if (!isGroup || resolvedGroupId || !conversationId) return;
    getRequest(ROUTES.chat.conversationDetail(conversationId)).then((res) => {
      const raw = res?.data ?? res;
      const gid = raw?.group_id ?? raw?.groupId;
      if (gid) setResolvedGroupId(String(gid));
    }).finally(() => {
      setGroupIdFetchDone(true);
    });
  }, [isGroup, resolvedGroupId, conversationId]);

  const directContact = useMemo(() => {
    if (isGroup) return null;
    const meId = currentUserId ? String(currentUserId) : null;
    const other = participants.find((p) => {
      const userId = resolveUserId(p.user);
      return !meId || (userId && userId !== meId);
    });
    return other ?? null;
  }, [participants, isGroup, currentUserId]);

  const contactUserId = useMemo(() => {
    if (!directContact?.user) return null;
    return resolveUserId(directContact.user);
  }, [directContact]);

  const roomId = String(chat.conversationId ?? chat.id ?? '');

  // GAP 3 (new): load reactionsAdminOnly from AsyncStorage
  useEffect(() => {
    if (!roomId) return;
    AsyncStorage.getItem(`KIS_REACTIONS_ADMIN_ONLY_${roomId}`)
      .then((val) => { if (val === 'true') setReactionsAdminOnly(true); })
      .catch(() => {});
  }, [roomId]);

  const handleStartCall = async (media: 'voice' | 'video') => {
    if (!startCall) {
      Alert.alert('Call unavailable', 'Calling is not ready yet.');
      return;
    }
    const conversationId = String(chat.conversationId ?? chat.id ?? '');
    if (!conversationId) {
      Alert.alert('Call unavailable', 'Conversation is not ready yet.');
      return;
    }
    const inviteeUserIds = participantsToIds(chat.participants ?? []).filter(
      (id) => String(id) !== String(currentUserId ?? ''),
    );
    await startCall({
      conversationId,
      title: chat.name ?? 'Call',
      media,
      inviteeUserIds,
    });
  };

  useEffect(() => {
    const nextAvatar = chat.avatarUrl ? String(chat.avatarUrl) : '';
    if (nextAvatar.trim()) {
      setAvatarUrl(nextAvatar);
    }
  }, [chat.avatarUrl]);

  useEffect(() => {
    if (isGroup || !contactUserId) return;
    let active = true;
    const loadStatusSummary = async () => {
      try {
        const res = await getRequest(`${ROUTES.statuses.list}?userIds=${contactUserId}`);
        const list = Array.isArray(res?.data?.results) ? res.data.results : [];
        const entry = list.find((item: any) => String(item?.user?.id ?? '') === String(contactUserId));
        if (!active) return;
        const items = Array.isArray(entry?.items) ? entry.items : [];
        const hasStatus = items.length > 0;
        const hasUnseen =
          typeof entry?.has_unseen === 'boolean'
            ? entry.has_unseen
            : items.some((item: any) => !item.viewed);
        setStatusHas(hasStatus);
        setStatusHasUnseen(hasStatus ? hasUnseen : false);
      } catch {
        if (!active) return;
        setStatusHas(false);
        setStatusHasUnseen(false);
      }
    };
    loadStatusSummary();
    return () => {
      active = false;
    };
  }, [isGroup, contactUserId]);

  useEffect(() => {
    if (!avatarPreview) return;
    avatarAnim.setValue(0);
    Animated.timing(avatarAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [avatarPreview, avatarAnim]);

  useEffect(() => {
    if (isGroup) return;
    if (avatarUrl && String(avatarUrl).trim()) return;
    const nextAvatar =
      (directContact?.user as any)?.profile?.avatar_url ??
      (directContact?.user as any)?.profile?.avatarUrl ??
      (directContact?.user as any)?.avatar_url ??
      (directContact?.user as any)?.avatarUrl ??
      directConversationAvatar(chat.participants ?? [], currentUserId ?? undefined);
    if (nextAvatar) {
      setAvatarUrl(String(nextAvatar));
    }
  }, [isGroup, directContact, avatarUrl, chat.participants, currentUserId]);

  useEffect(() => {
    let active = true;
    const loadMembers = async () => {
      if (!isGroup || !groupId) return;
      setMembersLoading(true);
      try {
        const res = await getRequest(ROUTES.groups.members(groupId), {
          errorMessage: 'Failed to load group members',
        });
        const list =
          res?.data?.results ??
          res?.results ??
          res?.data ??
          res ??
          [];
        if (active) {
          setMemberList(Array.isArray(list) ? list : []);
        }
      } finally {
        if (active) setMembersLoading(false);
      }
    };
    loadMembers();
    return () => {
      active = false;
    };
  }, [isGroup, groupId]);

  const me = useMemo(() => {
    const meId = currentUserId ? String(currentUserId) : null;
    if (!meId) return null;
    return participants.find((p) => {
      const userId = resolveUserId(p.user);
      return userId && userId === meId;
    }) ?? null;
  }, [participants, currentUserId]);

  const role = String(me?.base_role ?? '').toLowerCase();
  const isOwner = role === 'owner';
  const isAdmin = isOwner || role === 'admin' || role === 'moderator';

  // ── Setting toggle helper ─────────────────────────────────────────────────
  const emitGroupSetting = (key: string, value: boolean) => {
    try { socket?.emit('group.update_settings', { roomId, [key]: value }); } catch {}
  };

  const patchConversationSettings = async (payload: Record<string, unknown>) => {
    try {
      await postRequest(ROUTES.chat.updateSettings(conversationId), payload, {});
    } catch { /* best-effort */ }
  };

  const handleToggleSetting = async (
    key: string,
    current: boolean,
    setter: (v: boolean) => void,
  ) => {
    if (!isAdmin) return;
    const next = !current;
    setter(next);
    emitGroupSetting(key, next);
    await patchConversationSettings({ [key]: next });
  };

  // ── Save group name ────────────────────────────────────────────────────────
  const handleSaveGroupName = async () => {
    if (!groupId || !isAdmin || !nameInput.trim()) return;
    setSavingName(true);
    try {
      const token = await getAccessToken();
      const deviceId = await AsyncStorage.getItem('device_id');
      const headers: Record<string, string> = { Authorization: `Bearer ${token ?? ''}` };
      if (deviceId) headers['X-Device-Id'] = deviceId;
      const res = await apiService.patch(ROUTES.groups.detail(groupId), { name: nameInput.trim() }, headers);
      if (!res.ok) throw new Error();
      onChatUpdated?.({ ...chat, name: nameInput.trim() });
      setEditingName(false);
    } catch {
      Alert.alert('Error', 'Could not save group name.');
    } finally {
      setSavingName(false);
    }
  };

  // ── Ban member ────────────────────────────────────────────────────────────
  const handleBanMember = async (p: ParticipantWire) => {
    const userId = resolveUserId(p.user);
    if (!userId || !groupId || !isAdmin) return;
    const name = resolveUserName(p.user) || 'this member';
    Alert.alert(
      `Ban ${name}?`,
      'They will be removed and prevented from rejoining via invite link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            try {
              await postRequest(ROUTES.groups.ban(groupId), { user_id: userId }, {});
              setMemberList(prev => prev.filter(m => resolveUserId(m.user) !== userId));
            } catch {
              Alert.alert('Error', 'Could not ban member.');
            }
          },
        },
      ],
    );
  };

  // ── Transfer ownership ────────────────────────────────────────────────────
  const handleTransferOwnership = (p: ParticipantWire) => {
    if (!isOwner) return;
    const userId = resolveUserId(p.user);
    const name = resolveUserName(p.user) || 'this member';
    if (!userId) return;
    Alert.alert(
      'Transfer ownership',
      `Make ${name} the new group owner? You will become an admin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            try {
              const convId = conversationId;
              await postRequest(ROUTES.chat.setMemberRole(convId), { user_id: userId, base_role: 'owner' }, {});
              await postRequest(ROUTES.chat.setMemberRole(convId), { user_id: currentUserId, base_role: 'admin' }, {});
              setMemberList(prev =>
                prev.map(m => {
                  const mId = resolveUserId(m.user);
                  if (mId === userId) return { ...m, base_role: 'owner' };
                  if (mId === currentUserId) return { ...m, base_role: 'admin' };
                  return m;
                }),
              );
            } catch {
              Alert.alert('Error', 'Could not transfer ownership.');
            }
          },
        },
      ],
    );
  };

  const handleChangeAvatar = async () => {
    if (!isGroup || !isAdmin) return;
    if (saving) return;
    if (!groupId) {
      Alert.alert('Missing group', 'This group is missing an id.');
      return;
    }

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
      name: asset.fileName ?? 'group-avatar.jpg',
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
        ROUTES.groups.detail(groupId),
        { avatar_url: uploaded.url },
        headers
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.detail || data?.message || 'Unable to update group photo.'
        );
      }

      const nextAvatar = data?.avatar_url ?? uploaded.url;
      setAvatarUrl(nextAvatar);
      onChatUpdated?.({ ...chat, avatarUrl: nextAvatar });
    } catch (err: any) {
      Alert.alert(
        'Update failed',
        err?.message || 'Unable to update the group photo.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFetchInviteLink = async () => {
    if (!groupId || inviteLinkLoading) return;
    setInviteLinkLoading(true);
    try {
      const res = await postRequest(
        ROUTES.groups.inviteLink(groupId),
        {},
        { errorMessage: 'Failed to generate invite link' },
      );
      const link =
        res?.data?.link ??
        res?.data?.invite_link ??
        res?.data?.url ??
        (typeof res?.data === 'string' ? res.data : null);
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

  const handleSetMemberRole = async (memberId: string, userId: string, newRole: string) => {
    const conversationId = String(chat.conversationId ?? chat.id ?? '');
    if (!conversationId || !userId || roleChanging) return;
    setRoleChanging(userId);
    try {
      await postRequest(ROUTES.chat.setMemberRole(conversationId), { user_id: userId, base_role: newRole }, {});
      setMemberList(prev =>
        prev.map(m => {
          const mId = resolveUserId(m.user);
          return mId === userId ? { ...m, base_role: newRole } : m;
        }),
      );
    } catch {
      Alert.alert('Error', 'Could not change member role.');
    } finally {
      setRoleChanging(null);
    }
  };

  const handleLeaveGroup = () => {
    if (!groupId) return;
    Alert.alert(
      'Leave group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await postRequest(ROUTES.groups.leave(groupId), {}, {});
              onBack?.();
            } catch {
              Alert.alert('Error', 'Could not leave the group. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteGroup = () => {
    if (!groupId) return;
    Alert.alert(
      'Delete group',
      'This will permanently delete the group and all its messages for everyone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAccessToken();
              const deviceId = await AsyncStorage.getItem('device_id');
              const headers: Record<string, string> = {
                Authorization: `Bearer ${token}`,
              };
              if (deviceId) headers['X-Device-Id'] = deviceId;
              const res = await apiService.delete(ROUTES.groups.detail(groupId), headers);
              if (!res.ok) throw new Error();
              onBack?.();
            } catch {
              Alert.alert('Error', 'Could not delete the group. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleSaveDescription = async () => {
    if (!groupId || !isAdmin) return;
    setSavingDescription(true);
    try {
      const token = await getAccessToken();
      const deviceId = await AsyncStorage.getItem('device_id');
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (deviceId) headers['X-Device-Id'] = deviceId;
      const res = await apiService.patch(
        ROUTES.groups.detail(groupId),
        { description: descriptionInput },
        headers,
      );
      if (!res.ok) throw new Error();
      onChatUpdated?.({ ...chat, description: descriptionInput } as any);
      setEditingDescription(false);
    } catch {
      Alert.alert('Error', 'Could not save description. Please try again.');
    } finally {
      setSavingDescription(false);
    }
  };

  const showMemberActions = (p: ParticipantWire) => {
    const userId = resolveUserId(p.user);
    if (!userId || !isAdmin) return;
    if (userId === currentUserId) return;

    const targetRole = String(p.base_role ?? 'member').toLowerCase();
    const isTargetOwner = targetRole === 'owner';
    const isTargetAdmin = targetRole === 'admin' || isTargetOwner;
    const memberId = String(p.id ?? userId);
    const name = resolveUserName(p.user) || 'Member';
    const convId = conversationId;

    const removeAction = {
      text: 'Remove from group',
      style: 'destructive' as const,
      onPress: () =>
        Alert.alert('Remove member', `Remove ${name} from the group?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await handleRemoveGroupMember({ conversationId: convId, userId });
                setMemberList(prev => prev.filter(m => resolveUserId(m.user) !== userId));
              } catch {
                Alert.alert('Error', 'Could not remove member.');
              }
            },
          },
        ]),
    };

    const options: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [];

    if (!isTargetOwner) {
      options.push(
        isTargetAdmin
          ? { text: 'Demote to member', onPress: () => void handleSetMemberRole(memberId, userId, 'member') }
          : { text: 'Promote to admin', onPress: () => void handleSetMemberRole(memberId, userId, 'admin') },
      );
    }

    if (isOwner && !isTargetOwner) {
      options.push({ text: 'Make group owner', onPress: () => handleTransferOwnership(p) });
    }

    if (!isTargetOwner) {
      options.push(removeAction);
      options.push({ text: 'Ban from group', style: 'destructive', onPress: () => handleBanMember(p) });
    }

    options.push({ text: 'Message', onPress: async () => {
      try {
        const res = await postRequest(ROUTES.chat.directConversation, { other_user_id: userId }, {});
        const convId = res?.data?.conversation_id ?? res?.data?.id ?? res?.data?.conversationId;
        if (convId) {
          DeviceEventEmitter.emit('chat.open', { conversationId: String(convId), name, kind: 'dm' });
        }
      } catch { /* best-effort */ }
      onBack?.();
    }});

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(name, isTargetOwner ? 'Group owner' : `Role: ${targetRole}`, options);
  };

  const groupMembers = memberList.length ? memberList : participants;
  const memberCount = groupMembers.length || 0;
  const infoTitle = isGroup ? 'Group info' : 'Contact info';

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (isGroup || !contactUserId) return;
      setProfileLoading(true);
      try {
        const res = await getRequest(ROUTES.profiles.view(contactUserId), {
          errorMessage: 'Failed to load profile',
        });
        if (active) {
          const payload = res?.data ?? null;
          setPublicProfile(payload);
          const nextAvatar = payload?.profile?.avatar_url;
          if (nextAvatar && (!chat.avatarUrl || !String(chat.avatarUrl).trim())) {
            setAvatarUrl(nextAvatar);
            onChatUpdated?.({ ...chat, avatarUrl: nextAvatar });
          }
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [isGroup, contactUserId, chat, onChatUpdated]);

  const contactUser = publicProfile?.user ?? null;
  const fallbackContactName =
    directContact?.display_name ||
    resolveUserName(directContact?.user) ||
    chat.name;
  const contactName = contactUser?.display_name || fallbackContactName;
  const hasPublicContact = Boolean(publicProfile?.user);
  const contactPhoneValue = hasPublicContact
    ? contactUser?.phone ?? 'Hidden by privacy'
    : resolveUserPhone(directContact?.user) || '—';
  const contactEmailValue = hasPublicContact
    ? contactUser?.email ?? 'Hidden by privacy'
    : (directContact?.user as any)?.email || '—';


  const profileSections = publicProfile?.sections ?? {};
  const experienceItems = profileSections.experiences ?? [];
  const educationItems = profileSections.educations ?? [];
  const projectItems = profileSections.projects ?? [];
  const skillItems = profileSections.skills ?? [];
  const recommendationItems = profileSections.recommendations ?? [];
  const articleItems = profileSections.articles ?? [];
  const activityItems = profileSections.activity ?? [];
  const serviceItems = publicProfile?.preferences?.services ?? [];
  const highlightItems = publicProfile?.preferences?.highlights ?? [];
  const showcaseSections = profileSections.showcases ?? {};
  const portfolioItems = showcaseSections.portfolio ?? [];
  const caseStudyItems = showcaseSections.case_study ?? [];
  const testimonialItems = showcaseSections.testimonial ?? [];
  const certificationItems = showcaseSections.certification ?? [];
  const introVideoItems = showcaseSections.intro_video ?? [];

  const getShowcaseLink = (item: any) => item?.payload?.url || item?.file_url;
  const openShowcaseLink = (item: any) => {
    const url = getShowcaseLink(item);
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  const renderSummaryList = (
    title: string,
    items: any[],
    getPrimary: (item: any) => string,
    getSecondary?: (item: any) => string | null,
  ) => {
    if (!items?.length) return null;
    const limited = items.slice(0, 3);
    return (
      <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
        <View style={[styles.sectionCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
          {limited.map((item, index) => (
            <View
              key={`${title}-${item.id ?? index}`}
              style={[
                styles.summaryRow,
                index < limited.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: palette.divider,
                },
              ]}
            >
              <Text style={[styles.summaryTitle, { color: palette.text }]} numberOfLines={1}>
                {getPrimary(item) || '—'}
              </Text>
              {getSecondary ? (
                <Text style={[styles.summaryDesc, { color: palette.subtext }]} numberOfLines={2}>
                  {getSecondary(item)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderShowcaseList = (
    title: string,
    items: any[],
    options?: { renderAction?: (item: any) => React.ReactNode },
  ) => {
    if (!items?.length) return null;
    const limited = items.slice(0, 3);
    return (
      <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
        <View style={[styles.sectionCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
          {limited.map((item, index) => {
            const description = item.summary || item.payload?.summary || '';
            return (
              <View
                key={`${title}-${item.id ?? index}`}
                style={[
                  styles.showcaseRow,
                  index < limited.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: palette.divider,
                  },
                ]}
              >
                {item.file_url ? (
                  <Image source={{ uri: item.file_url }} style={styles.showcaseThumb} />
                ) : (
                  <View
                    style={[
                      styles.showcaseThumb,
                      { backgroundColor: palette.surfaceSoft ?? palette.surface },
                    ]}
                  />
                )}
                <View style={styles.showcaseDetails}>
                  <Text style={[styles.summaryTitle, { color: palette.text }]} numberOfLines={1}>
                    {item.title || 'Untitled'}
                  </Text>
                  {description ? (
                    <Text style={[styles.summaryDesc, { color: palette.subtext }]} numberOfLines={2}>
                      {description}
                    </Text>
                  ) : null}
                </View>
            {options?.renderAction?.(item) ?? null}
          </View>
        );
      })}
    </View>
  </View>
);
  };

  const renderIntroVideoAction = (item: any) => {
    const url = getShowcaseLink(item);
    if (!url) return null;
    return (
      <Pressable
        onPress={() => openShowcaseLink(item)}
        style={[
          styles.showcaseAction,
          { borderColor: palette.divider, backgroundColor: palette.surface },
        ]}
      >
        <KISIcon name="play" size={14} color={palette.primary} />
        <Text style={[styles.showcaseActionText, { color: palette.primary }]}>Watch</Text>
      </Pressable>
    );
  };

  const formatActivitySecondary = (item: any) => {
    if (item?.meta?.detail) return item.meta.detail;
    if (item?.created_at) {
      try {
        return new Date(item.created_at).toLocaleDateString();
      } catch {
        return item.created_at;
      }
    }
    return '';
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider, paddingHorizontal: responsive.pageGutter }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          {infoTitle}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: responsive.isWatch ? 24 : 40 }]}>
        <View style={[styles.hero, { paddingHorizontal: responsive.pageGutter, paddingVertical: responsive.isWatch ? 14 : 20 }]}>
          <Pressable
            onPress={() => {
              if (!avatarUrl) return;
              if (!isGroup && statusHas && contactUserId) {
                DeviceEventEmitter.emit('status.open', { userId: contactUserId });
                onBack?.();
                return;
              }
              setAvatarPreview({ uri: avatarUrl });
              setAvatarPreviewFull(false);
            }}
            disabled={!avatarUrl}
          >
            <View
              style={{
                borderWidth: statusHas ? 2 : 0,
                borderColor: statusHas
                  ? statusHasUnseen
                    ? palette.primaryStrong ?? palette.primary
                    : palette.subtext ?? palette.divider
                  : 'transparent',
                padding: statusHas ? 2 : 0,
                borderRadius: 46,
              }}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <ImagePlaceholder size={88} radius={44} style={styles.avatar} />
              )}
            </View>
          </Pressable>
          {isGroup && isAdmin && editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8, width: '100%', paddingHorizontal: 16 }}>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                maxLength={80}
                style={{
                  flex: 1, fontSize: 18, fontWeight: '700', color: palette.text,
                  borderBottomWidth: 2, borderBottomColor: palette.primary,
                  paddingBottom: 4, textAlign: 'center',
                }}
              />
              <Pressable onPress={() => { setEditingName(false); setNameInput(chat.name ?? ''); }} hitSlop={8}>
                <KISIcon name="x" size={18} color={palette.subtext} />
              </Pressable>
              <Pressable onPress={() => void handleSaveGroupName()} disabled={savingName} hitSlop={8}>
                {savingName ? <ActivityIndicator size="small" color={palette.primary} /> : <KISIcon name="check" size={18} color={palette.primary} />}
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => { if (isGroup && isAdmin) setEditingName(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}
              disabled={!isGroup || !isAdmin}
            >
              <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                {chat.name}
              </Text>
              {isGroup && isAdmin && <KISIcon name="edit" size={14} color={palette.subtext} />}
            </Pressable>
          )}
          <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={1}>
            {isGroup ? `${memberCount} members` : 'Direct chat'}
          </Text>

          {isGroup && isAdmin && (
            <Pressable
              onPress={handleChangeAvatar}
              style={({ pressed }) => [
                styles.editButton,
                {
                  backgroundColor: palette.primary ?? '#2E7D32',
                  opacity: pressed || saving ? 0.7 : 1,
                },
              ]}
            >
              <KISIcon name="camera" size={16} color={palette.onPrimary ?? '#fff'} />
              <Text style={[styles.editButtonText, { color: palette.onPrimary ?? '#fff' }]}>
                {saving ? 'Updating...' : 'Change group photo'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Details
          </Text>
          <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.card }]}>
            <Text style={[styles.detailLabel, { color: palette.subtext }]}>
              Type
            </Text>
            <Text style={[styles.detailValue, { color: palette.text }]}>
              {isGroup ? 'Group conversation' : 'Direct conversation'}
            </Text>
          </View>
        </View>

        {!isGroup && (
          <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Contact
            </Text>
            <View
              style={[
                styles.sectionCard,
                { borderColor: palette.divider, backgroundColor: palette.card },
              ]}
            >
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: palette.subtext }]}>Name</Text>
                <Text style={[styles.infoValue, { color: palette.text }]} numberOfLines={1}>
                  {contactName}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: palette.subtext }]}>Phone</Text>
                <Text style={[styles.infoValue, { color: palette.text }]} numberOfLines={1}>
                  {contactPhoneValue}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: palette.subtext }]}>Email</Text>
                <Text style={[styles.infoValue, { color: palette.text }]} numberOfLines={1}>
                  {contactEmailValue}
                </Text>
              </View>
            </View>
          </View>
        )}

        {!isGroup && (
          <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Public profile
            </Text>
            {profileLoading ? (
              <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.card }]}>
                <Skeleton height={16} width={140} />
                <Skeleton height={12} width={220} style={{ marginTop: 8 }} />
                <Skeleton height={12} width={180} style={{ marginTop: 6 }} />
              </View>
            ) : publicProfile ? (
              <View style={[styles.profileCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
                {publicProfile?.profile?.cover_url ? (
                  <Image source={{ uri: publicProfile.profile.cover_url }} style={styles.profileCover} />
                ) : null}
                <View style={styles.profileHeader}>
                  {publicProfile?.profile?.avatar_url ? (
                    <Image source={{ uri: publicProfile.profile.avatar_url }} style={styles.profileAvatar} />
                  ) : (
                    <ImagePlaceholder size={56} radius={18} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profileName, { color: palette.text }]} numberOfLines={1}>
                      {publicProfile?.user?.display_name || 'Profile'}
                    </Text>
                    {publicProfile?.profile?.headline ? (
                      <Text style={[styles.profileHeadline, { color: palette.subtext }]} numberOfLines={2}>
                        {publicProfile.profile.headline}
                      </Text>
                    ) : null}
                    {publicProfile?.profile?.industry ? (
                      <Text style={[styles.profileMeta, { color: palette.subtext }]} numberOfLines={1}>
                        {publicProfile.profile.industry}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {publicProfile?.profile?.bio ? (
                  <Text style={[styles.profileBio, { color: palette.text }]} numberOfLines={4}>
                    {publicProfile.profile.bio}
                  </Text>
                ) : null}

                {serviceItems.length > 0 && (
                  <>
                    <Text style={[styles.profileSubTitle, { color: palette.text }]}>Services</Text>
                    {serviceItems.slice(0, 3).map((svc: any, idx: number) => (
                      <View key={`${svc?.title ?? 'service'}-${idx}`} style={styles.profileLine}>
                        <Text style={[styles.profileLineTitle, { color: palette.text }]} numberOfLines={1}>
                          {svc.title || 'Service'}
                        </Text>
                        <Text style={[styles.profileLineMeta, { color: palette.subtext }]}>
                          {svc.price || 'Request quote'}
                        </Text>
                      </View>
                    ))}
                  </>
                )}

                {highlightItems.length > 0 && (
                  <>
                    <Text style={[styles.profileSubTitle, { color: palette.text }]}>Highlights</Text>
                    <View style={styles.chipRow}>
                      {highlightItems.map((item: string, idx: number) => (
                        <View
                          key={`${item}_${idx}`}
                          style={[styles.chip, { backgroundColor: palette.primarySoft }]}
                        >
                          <Text style={{ color: palette.primaryStrong }}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {portfolioItems.length > 0 && (
                  <>
                    <Text style={[styles.profileSubTitle, { color: palette.text }]}>Portfolio gallery</Text>
                    <View style={styles.portfolioRow}>
                      {portfolioItems.slice(0, 4).map((item: any, idx: number) => (
                        <View
                          key={`${item.id ?? idx}`}
                          style={[styles.portfolioThumb, { backgroundColor: palette.surface }]}
                        >
                          {item.file_url ? (
                            <Image source={{ uri: item.file_url }} style={styles.portfolioThumbImg} />
                          ) : (
                            <ImagePlaceholder size={42} radius={12} />
                          )}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                No public profile available.
              </Text>
            )}
          </View>
        )}

        {!isGroup && (
          <>
            {renderSummaryList(
              'Experience',
              experienceItems,
              (item) => item.title || 'Experience',
              (item) => item.description || item.company || '',
            )}
            {renderSummaryList(
              'Education',
              educationItems,
              (item) => item.school || 'Education',
              (item) => item.description || '',
            )}
            {renderSummaryList(
              'Projects',
              projectItems,
              (item) => item.name || 'Project',
              (item) => item.description || item.project_url || '',
            )}
            {skillItems.length > 0 && (
              <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Skills</Text>
                <View style={[styles.sectionCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
                  <View style={styles.chipRow}>
                    {skillItems.slice(0, 8).map((skill: any, idx: number) => (
                      <View
                        key={`${skill.id ?? skill.skill_id ?? idx}`}
                        style={[styles.chip, { backgroundColor: palette.primarySoft }]}
                      >
                        <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>
                          {skill.description || skill.skill_id || 'Skill'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
            {renderSummaryList(
              'Recommendations',
              recommendationItems,
              (item) => item.content || 'Recommendation',
              (item) => item.recommender_user?.display_name || '',
            )}
            {renderSummaryList(
              'Articles',
              articleItems,
              (item) => item.title || 'Article',
              (item) => item.summary || '',
            )}
            {renderSummaryList(
              'Recent activity',
              activityItems,
              (item) => item.action || 'Activity',
              (item) => formatActivitySecondary(item),
            )}
            {renderShowcaseList('Case studies', caseStudyItems)}
            {renderShowcaseList('Testimonials', testimonialItems)}
            {renderShowcaseList('Certifications', certificationItems)}
            {renderShowcaseList(
              'Intro videos',
              introVideoItems,
              { renderAction: renderIntroVideoAction },
            )}
          </>
        )}

        {isGroup && (
          <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: 0, flex: 1 }]}>
                Description
              </Text>
              {isAdmin && !editingDescription && (
                <Pressable onPress={() => setEditingDescription(true)} hitSlop={8}>
                  <KISIcon name="edit" size={16} color={palette.primary} />
                </Pressable>
              )}
            </View>
            <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.card }]}>
              {editingDescription ? (
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={descriptionInput}
                    onChangeText={setDescriptionInput}
                    multiline
                    maxLength={500}
                    placeholder="Add a group description…"
                    placeholderTextColor={palette.subtext}
                    style={{
                      color: palette.text,
                      fontSize: 14,
                      minHeight: 72,
                      textAlignVertical: 'top',
                    }}
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={() => { setEditingDescription(false); setDescriptionInput((chat as any).description ?? ''); }}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: palette.divider }}
                    >
                      <Text style={{ color: palette.text, fontSize: 13 }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleSaveDescription()}
                      disabled={savingDescription}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, backgroundColor: palette.primary, opacity: savingDescription ? 0.6 : 1 }}
                    >
                      <Text style={{ color: palette.onPrimary ?? '#fff', fontSize: 13, fontWeight: '600' }}>
                        {savingDescription ? 'Saving…' : 'Save'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text style={[styles.detailValue, { color: descriptionInput ? palette.text : palette.subtext }]}>
                  {descriptionInput || 'No description'}
                </Text>
              )}
            </View>
          </View>
        )}

        {isGroup && (
          <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Invite link
            </Text>
            <View style={[styles.sectionCard, { borderColor: palette.divider, backgroundColor: palette.card }]}>
              {inviteLink ? (
                <>
                  <Text
                    style={[styles.infoValue, { color: palette.text }]}
                    numberOfLines={2}
                    selectable
                  >
                    {inviteLink}
                  </Text>
                  <View style={styles.inviteLinkActions}>
                    <Pressable
                      onPress={() => {
                        try {
                          Clipboard.setString(inviteLink);
                          Alert.alert('Copied', 'Invite link copied to clipboard.');
                        } catch {
                          Share.share({ message: inviteLink }).catch(() => {});
                        }
                      }}
                      style={({ pressed }) => [
                        styles.inviteLinkBtn,
                        { backgroundColor: palette.primary, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <KISIcon name="copy" size={14} color={palette.onPrimary ?? '#fff'} />
                      <Text style={[styles.inviteLinkBtnText, { color: palette.onPrimary ?? '#fff' }]}>
                        Copy
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Share.share({ message: inviteLink }).catch(() => {});
                      }}
                      style={({ pressed }) => [
                        styles.inviteLinkBtn,
                        { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.divider, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <KISIcon name="share" size={14} color={palette.text} />
                      <Text style={[styles.inviteLinkBtnText, { color: palette.text }]}>
                        Share
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={handleFetchInviteLink}
                  disabled={!groupId}
                  style={({ pressed }) => [
                    styles.inviteLinkBtn,
                    { backgroundColor: palette.primary, opacity: pressed || inviteLinkLoading || !groupId ? 0.7 : 1 },
                  ]}
                >
                  <KISIcon name="link" size={14} color={palette.onPrimary ?? '#fff'} />
                  <Text style={[styles.inviteLinkBtnText, { color: palette.onPrimary ?? '#fff' }]}>
                    {inviteLinkLoading ? 'Loading...' : !groupId ? (groupIdFetchDone ? 'Unavailable' : 'Loading group…') : 'Generate invite link'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {isGroup && (
          <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: 0, flex: 1 }]}>
                Members ({memberCount})
              </Text>
              {isAdmin && (
                <Pressable
                  onPress={() => {
                    Alert.alert('Add members', 'Select contacts to add', [
                      { text: 'Close', style: 'cancel' },
                    ]);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: palette.primary + '22' }}
                  hitSlop={8}
                >
                  <KISIcon name="plus" size={14} color={palette.primary} />
                  <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '600' }}>Add</Text>
                </Pressable>
              )}
            </View>
            {membersLoading ? (
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                Loading members...
              </Text>
            ) : groupMembers.length === 0 ? (
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                No member details available.
              </Text>
            ) : (
              groupMembers.map((p, index) => {
                const label =
                  p.display_name ||
                  resolveUserName(p.user) ||
                  'Member';
                const roleLabel = p.base_role ? String(p.base_role).toLowerCase() : 'member';
                const phone = resolveUserPhone(p.user);
                const membUserId = resolveUserId(p.user);
                const isChanging = roleChanging === membUserId;
                const isMe = membUserId === currentUserId;
                const isTargetOwner = roleLabel === 'owner';
                const isTargetAdmin = roleLabel === 'admin' || isTargetOwner;
                const initials = label.trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                const roleBadgeColor = isTargetOwner ? '#F59E0B' : isTargetAdmin ? (palette.primary ?? '#4F46E5') : 'transparent';
                const roleBadgeText = isTargetOwner ? 'Owner' : isTargetAdmin ? 'Admin' : '';
                return (
                  <Pressable
                    key={`${membUserId ?? index}`}
                    style={({ pressed }) => [
                      styles.memberRow,
                      { borderBottomColor: palette.divider, backgroundColor: pressed && isAdmin && !isMe ? palette.surface : 'transparent' },
                    ]}
                    onPress={() => showMemberActions(p)}
                    disabled={!isAdmin || isMe}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: palette.surfaceSoft ?? palette.surface, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: palette.subtext, fontSize: 14, fontWeight: '700' }}>{initials}</Text>
                    </View>
                    <View style={[styles.memberInfo, { flex: 1 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.memberName, { color: palette.text }]} numberOfLines={1}>{label}</Text>
                        {isMe && <Text style={{ color: palette.subtext, fontSize: 11 }}>(You)</Text>}
                      </View>
                      <Text style={[styles.memberRole, { color: palette.subtext }]} numberOfLines={1}>
                        {phone || 'No phone'}
                      </Text>
                    </View>
                    {isChanging ? (
                      <ActivityIndicator size="small" color={palette.primary} style={{ marginLeft: 8 }} />
                    ) : roleBadgeText ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: roleBadgeColor + '22', marginLeft: 8 }}>
                        <Text style={{ color: roleBadgeColor, fontSize: 11, fontWeight: '700' }}>{roleBadgeText}</Text>
                      </View>
                    ) : isAdmin && !isMe ? (
                      <KISIcon name="chevron-right" size={14} color={palette.subtext} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* ── Group settings (admins only) ───────────────────────────────── */}
        {isGroup && isAdmin && (() => {
          const Toggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
            <Pressable
              onPress={onToggle}
              style={{
                width: 44, height: 26, borderRadius: 13,
                backgroundColor: value ? (palette.primary ?? '#4F46E5') : (palette.divider ?? '#ccc'),
                justifyContent: 'center', paddingHorizontal: 2,
              }}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
                transform: [{ translateX: value ? 18 : 0 }],
              }} />
            </Pressable>
          );

          const SettingRow = ({ label, sublabel, value, onToggle }: { label: string; sublabel: string; value: boolean; onToggle: () => void }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.divider }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>{sublabel}</Text>
              </View>
              <Toggle value={value} onToggle={onToggle} />
            </View>
          );

          return (
            <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Group settings</Text>
              <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.card }]}>
                <SettingRow
                  label="Only admins can send"
                  sublabel="Members can read but not send messages"
                  value={messagingRestricted}
                  onToggle={() => void handleToggleSetting('messaging_restricted', messagingRestricted, setMessagingRestricted)}
                />
                <SettingRow
                  label="Only admins can edit info"
                  sublabel="Only admins can change group name, photo & description"
                  value={editInfoRestricted}
                  onToggle={() => void handleToggleSetting('edit_info_restricted', editInfoRestricted, setEditInfoRestricted)}
                />
                <SettingRow
                  label="Approval required to join"
                  sublabel="Admin must approve join requests from invite links"
                  value={approvalRequired}
                  onToggle={() => void handleToggleSetting('approval_required', approvalRequired, setApprovalRequired)}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600' }}>Only admins can react</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>Members can view but not add reactions</Text>
                  </View>
                  <Toggle
                    value={reactionsAdminOnly}
                    onToggle={() => {
                      const next = !reactionsAdminOnly;
                      setReactionsAdminOnly(next);
                      AsyncStorage.setItem(`KIS_REACTIONS_ADMIN_ONLY_${roomId}`, next ? 'true' : 'false').catch(() => {});
                      emitGroupSetting('reactionsAdminOnly', next);
                    }}
                  />
                </View>
              </View>
            </View>
          );
        })()}

        {/* ── Media, Files & Links browser ──────────────────────────────── */}
        {(() => {
          const cellSize = Math.floor((responsive.width - responsive.pageGutter * 2 - 6) / 3);
          const IMG_LIMIT  = 12;
          const FILE_LIMIT = 5;
          const LINK_LIMIT = 5;

          const formatBytes = (b?: number) => {
            if (!b) return '';
            if (b < 1024) return `${b} B`;
            if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
            return `${(b / (1024 * 1024)).toFixed(1)} MB`;
          };

          const tabCount = (t: MediaTab) =>
            t === 'Images' ? mediaImages.length : t === 'Files' ? mediaFiles.length : mediaLinks.length;

          return (
            <View style={[styles.section, { paddingHorizontal: responsive.pageGutter }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Media, Files & Links</Text>

              {/* Tab pills */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['Images', 'Files', 'Links'] as MediaTab[]).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setMediaTab(t)}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 20,
                      backgroundColor: mediaTab === t ? palette.primary : (palette.surface ?? palette.card),
                    }}
                  >
                    <Text style={{ color: mediaTab === t ? (palette.onPrimary ?? '#fff') : palette.text, fontWeight: '600', fontSize: 13 }}>
                      {t}
                      {!mediaLoading ? ` (${tabCount(t)})` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {mediaLoading ? (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <ActivityIndicator color={palette.primary} />
                </View>
              ) : mediaTab === 'Images' ? (
                mediaImages.length === 0 ? (
                  <Text style={{ color: palette.subtext, textAlign: 'center', paddingVertical: 24, fontSize: 13 }}>No images or videos shared yet</Text>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                      {(showAllImages ? mediaImages : mediaImages.slice(0, IMG_LIMIT)).map((item, i) => (
                        <Pressable
                          key={item.id + i}
                          onPress={() => Linking.openURL(item.url).catch(() => {})}
                          style={{ width: cellSize, height: cellSize, borderRadius: 6, overflow: 'hidden', backgroundColor: palette.surface }}
                        >
                          <Image source={{ uri: item.url }} style={{ width: cellSize, height: cellSize }} resizeMode="cover" />
                          {item.kind === 'video' && (
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                              <KISIcon name="play" size={22} color="#fff" />
                            </View>
                          )}
                        </Pressable>
                      ))}
                    </View>
                    {!showAllImages && mediaImages.length > IMG_LIMIT && (
                      <Pressable onPress={() => setShowAllImages(true)} style={{ marginTop: 10, alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ color: palette.primary, fontWeight: '600', fontSize: 13 }}>View all {mediaImages.length} items</Text>
                      </Pressable>
                    )}
                  </>
                )
              ) : mediaTab === 'Files' ? (
                mediaFiles.length === 0 ? (
                  <Text style={{ color: palette.subtext, textAlign: 'center', paddingVertical: 24, fontSize: 13 }}>No files shared yet</Text>
                ) : (
                  <>
                    <View style={[styles.sectionCard, { borderColor: palette.divider, backgroundColor: palette.card, padding: 0, overflow: 'hidden' }]}>
                      {(showAllFiles ? mediaFiles : mediaFiles.slice(0, FILE_LIMIT)).map((item, i) => {
                        const isAudio = item.kind === 'audio' || item.kind === 'voice';
                        const iconName = isAudio ? 'mic' : 'file';
                        return (
                          <Pressable
                            key={item.id + i}
                            onPress={() => Linking.openURL(item.url).catch(() => {})}
                            style={({ pressed }) => [{
                              flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12,
                              borderBottomWidth: i < (showAllFiles ? mediaFiles.length : Math.min(FILE_LIMIT, mediaFiles.length)) - 1 ? StyleSheet.hairlineWidth : 0,
                              borderBottomColor: palette.divider,
                              backgroundColor: pressed ? (palette.surface ?? palette.bg) : 'transparent',
                            }]}
                          >
                            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: palette.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                              <KISIcon name={iconName} size={20} color={palette.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: palette.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.name || 'File'}</Text>
                              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>{formatBytes(item.size)}</Text>
                            </View>
                            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                          </Pressable>
                        );
                      })}
                    </View>
                    {!showAllFiles && mediaFiles.length > FILE_LIMIT && (
                      <Pressable onPress={() => setShowAllFiles(true)} style={{ marginTop: 10, alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ color: palette.primary, fontWeight: '600', fontSize: 13 }}>View all {mediaFiles.length} files</Text>
                      </Pressable>
                    )}
                  </>
                )
              ) : (
                mediaLinks.length === 0 ? (
                  <Text style={{ color: palette.subtext, textAlign: 'center', paddingVertical: 24, fontSize: 13 }}>No links shared yet</Text>
                ) : (
                  <>
                    <View style={[styles.sectionCard, { borderColor: palette.divider, backgroundColor: palette.card, padding: 0, overflow: 'hidden' }]}>
                      {(showAllLinks ? mediaLinks : mediaLinks.slice(0, LINK_LIMIT)).map((item, i) => {
                        let domain = '';
                        try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch { domain = item.url; }
                        return (
                          <Pressable
                            key={item.url + i}
                            onPress={() => Linking.openURL(item.url).catch(() => {})}
                            style={({ pressed }) => [{
                              flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12,
                              borderBottomWidth: i < (showAllLinks ? mediaLinks.length : Math.min(LINK_LIMIT, mediaLinks.length)) - 1 ? StyleSheet.hairlineWidth : 0,
                              borderBottomColor: palette.divider,
                              backgroundColor: pressed ? (palette.surface ?? palette.bg) : 'transparent',
                            }]}
                          >
                            {item.image ? (
                              <Image source={{ uri: item.image }} style={{ width: 44, height: 44, borderRadius: 8 }} resizeMode="cover" />
                            ) : (
                              <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: palette.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                                <KISIcon name="link" size={20} color={palette.primary} />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              {item.title ? <Text style={{ color: palette.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.title}</Text> : null}
                              <Text style={{ color: palette.primary, fontSize: 12, marginTop: item.title ? 2 : 0 }} numberOfLines={1}>{item.site_name || domain}</Text>
                              {item.description ? <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.description}</Text> : null}
                            </View>
                            <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                          </Pressable>
                        );
                      })}
                    </View>
                    {!showAllLinks && mediaLinks.length > LINK_LIMIT && (
                      <Pressable onPress={() => setShowAllLinks(true)} style={{ marginTop: 10, alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ color: palette.primary, fontWeight: '600', fontSize: 13 }}>View all {mediaLinks.length} links</Text>
                      </Pressable>
                    )}
                  </>
                )
              )}
            </View>
          );
        })()}

        {isGroup && (
          <View style={[styles.section, { paddingHorizontal: responsive.pageGutter, paddingBottom: 16 }]}>
            <Pressable
              onPress={handleLeaveGroup}
              style={({ pressed }) => [
                styles.dangerBtn,
                { borderColor: '#DC2626', opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <KISIcon name="arrow-left" size={16} color="#DC2626" />
              <Text style={[styles.dangerBtnText, { color: '#DC2626' }]}>Leave group</Text>
            </Pressable>

            {role === 'owner' && (
              <Pressable
                onPress={handleDeleteGroup}
                style={({ pressed }) => [
                  styles.dangerBtn,
                  { borderColor: '#DC2626', backgroundColor: '#DC2626', marginTop: 10, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <KISIcon name="trash" size={16} color="#fff" />
                <Text style={[styles.dangerBtnText, { color: '#fff' }]}>Delete group</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!avatarPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreview(null)}
      >
        <Pressable
          style={[
            styles.previewBackdrop,
            { backgroundColor: avatarPreviewFull ? '#000' : 'rgba(0,0,0,0)' },
          ]}
          onPress={() => setAvatarPreview(null)}
        />
        {avatarPreview ? (
          <Animated.View
            style={[
              styles.previewStage,
              {
                transform: [
                  {
                    scale: avatarAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              onPress={() => setAvatarPreviewFull((prev) => !prev)}
              style={[
                styles.previewCard,
                avatarPreviewFull && styles.previewCardFull,
                { backgroundColor: palette.card },
              ]}
            >
              <Image
                source={{ uri: avatarPreview.uri }}
                resizeMode="cover"
                style={{ width: '100%', height: '100%' }}
              />
              <Pressable
                onPress={() => setAvatarPreview(null)}
                style={styles.previewBackBtn}
              >
                <KISIcon name="arrow-left" size={18} color="#fff" />
              </Pressable>
            </Pressable>
            {!avatarPreviewFull ? (
              <View
                style={[
                  styles.previewActions,
                  { backgroundColor: palette.card, borderColor: palette.divider },
                ]}
              >
                <Pressable
                  onPress={() => {
                    setAvatarPreview(null);
                    onBack?.();
                  }}
                  style={styles.previewActionBtn}
                >
                  <KISIcon name="chat" size={20} color={palette.primary} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    void handleStartCall('voice');
                  }}
                  style={styles.previewActionBtn}
                >
                  <KISIcon name="phone" size={20} color={palette.text} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    void handleStartCall('video');
                  }}
                  style={styles.previewActionBtn}
                >
                  <KISIcon name="video" size={20} color={palette.text} />
                </Pressable>
                <Pressable
                  onPress={() => setAvatarPreview(null)}
                  style={styles.previewActionBtn}
                >
                  <KISIcon name="info" size={20} color={palette.text} />
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 6, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  content: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 10, fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 4, fontSize: 13 },
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
  sectionCard: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 10 },
  card: { borderWidth: 2, borderRadius: 12, padding: 12 },
  infoRow: { paddingVertical: 6 },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  detailLabel: { fontSize: 12, marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 13 },
  profileCard: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 12 },
  profileCover: { width: '100%', height: 110, borderRadius: 12, marginBottom: 8 },
  profileHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  profileAvatar: { width: 56, height: 56, borderRadius: 18 },
  profileName: { fontSize: 16, fontWeight: '700' },
  profileHeadline: { fontSize: 13, marginTop: 2 },
  profileMeta: { fontSize: 12, marginTop: 4 },
  profileBio: { fontSize: 13, lineHeight: 18 },
  profileSubTitle: { fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  profileLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  profileLineTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  profileLineMeta: { fontSize: 12 },
  portfolioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  portfolioThumb: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  portfolioThumbImg: { width: 52, height: 52, borderRadius: 12 },
  summaryRow: { paddingVertical: 10 },
  summaryTitle: { fontSize: 14, fontWeight: '600' },
  summaryDesc: { fontSize: 12, marginTop: 4 },
  showcaseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  showcaseThumb: { width: 56, height: 56, borderRadius: 12 },
  showcaseDetails: { flex: 1 },
  showcaseAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
  },
  showcaseActionText: { fontSize: 11, fontWeight: '700' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  memberAvatar: { width: 36, height: 36, borderRadius: 18 },
  memberInfo: { marginLeft: 10, flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberRole: { fontSize: 12 },
  previewBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
  },
  previewStage: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    width: 280,
    height: 280,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCardFull: {
    width: '100%',
    height: '80%',
    borderRadius: 0,
  },
  previewActions: {
    marginTop: 12,
    width: 280,
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewActionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewBackBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteLinkActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  inviteLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  inviteLinkBtnText: { fontSize: 13, fontWeight: '600' },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  dangerBtnText: { fontSize: 15, fontWeight: '700' },
});

export default ChatInfoPage;
