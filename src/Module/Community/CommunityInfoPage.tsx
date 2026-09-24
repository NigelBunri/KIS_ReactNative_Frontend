import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
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

import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import ROUTES, { CHAT_BASE_URL } from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import apiService from '@/services/apiService';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { getAccessToken } from '@/security/authStorage';
import { getFeedPlainText } from '@/components/feeds/richTextValue';
import { useSocket } from '@/SocketProvider';
import { refreshFromDeviceAndBackend, type KISContact } from '@/Module/AddContacts/contactsService';

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

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState<string>('');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);

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
        setAvatarUrl(detailData.avatar_url ?? detailData.avatarUrl ?? undefined);
        setDescription(detailData.description ?? '');
      }

      const membersRes = await getRequest(ROUTES.community.members(communityId), {
        errorMessage: 'Failed to load members',
      });
      const list =
        membersRes?.data?.results ??
        membersRes?.results ??
        membersRes?.data ??
        membersRes ??
        [];
      if (mountedRef.current) {
        setMembers(Array.isArray(list) ? list : []);
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
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [communityId]);

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

  const role = String(me?.role ?? me?.base_role ?? '').toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin' || role === 'mod' || role === 'moderator';

  const handleMemberAction = (member: CommunityMember) => {
    const userId = resolveUserId(member);
    if (!userId) return;
    const label = member.display_name || resolveUserName(member.user) || 'Member';
    const memberRole = String(member.role ?? member.base_role ?? '').toLowerCase();
    const isOwner = memberRole === 'owner';
    const isMemberAdmin = memberRole === 'admin' || memberRole === 'owner' || memberRole === 'moderator';

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
      } else {
        options.push('Promote to admin');
        actions.push(async () => {
          const res = await postRequest(
            ROUTES.community.setMemberRole(communityId),
            { user_id: userId, role: 'admin' },
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
        });
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
            try {
              await deleteRequest(ROUTES.community.leave(communityId), {
                errorMessage: 'Failed to leave community',
              });
              // Remove self from the members list
              setMembers((prev) =>
                prev.filter((m) => resolveUserId(m) !== String(currentUserId ?? '')),
              );
            } catch {
              // Some backends use POST for leave
              try {
                await postRequest(ROUTES.community.leave(communityId), {}, {
                  errorMessage: 'Failed to leave community',
                });
                setMembers((prev) =>
                  prev.filter((m) => resolveUserId(m) !== String(currentUserId ?? '')),
                );
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
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
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
            {communityName}
          </Text>
          {description ? (
            <Text style={[styles.subtitle, { color: palette.subtext }]} numberOfLines={2}>
              {description}
            </Text>
          ) : null}

          {isAdmin && (
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
                {saving ? 'Updating...' : 'Change community photo'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Members
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
              const roleLabel = m.role || m.base_role ? String(m.role ?? m.base_role) : '';
              const memberId = resolveUserId(m);
              const memberRole = String(m.role ?? m.base_role ?? '').toLowerCase();
              const isOwnerMember = memberRole === 'owner';
              const isMe = memberId && memberId === String(currentUserId ?? '');
              return (
                <View
                  key={`${typeof m.user === 'object' && m.user ? m.user.id : index}`}
                  style={[styles.memberRow, { borderBottomColor: palette.divider }]}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: palette.surfaceSoft ?? palette.surface }]} />
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: palette.text }]} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text style={[styles.memberRole, { color: palette.subtext }]} numberOfLines={1}>
                      {phone || 'No phone'}{roleLabel ? ` • ${roleLabel}` : ''}
                    </Text>
                  </View>
                  {isAdmin && !isMe && !isOwnerMember && (
                    <Pressable
                      onPress={() => handleMemberAction(m)}
                      hitSlop={8}
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
    borderBottomWidth: 1,
  },
  memberAvatar: { width: 36, height: 36, borderRadius: 18 },
  memberInfo: { marginLeft: 10, flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberRole: { fontSize: 12 },
  memberActionBtn: { padding: 6, marginLeft: 4 },
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
