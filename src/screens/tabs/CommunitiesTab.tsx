import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Animated,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  DeviceEventEmitter,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import { enqueueMutation } from '@/services/pendingMutationsQueue';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import Skeleton from '@/components/common/Skeleton';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import { styles as chatListStyles } from '@/Module/ChatRoom/messagesUtils';
import { refreshFromDeviceAndBackend, type KISContact } from '@/Module/AddContacts/contactsService';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { getAccessToken } from '@/security/authStorage';
import { useSocket } from '../../../SocketProvider';
import CommunityRoomPage from '@/Module/Community/CommunityRoomPage';
import CommunityInfoPage from '@/Module/Community/CommunityInfoPage';
import { getFeedPlainText } from '@/components/feeds/richTextValue';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import type { ScrollableHandle } from '@/hooks/useHeaderDragToScroll';

type Community = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar_url?: string;
  main_conversation_id?: string;
  posts_conversation_id?: string;
  is_member?: boolean;
  is_owner?: boolean;
  current_user_role?: string | null;
};

type Post = {
  id: string;
  text?: unknown;
  text_plain?: string;
  text_preview?: string;
  created_at?: string;
  author?: { id?: string | number; display_name?: string };
  author_id?: string | number;
  attachments?: any[];
};

type Group = {
  id: string;
  name: string;
  slug: string;
  conversation_id?: string;
};

