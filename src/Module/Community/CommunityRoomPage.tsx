import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { loadMessages } from '@/Module/ChatRoom/Storage/chatStorage';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import { styles as chatListStyles } from '@/Module/ChatRoom/messagesUtils';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import Skeleton from '@/components/common/Skeleton';
import AddContactsPage from '@/Module/AddContacts/AddContactsPage';
import CommunityFeedScreen from '@/components/feeds/CommunityFeedScreen';

type Community = {
  id: string;
  name: string;
  description?: string;
  main_conversation_id?: string;
  posts_conversation_id?: string;
};

type Group = {
  id: string;
  name: string;
  conversation_id?: string;
};

type Post = {
  id: string;
  text?: string;
  created_at?: string;
  author?: { display_name?: string };
};

type CommunityRoomPageProps = {
  community: Community;
  onBack: () => void;
  onOpenChat: (chat: Chat) => void;
  onOpenInfo: (community: { id: string; name: string }) => void;
};

export default function CommunityRoomPage({
  community,
  onBack,
  onOpenChat,
  onOpenInfo,
}: CommunityRoomPageProps) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMeta, setGroupMeta] = useState<Record<string, { lastAt?: string; lastMessage?: string }>>({});
  const [showFeed, setShowFeed] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const pendingMetaIds = useRef<Set<string>>(new Set());

  const loadCommunityData = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, groupsRes] = await Promise.all([
        getRequest(`${ROUTES.community.posts}?community=${community.id}`, {
          errorMessage: 'Failed to load posts',
        }),
        getRequest(`${ROUTES.groups.list}?community=${community.id}`, {
          errorMessage: 'Failed to load groups',
        }),
      ]);

      const postList = postsRes?.data ?? postsRes ?? [];
      setPosts(Array.isArray(postList) ? postList : []);

      const groupList = Array.isArray(groupsRes?.data?.results)
        ? groupsRes.data.results
        : Array.isArray(groupsRes?.results)
        ? groupsRes.results
        : groupsRes?.data ?? groupsRes ?? [];
      setGroups(Array.isArray(groupList) ? groupList : []);
    } finally {
      setLoading(false);
    }
  }, [community.id]);

  useEffect(() => {
    loadCommunityData();
  }, [loadCommunityData]);

  const loadMetaFor = useCallback(async (groupIds: string[]) => {
    const next: Record<string, { lastAt?: string; lastMessage?: string }> = {};
    await Promise.all(
      groupIds.map(async (id) => {
        const g = groups.find((item) => item.id === id);
        if (!g?.conversation_id) return;
        if (pendingMetaIds.current.has(id)) return;
        pendingMetaIds.current.add(id);
        const messages = await loadMessages(g.conversation_id);
        if (messages.length) {
          const last = messages[messages.length - 1];
          next[id] = {
            lastAt: last.createdAt,
            lastMessage: last.text ?? '',
          };
        }
      })
    );
    if (Object.keys(next).length) {
      setGroupMeta((prev) => ({ ...prev, ...next }));
    }
  }, [groups]);

  const sortedGroups = useMemo(() => {
    const withTime = groups.map((g) => {
      const meta = groupMeta[g.id];
      return {
        ...g,
        _lastAt: meta?.lastAt ?? '',
        _lastMessage: meta?.lastMessage ?? '',
      };
    });
    return withTime.sort((a, b) => {
      const aTs = Date.parse(a._lastAt || '');
      const bTs = Date.parse(b._lastAt || '');
      if (!Number.isNaN(aTs) && !Number.isNaN(bTs)) return bTs - aTs;
      if (!Number.isNaN(aTs)) return -1;
      if (!Number.isNaN(bTs)) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [groups, groupMeta]);

  const openGroupChat = (group: Group) => {
    if (!group.conversation_id) return;
    onOpenChat({
      id: String(group.conversation_id),
      conversationId: String(group.conversation_id),
      name: group.name,
      kind: 'group',
      isGroup: true,
      isGroupChat: true,
      groupId: group.id,
    });
  };

  if (showFeed) {
    return (
      <CommunityFeedScreen
        community={community}
        onBack={() => setShowFeed(false)}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider, backgroundColor: palette.card }]}>
        <Pressable onPress={onBack} style={styles.headerButton}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Pressable
          onPress={() => onOpenInfo({ id: community.id, name: community.name })}
          style={({ pressed }) => [
            styles.headerTitleWrap,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <ImagePlaceholder size={32} radius={16} style={styles.headerAvatar} />
          <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
            {community.name}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View
              key={`group-skel-${idx}`}
              style={[styles.card, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}
            >
              <View style={styles.cardRow}>
                <Skeleton width={44} height={44} radius={22} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="60%" height={12} radius={6} />
                  <Skeleton width="40%" height={10} radius={6} style={{ marginTop: 6 }} />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={sortedGroups}
          keyExtractor={(item) => item.id}
          onViewableItemsChanged={({ viewableItems }) => {
            const ids = viewableItems
              .map((v) => v.item?.id)
              .filter(Boolean) as string[];
            if (ids.length) loadMetaFor(ids);
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
          ListHeaderComponent={
            <View style={styles.section}>
              <Pressable
                onPress={() => setShowFeed(true)}
                style={[styles.feedCard, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}
              >
                <View style={styles.feedHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: palette.subtext }]}>Feed</Text>
                  <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                </View>
                {posts.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    No posts yet.
                  </Text>
                ) : (
                  posts.slice(0, 2).map((p) => (
                    <View key={p.id} style={{ marginTop: 8 }}>
                      <Text style={{ color: palette.text, fontWeight: '600' }}>
                        {p.author?.display_name ?? 'Member'}
                      </Text>
                      <Text style={{ color: palette.text, marginTop: 4 }} numberOfLines={2}>
                        {p.text ?? ''}
                      </Text>
                    </View>
                  ))
                )}
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openGroupChat(item)}
              style={[
                chatListStyles.row,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.inputBorder,
                },
              ]}
            >
              <ImagePlaceholder size={44} radius={22} style={chatListStyles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={[chatListStyles.name, { color: palette.text }]}>{item.name}</Text>
                {item._lastMessage ? (
                  <Text style={{ color: palette.subtext }} numberOfLines={1}>
                    {item._lastMessage}
                  </Text>
                ) : (
                  <Text style={{ color: palette.subtext }} numberOfLines={1}>
                    No messages yet
                  </Text>
                )}
              </View>
              <KISIcon name="chevron-right" size={16} color={palette.subtext} />
            </Pressable>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={styles.section}>
              <Text style={{ color: palette.subtext }}>No groups yet.</Text>
            </View>
          }
        />
      )}

      {showGroupCreate ? (
        <View style={styles.overlay}>
          <AddContactsPage
            onClose={() => {
              setShowGroupCreate(false);
              loadCommunityData();
            }}
            onOpenChat={(chat) => {
              setShowGroupCreate(false);
              loadCommunityData();
              onOpenChat(chat);
            }}
            initialMode="addGroup"
            initialGroupContext={{
              communityId: community.id,
              communityName: community.name,
            }}
          />
        </View>
      ) : null}

      <Pressable
        onPress={() => setShowGroupCreate(true)}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: palette.primary,
            opacity: pressed ? 0.85 : 1,
            shadowColor: palette.primary,
          },
        ]}
      >
        <KISIcon name="people" size={22} color={palette.bg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  card: { borderWidth: 2, borderRadius: 16, padding: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  feedCard: { borderWidth: 2, borderRadius: 12, padding: 12, marginBottom: 10 },
  feedHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
