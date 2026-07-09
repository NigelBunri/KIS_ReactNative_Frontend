import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { loadMessages } from '@/Module/ChatRoom/Storage/chatStorage';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';
import { styles as chatListStyles } from '@/Module/ChatRoom/messagesUtils';
import { KISIcon } from '@/constants/kisIcons';
import { markMainTabNotificationSourceRead } from '@/services/mainTabNotificationBadges';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import Skeleton from '@/components/common/Skeleton';
import AddContactsPage from '@/Module/AddContacts/AddContactsPage';
import CommunityFeedScreen from '@/components/feeds/CommunityFeedScreen';
import { getFeedPlainText } from '@/components/feeds/richTextValue';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

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
  text?: unknown;
  text_plain?: string;
  text_preview?: string;
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
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMeta, setGroupMeta] = useState<Record<string, { lastAt?: string; lastMessage?: string }>>({});
  const [showFeed, setShowFeed] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const pendingMetaIds = useRef<Set<string>>(new Set());

  const loadCommunityData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [postsResult, groupsResult] = await Promise.allSettled([
        getRequest(`${ROUTES.community.posts}?community=${community.id}`, {
          errorMessage: 'Failed to load posts',
        }),
        getRequest(`${ROUTES.groups.list}?community=${community.id}`, {
          errorMessage: 'Failed to load groups',
        }),
      ]);

      const allFailed =
        postsResult.status === 'rejected' && groupsResult.status === 'rejected';
      if (allFailed) {
        setLoadError(true);
      }

      if (postsResult.status === 'fulfilled') {
        const postsRes = postsResult.value;
        const postList = Array.isArray(postsRes?.data?.results)
          ? postsRes.data.results
          : Array.isArray(postsRes?.results)
          ? postsRes.results
          : postsRes?.data ?? postsRes ?? [];
        setPosts(Array.isArray(postList) ? postList : []);
      }

      if (groupsResult.status === 'fulfilled') {
        const groupsRes = groupsResult.value;
        const groupList = Array.isArray(groupsRes?.data?.results)
          ? groupsRes.data.results
          : Array.isArray(groupsRes?.results)
          ? groupsRes.results
          : groupsRes?.data ?? groupsRes ?? [];
        setGroups(Array.isArray(groupList) ? groupList : []);
      }
    } finally {
      setLoading(false);
    }
  }, [community.id]);

  useEffect(() => {
    setPosts([]);
    setGroups([]);
    setGroupMeta({});
    loadCommunityData();
  }, [loadCommunityData]);

  useEffect(() => {
    if (!community?.id) return;
    markMainTabNotificationSourceRead({
      source: 'partners',
      targetType: 'partner_community',
      targetId: community.id,
    }).catch(() => undefined);
  }, [community?.id]);

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
    markMainTabNotificationSourceRead({
      source: 'partners',
      targetType: 'partner_group',
      targetId: group.id,
    }).catch(() => undefined);
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
        onBack={() => {
          setShowFeed(false);
          loadCommunityData().catch(() => undefined);
        }}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: topInset }]}>
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

      {loading && groups.length === 0 && (
        <View style={[styles.center, { flex: 0, paddingVertical: 32 }]}>
          <ActivityIndicator color={palette.primary} />
        </View>
      )}

      {!loading && loadError && (
        <View style={{ marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: (palette.danger) + '18', borderWidth: 1, borderColor: palette.danger }}>
          <Text style={{ color: palette.danger, fontSize: 14, fontWeight: '600', marginBottom: 6 }}>
            Could not load community data.
          </Text>
          <Pressable onPress={() => loadCommunityData()}>
            <Text style={{ color: palette.danger, fontSize: 13, textDecorationLine: 'underline' }}>
              Tap to retry
            </Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={loading ? [] : sortedGroups}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={({ viewableItems }) => {
          const ids = viewableItems
            .map((v) => v.item?.id)
            .filter(Boolean) as string[];
          if (ids.length) loadMetaFor(ids);
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        ListHeaderComponent={
          <>
            <View style={styles.section}>
              <Pressable
                onPress={() => setShowFeed(true)}
                style={[
                  styles.feedCard,
                  {
                    borderColor: palette.primaryStrong,
                    backgroundColor: palette.card,
                  },
                ]}
              >
                <View style={styles.feedHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: palette.subtext }]}>Main feed</Text>
                  <KISIcon name="chevron-right" size={16} color={palette.subtext} />
                </View>
                {loading ? (
                  <View style={styles.feedLoading}>
                    <Skeleton width="70%" height={11} radius={6} />
                    <Skeleton width="48%" height={9} radius={5} style={styles.feedLoadingLine} />
                  </View>
                ) : posts.length === 0 ? (
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    No posts yet. Tap to open the community feed.
                  </Text>
                ) : (
                  posts.slice(0, 2).map((p) => (
                    <View key={p.id} style={{ marginTop: 8 }}>
                      <Text style={{ color: palette.text, fontWeight: '600' }}>
                        {p.author?.display_name ?? 'Member'}
                      </Text>
                      <Text style={{ color: palette.text, marginTop: 4 }} numberOfLines={2}>
                        {getFeedPlainText(p)}
                      </Text>
                    </View>
                  ))
                )}
              </Pressable>
            </View>
            {loading ? (
              <View style={styles.loadingGroups}>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <View
                    key={`group-skel-${idx}`}
                    style={[styles.card, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}
                  >
                    <View style={styles.cardRow}>
                      <Skeleton width={44} height={44} radius={22} />
                      <View style={styles.skeletonText}>
                        <Skeleton width="60%" height={12} radius={6} />
                        <Skeleton width="40%" height={10} radius={6} style={styles.skeletonLine} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
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
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          ListEmptyComponent={
            <View style={styles.section}>
              <Text style={{ color: palette.subtext }}>No groups yet.</Text>
            </View>
          }
      />

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
  feedCard: { borderWidth: 1, borderRadius: 26, padding: 16, marginBottom: 10 },
  feedHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedLoading: { paddingVertical: 4 },
  feedLoadingLine: { marginTop: 7 },
  loadingGroups: { gap: 12 },
  skeletonText: { flex: 1 },
  skeletonLine: { marginTop: 6 },
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