type CommunitiesTabProps = {
  onOpenChat?: (chat: Chat) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const CommunitiesTab = forwardRef<ScrollableHandle, CommunitiesTabProps>(function CommunitiesTab({ onOpenChat, onScroll }: CommunitiesTabProps, ref) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const { width } = useWindowDimensions();
  const responsive = useResponsiveLayout();
  const { currentUserId } = useSocket();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communitiesPage, setCommunitiesPage] = useState(1);
  const [communitiesHasMore, setCommunitiesHasMore] = useState(false);
  const [selected, setSelected] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<'feed' | 'groups'>('feed');
  // Only one of these 3 mutually-exclusive lists (feed/groups within a
  // selected community, or the top-level communities list) is visible at a
  // time, mirroring which of `selected`/`tab` is active — the imperative
  // handle below dispatches to whichever is currently on-screen.
  const feedListRef = useRef<FlatList>(null);
  const groupsListRef = useRef<FlatList>(null);
  const communitiesListRef = useRef<FlatList>(null);
  useImperativeHandle(ref, () => ({
    scrollTo: (opts) => {
      const activeRef = !selected ? communitiesListRef : tab === 'feed' ? feedListRef : groupsListRef;
      activeRef.current?.getScrollResponder()?.scrollTo(opts);
    },
  }), [selected, tab]);
  const [communityVisible, setCommunityVisible] = useState(false);
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);
  const communitySlide = useState(() => new Animated.Value(-width))[0];
  const [infoVisible, setInfoVisible] = useState(false);
  const [activeInfo, setActiveInfo] = useState<{ id: string; name: string } | null>(null);
  const infoSlide = useState(() => new Animated.Value(-width))[0];
  const [composerText, setComposerText] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createAvatarUri, setCreateAvatarUri] = useState<string | null>(null);
  const [discoverVisible, setDiscoverVisible] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverResults, setDiscoverResults] = useState<Community[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [groupCreateVisible, setGroupCreateVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupContacts, setGroupContacts] = useState<KISContact[]>([]);
  const [groupContactsLoading, setGroupContactsLoading] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [groupCreateError, setGroupCreateError] = useState('');

  const loadCommunities = useCallback(async (page = 1) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getRequest(`${ROUTES.community.list}?page=${page}`, {
        errorMessage: 'Failed to load communities',
      });
      const list = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.results)
        ? res.results
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      const meta = res?.data?.meta || res?.meta;
      const hasNext = meta
        ? meta.current < meta.total_pages
        : res?.data?.next != null || res?.next != null;
      setCommunitiesHasMore(hasNext);
      if (page === 1) {
        setCommunities(list as Community[]);
      } else {
        setCommunities((prev) => [...prev, ...(list as Community[])]);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load communities.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePickCreateAvatar = useCallback(() => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.assets?.[0]?.uri) {
        setCreateAvatarUri(response.assets[0].uri);
      }
    });
  }, []);

  const openCommunity = useCallback((community: Community) => {
    setActiveCommunity(community);
    setCommunityVisible(true);
    Animated.timing(communitySlide, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [communitySlide]);

  const closeCommunity = useCallback(() => {
    Animated.timing(communitySlide, {
      toValue: -width,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      setCommunityVisible(false);
      setActiveCommunity(null);
      setSelected(null);
    });
  }, [communitySlide, width]);

  const openCommunityInfo = useCallback((community: { id: string; name: string }) => {
    setActiveInfo(community);
    setInfoVisible(true);
    Animated.timing(infoSlide, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [infoSlide]);

  const closeCommunityInfo = useCallback(() => {
    Animated.timing(infoSlide, {
      toValue: -width,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setInfoVisible(false);
      setActiveInfo(null);
    });
  }, [infoSlide, width]);

  const loadCommunityDetail = useCallback(async (community: Community) => {
    setSelected(community);
    setTab('feed');
    try {
      const postsRes = await getRequest(`${ROUTES.community.posts}?community=${community.id}`, {
        errorMessage: 'Failed to load posts',
      });
      const list = Array.isArray(postsRes?.data?.results)
        ? postsRes.data.results
        : Array.isArray(postsRes?.results)
        ? postsRes.results
        : postsRes?.data ?? postsRes ?? [];
      setPosts(Array.isArray(list) ? list : []);

      const groupsRes = await getRequest(`${ROUTES.groups.list}?community=${community.id}`, {
        errorMessage: 'Failed to load groups',
      });
      const gList = Array.isArray(groupsRes?.data?.results)
        ? groupsRes.data.results
        : Array.isArray(groupsRes?.results)
        ? groupsRes.results
        : groupsRes?.data ?? groupsRes ?? [];
      setGroups(Array.isArray(gList) ? gList : []);
    } catch {
      setPosts([]);
      setGroups([]);
    }
  }, []);

  const createCommunity = useCallback(async () => {
    if (!createName.trim()) return;

    let avatarUrl: string | undefined;
    if (createAvatarUri) {
      try {
        const token = await getAccessToken();
        const uploaded = await uploadFileToBackend({
          file: {
            uri: createAvatarUri,
            name: 'community-avatar.jpg',
            type: 'image/jpeg',
          },
          authToken: token,
        });
        avatarUrl = uploaded?.url;
      } catch {
        // Non-fatal: proceed without avatar
      }
    }

    const payload: Record<string, unknown> = {
      name: createName.trim(),
      slug: createName.trim().toLowerCase().replace(/\s+/g, '-'),
      description: createDesc.trim(),
      create_main_conversation: true,
      create_posts_conversation: true,
      ...(avatarUrl ? { icon_url: avatarUrl, avatar_url: avatarUrl } : {}),
    };
    try {
      const res = await postRequest(ROUTES.community.create, payload, {
        errorMessage: 'Failed to create community',
      });
      if (res?.success && res.data) {
        const created = {
          ...(res.data as Community),
          description: (res.data as Community).description ?? String(payload.description ?? ''),
          is_member: true,
          is_owner: true,
          current_user_role: 'owner',
        };
        setCommunities((items) => [
          created,
          ...items.filter((item) => item.id !== created.id),
        ]);
        setCreateVisible(false);
        setCreateName('');
        setCreateDesc('');
        setCreateAvatarUri(null);
      }
    } catch {
      const netState = await NetInfo.fetch().catch(() => ({ isConnected: false }));
      if (!netState.isConnected) {
        await enqueueMutation({ method: 'POST', url: ROUTES.community.create, payload });
        setCreateVisible(false);
        setCreateName('');
        setCreateDesc('');
        setCreateAvatarUri(null);
        // Optimistic: add a local placeholder so the user sees their action
        const optimistic: Community = {
          id: `local_${Date.now()}`,
          name: createName.trim(),
          slug: createName.trim().toLowerCase().replace(/\s+/g, '-'),
          description: createDesc.trim(),
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        };
        setCommunities((prev) => [optimistic, ...prev]);
        Alert.alert('Saved offline', 'Community will be created when you are back online.');
      }
    }
  }, [createName, createDesc, createAvatarUri]);

  const createPost = useCallback(async () => {
    if (!selected || !composerText.trim()) return;
    const payload = {
      community: selected.id,
      text: composerText.trim(),
    };
    // Optimistic: add a local post immediately
    const optimisticPost: Post = {
      id: `local_${Date.now()}`,
      text: composerText.trim(),
      created_at: new Date().toISOString(),
    };
    setPosts((prev) => [optimisticPost, ...prev]);
    setComposerText('');
    try {
      const res = await postRequest(ROUTES.community.posts, payload, {
        errorMessage: 'Failed to post',
      });
      if (res?.success && res.data) {
        // Replace the optimistic post with the real one
        setPosts((prev) => prev.map((p) => (p.id === optimisticPost.id ? (res.data as Post) : p)));
      } else {
        // Remove optimistic post on server error
        setPosts((prev) => prev.filter((p) => p.id !== optimisticPost.id));
      }
    } catch {
      const netState = await NetInfo.fetch().catch(() => ({ isConnected: false }));
      if (!netState.isConnected) {
        await enqueueMutation({ method: 'POST', url: ROUTES.community.posts, payload });
        // Keep the optimistic post — it will sync when back online
      } else {
        setPosts((prev) => prev.filter((p) => p.id !== optimisticPost.id));
      }
    }
  }, [selected, composerText]);

  const joinCommunity = useCallback(async (community: Community) => {
    if (community.is_member || community.is_owner) return;
    try {
      const res = await postRequest(ROUTES.community.join(community.id), {}, {
        errorMessage: 'Failed to join community',
      });
      if (res?.success) {
        const joined = { ...community, is_member: true, current_user_role: 'member' };
        setCommunities((items) => items.some((item) => item.id === joined.id) ? items : [joined, ...items]);
        setDiscoverResults((items) =>
          items.map((item) => item.id === joined.id ? joined : item),
        );
        loadCommunityDetail(joined);
      }
    } catch {
      const netState = await NetInfo.fetch().catch(() => ({ isConnected: false }));
      if (!netState.isConnected) {
        await enqueueMutation({ method: 'POST', url: ROUTES.community.join(community.id), payload: {} });
        Alert.alert('Saved offline', 'You will join this community when back online.');
      }
    }
  }, [loadCommunityDetail]);

  const searchPublicCommunities = useCallback(async (q: string) => {
    setDiscoverLoading(true);
    try {
      const query = new URLSearchParams({ public: 'true' });
      if (q.trim()) query.set('search', q.trim());
      const url = `${ROUTES.community.list}?${query.toString()}`;
      const res = await getRequest(url, { errorMessage: '' });
      const list = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setDiscoverResults(list as Community[]);
    } finally {
      setDiscoverLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!discoverVisible) return;
    const timer = setTimeout(() => void searchPublicCommunities(discoverQuery), 300);
    return () => clearTimeout(timer);
  }, [discoverQuery, discoverVisible, searchPublicCommunities]);

  const loadGroupContacts = useCallback(async () => {
    setGroupContactsLoading(true);
    setGroupCreateError('');
    try {
      const contacts = await refreshFromDeviceAndBackend();
      const eligible = contacts.filter((c) => c.isRegistered && c.userId);
      setGroupContacts(eligible);
    } catch (err) {
      console.warn('Failed to load device contacts', err);
      setGroupContacts([]);
    } finally {
      setGroupContactsLoading(false);
    }
  }, []);

  const openCreateGroup = useCallback(() => {
    setGroupCreateVisible(true);
    setGroupName('');
    setSelectedMemberIds(new Set());
    loadGroupContacts();
  }, [loadGroupContacts]);

  const toggleMember = useCallback((userId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const createGroup = useCallback(async () => {
    if (!selected) return;
    const name = groupName.trim();
    if (!name) {
      setGroupCreateError('Group name is required.');
      return;
    }
    const payload = {
      name,
      slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      community: selected.id,
    };
    let res: Awaited<ReturnType<typeof postRequest>>;
    try {
      res = await postRequest(ROUTES.groups.create, payload, {
        errorMessage: 'Failed to create group',
      });
    } catch {
      const netState = await NetInfo.fetch().catch(() => ({ isConnected: false }));
      if (!netState.isConnected) {
        await enqueueMutation({ method: 'POST', url: ROUTES.groups.create, payload });
        setGroupCreateVisible(false);
        Alert.alert('Saved offline', 'Group will be created when back online.');
        return;
      }
      setGroupCreateError('Failed to create group.');
      return;
    }
    if (!res?.success || !res.data) {
      console.warn('Create group failed', res);
      setGroupCreateError(res?.message || 'Failed to create group.');
      return;
    }

    const newGroup = res.data as Group;
    setGroups((prev) => [newGroup, ...prev]);

    const memberIds = Array.from(selectedMemberIds).filter(
      (id) => id && id !== String(currentUserId ?? ''),
    );
    if (memberIds.length) {
      const addRes = await postRequest(ROUTES.groups.addMembers(newGroup.id), {
        userIds: memberIds,
      });
      if (!addRes?.success) {
        console.warn('Add members failed', addRes);
      }
    }

    setGroupCreateVisible(false);
    setGroupName('');
    setSelectedMemberIds(new Set());
    setGroupCreateError('');
  }, [selected, groupName, selectedMemberIds, currentUserId]);

  const openGroupChat = useCallback(
    async (group: Group) => {
      if (!group?.conversation_id) {
        Alert.alert(
          'Create Chat Room',
          `"${group.name}" doesn't have a chat room yet. Create one now?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create Chat',
              onPress: async () => {
                try {
                  const res = await patchRequest(
                    ROUTES.groups.detail(group.id),
                    { create_conversation: true },
                  );
                  const updatedGroup: Group = res?.data ?? res;
                  const convId = updatedGroup?.conversation_id;
                  if (convId && onOpenChat) {
                    setGroups(prev => prev.map(g => g.id === group.id ? { ...g, conversation_id: convId } : g));
                    onOpenChat({
                      id: String(convId),
                      conversationId: String(convId),
                      name: group.name,
                      kind: 'group',
                      isGroup: true,
                      isGroupChat: true,
                      groupId: group.id,
                    });
                  } else {
                    Alert.alert('Error', 'Chat room could not be created. Please try again.');
                  }
                } catch {
                  Alert.alert('Error', 'Failed to create chat room.');
                }
              },
            },
          ],
        );
        return;
      }
      if (!onOpenChat) return;
      onOpenChat({
        id: String(group.conversation_id),
        conversationId: String(group.conversation_id),
        name: group.name,
        kind: 'group',
        isGroup: true,
        isGroupChat: true,
        groupId: group.id,
      });
    },
    [onOpenChat, setGroups],
  );

  useEffect(() => {
    loadCommunities(1);
  }, [loadCommunities]);

  useEffect(() => {
    if (communitiesPage > 1) {
      loadCommunities(communitiesPage);
    }
  }, [communitiesPage, loadCommunities]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('community.refresh', () => {
      setCommunitiesPage(1);
      setCommunitiesHasMore(true);
      loadCommunities(1);
    });
    return () => sub.remove();
  }, [loadCommunities]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('community.create', () => {
      setCreateVisible(true);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('community.discover', () => {
      setDiscoverVisible(true);
      void searchPublicCommunities('');
    });
    return () => sub.remove();
  }, [searchPublicCommunities]);

  const handleLeaveSelectedCommunity = useCallback(() => {
    if (!selected) return;
    Alert.alert(
      'Leave community',
      `Are you sure you want to leave "${selected.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRequest(ROUTES.community.leave(selected.id), {
                errorMessage: 'Failed to leave community',
              });
            } catch {
              try {
                await postRequest(ROUTES.community.leave(selected.id), {}, {
                  errorMessage: 'Failed to leave community',
                });
              } catch (err2: any) {
                Alert.alert('Error', err2?.message || 'Unable to leave community.');
                return;
              }
            }
            setSelected(null);
            void loadCommunities();
          },
        },
      ],
    );
  }, [selected, loadCommunities]);

  const header = useMemo(() => {
    if (!selected) {
      return (
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: palette.text, fontSize: responsive.headerTitleSize }]}>Communities</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => { setDiscoverVisible(true); void searchPublicCommunities(''); }} style={styles.iconBtn}>
              <KISIcon name="search" size={18} color={palette.text} />
            </Pressable>
            <Pressable onPress={() => setCreateVisible(true)} style={styles.iconBtn}>
              <KISIcon name="add" size={18} color={palette.text} />
            </Pressable>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.headerRow}>
        <Pressable onPress={() => setSelected(null)} style={styles.iconBtn}>
          <KISIcon name="back" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text, fontSize: responsive.headerTitleSize }]} numberOfLines={1}>{selected.name}</Text>
        <Pressable onPress={handleLeaveSelectedCommunity} style={styles.iconBtn} accessibilityLabel="Leave community">
          <KISIcon name="user-minus" size={18} color={palette.danger ?? palette.error} />
        </Pressable>
      </View>
    );
  }, [selected, palette.text, palette.danger, palette.error, responsive.headerTitleSize, searchPublicCommunities, handleLeaveSelectedCommunity]);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, }]}> 
      {header}
      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <View
              key={`community-skel-${idx}`}
              style={[
                styles.communityCard,
                { borderColor: palette.inputBorder, backgroundColor: palette.card },
              ]}
            >
              <View style={styles.communityRow}>
                <Skeleton width={44} height={44} radius={22} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="55%" height={12} radius={6} />
                  <Skeleton width="35%" height={10} radius={6} style={{ marginTop: 6 }} />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : selected ? (
        <View style={{ flex: 1 }}>
          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => setTab('feed')}
              style={[
                styles.segment,
                { borderColor: palette.inputBorder, backgroundColor: tab === 'feed' ? palette.surface : 'transparent' },
              ]}
            >
              <Text style={{ color: palette.text }}>Feed</Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('groups')}
              style={[
                styles.segment,
                { borderColor: palette.inputBorder, backgroundColor: tab === 'groups' ? palette.surface : 'transparent' },
              ]}
            >
              <Text style={{ color: palette.text }}>Groups</Text>
            </Pressable>
          </View>

          {tab === 'feed' ? (
            <View style={{ flex: 1 }}>
              <View style={[styles.composer, { borderColor: palette.inputBorder }]}> 
                <TextInput
                  placeholder="Write a post..."
                  placeholderTextColor={palette.subtext}
                  style={[styles.input, { color: palette.text }]}
                  value={composerText}
                  onChangeText={setComposerText}
                />
                <Pressable onPress={createPost} style={styles.iconBtn}>
                  <KISIcon name="send" size={18} color={palette.primary} />
                </Pressable>
              </View>
              <FlatList
                ref={feedListRef}
                onScroll={onScroll}
                scrollEventThrottle={16}
                data={posts}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Text style={{ color: palette.subtext, fontSize: 14 }}>No posts yet. Be the first!</Text>
                  </View>
                }
                renderItem={({ item }) => (
                    <View
                      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}
                    >
                      <Text style={{ color: palette.text, fontWeight: '600' }} numberOfLines={1}>
                        {item.author?.display_name ?? 'Member'}
                      </Text>
                      <Text style={{ color: palette.text, marginTop: 6 }} numberOfLines={5}>
                        {getFeedPlainText(item)}
                      </Text>
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Pressable onPress={openCreateGroup} style={[styles.primaryBtn, { backgroundColor: palette.primary }]}> 
                <Text style={{ color: palette.bg, fontWeight: '600' }}>Create Group</Text>
              </Pressable>
              <FlatList
                ref={groupsListRef}
                onScroll={onScroll}
                scrollEventThrottle={16}
                data={groups}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => openGroupChat(item)}
                    style={[
                      chatListStyles.row,
                      { backgroundColor: palette.card, borderColor: palette.inputBorder },
                    ]}
                  >
                    <ImagePlaceholder size={44} radius={22} style={chatListStyles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={[chatListStyles.name, { color: palette.text }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={{ color: palette.subtext, marginTop: 2 }} numberOfLines={1}>
                        {item.conversation_id ? 'Tap to open chat' : 'No chat linked yet'}
                      </Text>
                    </View>
                    <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                  </Pressable>
                )}
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              />
            </View>
          )}
        </View>
      ) : (
        <FlatList
          ref={communitiesListRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          data={communities}
          keyExtractor={(item) => item.id}
          onEndReached={() => {
            if (communitiesHasMore && !loading) {
              setCommunitiesPage((p) => p + 1);
            }
          }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setSelected(null);
                openCommunity(item);
              }}
              style={[
                chatListStyles.row,
                { backgroundColor: palette.card, borderColor: palette.inputBorder },
              ]}
            >
              <ImagePlaceholder size={44} radius={22} style={chatListStyles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={[chatListStyles.name, { color: palette.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: palette.subtext, marginTop: 2 }} numberOfLines={2}>
                  {item.description || 'No description'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '600' }}>
                  {item.is_owner
                    ? 'Owner'
                    : item.current_user_role
                    ? item.current_user_role.replace(/^./, (value) => value.toUpperCase())
                    : 'Member'}
                </Text>
                <KISIcon name="chevron-right" size={16} color={palette.subtext} />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ color: loadError ? (palette.danger) : palette.subtext, padding: 8 }}>
              {loadError ?? 'No communities yet.'}
            </Text>
          }
          ListFooterComponent={
            communitiesHasMore && !loading && communities.length > 0
              ? <ActivityIndicator color={palette.primary} style={{ marginVertical: 12 }} />
              : null
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}

      <Modal visible={createVisible} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: palette.backdrop }]}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 12 }}>Create Community</Text>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Pressable
                onPress={handlePickCreateAvatar}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: palette.surface ?? palette.card,
                  borderWidth: 2,
                  borderColor: palette.inputBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {createAvatarUri ? (
                  <Image source={{ uri: createAvatarUri }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                ) : (
                  <KISIcon name="camera" size={24} color={palette.subtext} />
                )}
              </Pressable>
            </View>
            <TextInput
              placeholder="Community name"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { color: palette.text, borderColor: palette.inputBorder }]}
              value={createName}
              onChangeText={setCreateName}
            />
            <TextInput
              placeholder="Description"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { color: palette.text, borderColor: palette.inputBorder, marginTop: 8 }]}
              value={createDesc}
              onChangeText={setCreateDesc}
            />
            <View style={styles.modalRow}>
              <Pressable onPress={() => { setCreateVisible(false); setCreateAvatarUri(null); }} style={styles.iconBtn}>
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={createCommunity} style={styles.iconBtn}>
                <Text style={{ color: palette.primary }}>Create</Text>
              </Pressable>
            </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      <Modal visible={groupCreateVisible} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: palette.backdrop }]}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 12 }}>Create Group</Text>
            <TextInput
              placeholder="Group name"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { color: palette.text, borderColor: palette.inputBorder }]}
              value={groupName}
              onChangeText={setGroupName}
            />

            <Text style={{ color: palette.subtext, marginTop: 12, marginBottom: 6 }}>
              Select members (KIS contacts only)
            </Text>
            {groupContactsLoading ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <FlatList
                data={groupContacts}
                keyExtractor={(item) => item.userId ?? item.id}
                style={{ maxHeight: 220 }}
                ListEmptyComponent={
                  <Text style={{ color: palette.subtext }}>No KIS contacts found.</Text>
                }
                renderItem={({ item }) => {
                  const userId = item.userId ? String(item.userId) : '';
                  const selected = userId && selectedMemberIds.has(userId);
                  return (
                    <Pressable
                      onPress={() => userId && toggleMember(userId)}
                      style={[
                        styles.memberRow,
                        { borderColor: palette.inputBorder, backgroundColor: selected ? palette.surface : 'transparent' },
                      ]}
                    >
                      <Text style={{ color: palette.text }}>
                        {item.name} {item.phone ? `(${item.phone})` : ''}
                      </Text>
                      {selected && <KISIcon name="check" size={16} color={palette.primary} />}
                    </Pressable>
                  );
                }}
              />
            )}

            {!!groupCreateError && (
              <Text style={{ color: palette.danger, marginTop: 8 }}>{groupCreateError}</Text>
            )}

            <View style={styles.modalRow}>
              <Pressable onPress={() => setGroupCreateVisible(false)} style={styles.iconBtn}>
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={createGroup} style={styles.iconBtn}>
                <Text style={{ color: palette.primary }}>Create</Text>
              </Pressable>
            </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      <Animated.View
        pointerEvents={communityVisible ? 'auto' : 'none'}
        style={[
          styles.overlay,
          {
            transform: [{ translateX: communitySlide }],
            backgroundColor: palette.bg,
            zIndex: 10,
          },
        ]}
      >
        {activeCommunity ? (
          <CommunityRoomPage
            community={activeCommunity}
            onBack={closeCommunity}
            onOpenChat={(chat) => onOpenChat?.(chat)}
            onOpenInfo={openCommunityInfo}
          />
        ) : null}
      </Animated.View>

      <Animated.View
        pointerEvents={infoVisible ? 'auto' : 'none'}
        style={[
          styles.overlay,
          {
            transform: [{ translateX: infoSlide }],
            backgroundColor: palette.bg,
            zIndex: 11,
          },
        ]}
      >
        {activeInfo ? (
          <CommunityInfoPage
            communityId={activeInfo.id}
            communityName={activeInfo.name}
            currentUserId={currentUserId ?? null}
            onBack={closeCommunityInfo}
          />
        ) : null}
      </Animated.View>

      {/* ── Discover Communities Modal ── */}
      <Modal visible={discoverVisible} animationType="slide" onRequestClose={() => setDiscoverVisible(false)}>
        <View style={{ flex: 1, backgroundColor: palette.bg, }}>
          <View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: palette.divider ?? palette.inputBorder, paddingTop: topInset }]}>
            <Pressable onPress={() => setDiscoverVisible(false)} style={styles.iconBtn}>
              <KISIcon name="close" size={20} color={palette.text} />
            </Pressable>
            <Text style={[styles.title, { color: palette.text, fontSize: responsive.headerTitleSize }]}>Discover Communities</Text>
          </View>
          <View style={{ padding: 12 }}>
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', borderColor: palette.inputBorder, paddingVertical: 8, paddingHorizontal: 12 }]}>
              <KISIcon name="search" size={16} color={palette.subtext} />
              <TextInput
                style={{ flex: 1, marginLeft: 8, color: palette.text }}
                placeholder="Search communities…"
                placeholderTextColor={palette.subtext}
                value={discoverQuery}
                onChangeText={setDiscoverQuery}
                autoFocus
              />
            </View>
          </View>
          {discoverLoading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={discoverResults}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: insets.bottom + 12 }}
              ListEmptyComponent={
                <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 24 }}>
                  {discoverQuery ? 'No communities found.' : 'Start typing to search communities.'}
                </Text>
              }
              renderItem={({ item }) => (
                <View style={[chatListStyles.row, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
                  <ImagePlaceholder size={44} radius={22} style={chatListStyles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={[chatListStyles.name, { color: palette.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }} numberOfLines={2}>
                      {item.description || 'No description'}
                    </Text>
                  </View>
                  {item.is_member || item.is_owner ? (
                    <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: '700' }}>
                      {item.is_owner ? 'Owner' : 'Joined'}
                    </Text>
                  ) : (
                    <Pressable
                      onPress={() => {
                        void joinCommunity(item);
                        setDiscoverVisible(false);
                      }}
                      style={[styles.joinBtn, { backgroundColor: palette.primary }]}
                    >
                      <Text style={{ color: palette.onPrimary, fontSize: 11, fontWeight: '700' }}>Join</Text>
                    </Pressable>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
});

export default CommunitiesTab;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  card: { padding: 12, borderRadius: 12, borderWidth: 2, marginBottom: 10 },
  communityCard: { padding: 12, borderRadius: 12, borderWidth: 2, marginBottom: 10 },
  communityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  composer: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 10, paddingHorizontal: 8, marginBottom: 12 },
  input: { flex: 1, paddingVertical: 8, paddingHorizontal: 8 },
  primaryBtn: { paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '88%', borderRadius: 14, borderWidth: 2, padding: 16 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  memberRow: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 2, borderRadius: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  joinBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
