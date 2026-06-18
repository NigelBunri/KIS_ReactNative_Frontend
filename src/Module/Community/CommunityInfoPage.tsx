import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState<string>('');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadCommunity = async () => {
      setLoading(true);
      try {
        const detail = await getRequest(ROUTES.community.detail(communityId), {
          errorMessage: 'Failed to load community',
        });
        const detailData = detail?.data ?? detail ?? {};
        if (mounted) {
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
        if (mounted) {
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
        if (mounted) {
          setPosts(Array.isArray(postList) ? postList : []);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadCommunity();
    return () => {
      mounted = false;
    };
  }, [communityId]);

  const me = useMemo(() => {
    if (!currentUserId) return null;
    return members.find((m) => {
      const u = m.user;
      if (typeof u === 'object' && u && u.id) return String(u.id) === String(currentUserId);
      return false;
    }) ?? null;
  }, [members, currentUserId]);

  const role = String(me?.role ?? me?.base_role ?? '').toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin' || role === 'mod' || role === 'moderator';

  const resolveUserId = (member: CommunityMember): string => {
    const u = member.user;
    if (typeof u === 'object' && u && u.id) return String(u.id);
    if (typeof u === 'string' || typeof u === 'number') return String(u);
    return '';
  };

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
          `Remove ${label} from this community?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                try {
                  await postRequest(ROUTES.community.ban(communityId), { user_id: userId }, {
                    errorMessage: 'Failed to remove member',
                  });
                  setMembers((prev) => prev.filter((m) => resolveUserId(m) !== userId));
                } catch (err: any) {
                  Alert.alert('Error', err?.message || 'Unable to remove member.');
                }
              },
            },
          ],
        );
      });

      if (isMemberAdmin) {
        options.push('Demote from admin');
        actions.push(async () => {
          try {
            await postRequest(ROUTES.community.members(communityId), { user_id: userId, role: 'member' }, {
              errorMessage: 'Failed to demote member',
            });
            setMembers((prev) =>
              prev.map((m) =>
                resolveUserId(m) === userId ? { ...m, role: 'member', base_role: 'member' } : m,
              ),
            );
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Unable to demote member.');
          }
        });
      } else {
        options.push('Promote to admin');
        actions.push(async () => {
          try {
            await postRequest(ROUTES.community.members(communityId), { user_id: userId, role: 'admin' }, {
              errorMessage: 'Failed to promote member',
            });
            setMembers((prev) =>
              prev.map((m) =>
                resolveUserId(m) === userId ? { ...m, role: 'admin', base_role: 'admin' } : m,
              ),
            );
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Unable to promote member.');
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
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
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
