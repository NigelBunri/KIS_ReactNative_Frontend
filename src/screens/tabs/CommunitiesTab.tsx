import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  useWindowDimensions,
  DeviceEventEmitter,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import Skeleton from '@/components/common/Skeleton';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import { styles as chatListStyles } from '@/Module/ChatRoom/messagesUtils';
import { refreshFromDeviceAndBackend, type KISContact } from '@/Module/AddContacts/contactsService';
import { useSocket } from '../../../SocketProvider';
import CommunityRoomPage from '@/Module/Community/CommunityRoomPage';
import CommunityInfoPage from '@/Module/Community/CommunityInfoPage';

type Community = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar_url?: string;
  main_conversation_id?: string;
  posts_conversation_id?: string;
};

type Post = {
  id: string;
  text?: string;
  created_at?: string;
  author?: { display_name?: string };
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
};

export default function CommunitiesTab({ onOpenChat }: CommunitiesTabProps) {
  const { palette } = useKISTheme();
  const { width } = useWindowDimensions();
  const { currentUserId } = useSocket();
  const [loading, setLoading] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selected, setSelected] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<'feed' | 'groups'>('feed');
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
  const [groupCreateVisible, setGroupCreateVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupContacts, setGroupContacts] = useState<KISContact[]>([]);
  const [groupContactsLoading, setGroupContactsLoading] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [groupCreateError, setGroupCreateError] = useState('');

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(ROUTES.community.list, {
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
      setCommunities(list as Community[]);
    } finally {
      setLoading(false);
    }
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
    const payload = {
      name: createName.trim(),
      slug: createName.trim().toLowerCase().replace(/\s+/g, '-'),
      description: createDesc.trim(),
      create_main_conversation: true,
      create_posts_conversation: true,
    };
    const res = await postRequest(ROUTES.community.create, payload, {
      errorMessage: 'Failed to create community',
    });
    if (res?.success) {
      setCreateVisible(false);
      setCreateName('');
      setCreateDesc('');
      loadCommunities();
    }
  }, [createName, createDesc, loadCommunities]);

  const createPost = useCallback(async () => {
    if (!selected || !composerText.trim()) return;
    const payload = {
      community: selected.id,
      text: composerText.trim(),
    };
    const res = await postRequest(ROUTES.community.posts, payload, {
      errorMessage: 'Failed to post',
    });
    if (res?.success && res.data) {
      setComposerText('');
      setPosts((prev) => [res.data as Post, ...prev]);
    }
  }, [selected, composerText]);

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
    const res = await postRequest(ROUTES.groups.create, payload, {
      errorMessage: 'Failed to create group',
    });
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
    (group: Group) => {
      if (!onOpenChat || !group?.conversation_id) return;
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
    [onOpenChat],
  );

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('community.refresh', () => {
      loadCommunities();
    });
    return () => sub.remove();
  }, [loadCommunities]);

  const header = useMemo(() => {
    if (!selected) {
      return (
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: palette.text }]}>Communities</Text>
          <Pressable onPress={() => setCreateVisible(true)} style={styles.iconBtn}>
            <KISIcon name="add" size={18} color={palette.text} />
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.headerRow}>
        <Pressable onPress={() => setSelected(null)} style={styles.iconBtn}>
          <KISIcon name="back" size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.title, { color: palette.text }]}>{selected.name}</Text>
      </View>
    );
  }, [selected, palette.text]);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}> 
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
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}> 
                    <Text style={{ color: palette.text, fontWeight: '600' }}>
                      {item.author?.display_name ?? 'Member'}
                    </Text>
                    <Text style={{ color: palette.text, marginTop: 6 }}>{item.text ?? ''}</Text>
                  </View>
                )}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Pressable onPress={openCreateGroup} style={[styles.primaryBtn, { backgroundColor: palette.primary }]}> 
                <Text style={{ color: palette.bg, fontWeight: '600' }}>Create Group</Text>
              </Pressable>
              <FlatList
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
                      <Text style={[chatListStyles.name, { color: palette.text }]}>{item.name}</Text>
                      <Text style={{ color: palette.subtext, marginTop: 2 }} numberOfLines={1}>
                        {item.conversation_id ? 'Tap to open chat' : 'No chat linked yet'}
                      </Text>
                    </View>
                    <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                  </Pressable>
                )}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={communities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                loadCommunityDetail(item);
                openCommunity(item);
              }}
              style={[
                chatListStyles.row,
                { backgroundColor: palette.card, borderColor: palette.inputBorder },
              ]}
            >
              <ImagePlaceholder size={44} radius={22} style={chatListStyles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={[chatListStyles.name, { color: palette.text }]}>{item.name}</Text>
                <Text style={{ color: palette.subtext, marginTop: 2 }} numberOfLines={2}>
                  {item.description || 'No description'}
                </Text>
              </View>
              <KISIcon name="chevron-right" size={16} color={palette.subtext} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ color: palette.subtext }}>No communities yet.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <Modal visible={createVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}> 
            <Text style={{ color: palette.text, fontWeight: '600', marginBottom: 12 }}>Create Community</Text>
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
              <Pressable onPress={() => setCreateVisible(false)} style={styles.iconBtn}>
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={createCommunity} style={styles.iconBtn}>
                <Text style={{ color: palette.primary }}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={groupCreateVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
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
              <Text style={{ color: palette.danger ?? '#d9534f', marginTop: 8 }}>{groupCreateError}</Text>
            )}

            <View style={styles.modalRow}>
              <Pressable onPress={() => setGroupCreateVisible(false)} style={styles.iconBtn}>
                <Text style={{ color: palette.text }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={createGroup} style={styles.iconBtn}>
                <Text style={{ color: palette.primary }}>Create</Text>
              </Pressable>
            </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  card: { padding: 12, borderRadius: 12, borderWidth: 2, marginBottom: 10 },
  communityCard: { padding: 12, borderRadius: 12, borderWidth: 2, marginBottom: 10 },
  communityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 6 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  composer: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 10, paddingHorizontal: 8, marginBottom: 12 },
  input: { flex: 1, paddingVertical: 8, paddingHorizontal: 8 },
  primaryBtn: { paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { width: '88%', borderRadius: 14, borderWidth: 2, padding: 16 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  memberRow: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 2, borderRadius: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
