/**
 * PartnerMessagingView — messaging tab scoped to a single partner organization.
 * Loads the partner's groups, channels, and communities, then displays them
 * as a conversation list. Tapping any entry opens ChatRoomPage directly.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { ChatRoomPage } from '@/Module/ChatRoom/ChatRoomPage';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';

type ConvItem = {
  id: string;
  name: string;
  kind: 'group' | 'channel' | 'community';
  conversationId: string | null | undefined;
  avatarUrl?: string | null;
  description?: string | null;
};

type Props = {
  partnerId: string;
  partnerName: string;
};

export default function PartnerMessagingView({ partnerId, partnerName }: Props) {
  const { palette } = useKISTheme();
  const [items, setItems] = useState<ConvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [groupsRes, channelsRes, commRes] = await Promise.all([
        getRequest(`${ROUTES.groups.list}?partner=${partnerId}`),
        getRequest(`${ROUTES.channels.getAllChannels}?partner=${partnerId}`),
        getRequest(`${ROUTES.community.list}?partner=${partnerId}`),
      ]);

      const groups: ConvItem[] = (groupsRes?.data?.results ?? groupsRes?.data ?? [])
        .filter((g: any) => !g.community)
        .map((g: any) => ({
          id: String(g.id),
          name: g.name,
          kind: 'group' as const,
          conversationId: g.conversation_id ?? g.conversationId,
          avatarUrl: g.avatar_url,
          description: g.description,
        }));

      const channels: ConvItem[] = (channelsRes?.data?.results ?? channelsRes?.data ?? [])
        .filter((c: any) => !c.community)
        .map((c: any) => ({
          id: String(c.id),
          name: c.name,
          kind: 'channel' as const,
          conversationId: c.conversation_id ?? c.conversationId,
          avatarUrl: c.avatar_url,
          description: c.description,
        }));

      const communities: ConvItem[] = (commRes?.data?.results ?? commRes?.data ?? [])
        .map((c: any) => ({
          id: String(c.id),
          name: c.name,
          kind: 'community' as const,
          conversationId: c.main_conversation_id ?? c.mainConversationId,
          avatarUrl: c.avatar_url,
          description: c.description,
        }));

      setItems([...communities, ...groups, ...channels]);
    } catch { /* silently ignored */ }
  }, [partnerId]);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleOpenItem = useCallback((item: ConvItem) => {
    if (!item.conversationId) return;
    const chat: Chat = {
      id: item.conversationId,
      name: item.name,
      avatarUrl: item.avatarUrl ?? undefined,
      conversationId: item.conversationId,
      kind: item.kind === 'community' ? 'community' : item.kind === 'channel' ? 'channel' : 'group',
      isGroup: item.kind !== 'channel',
    };
    setActiveChat(chat);
  }, []);

  if (activeChat) {
    return (
      <View style={{ flex: 1 }}>
        <ChatRoomPage chat={activeChat} onBack={() => setActiveChat(null)} />
      </View>
    );
  }

  const ICON: Record<ConvItem['kind'], string> = {
    community: '🏘',
    group: '👥',
    channel: '#',
  };

  const KIND_LABEL: Record<ConvItem['kind'], string> = {
    community: 'Community',
    group: 'Group',
    channel: 'Channel',
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.surface }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider, backgroundColor: palette.surfaceElevated }]}>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{partnerName}</Text>
        <Text style={[styles.headerSub, { color: palette.subtext }]}>Workspace</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => `${i.kind}-${i.id}`}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} />
          }
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Text style={{ fontSize: 36 }}>💬</Text>
              <Text style={[styles.empty, { color: palette.subtext }]}>
                No groups or channels yet.{'\n'}Create them from the partner section.
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleOpenItem(item)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomColor: palette.divider,
                  backgroundColor: pressed ? palette.primary + '0A' : 'transparent',
                  opacity: item.conversationId ? 1 : 0.45,
                },
              ]}
              disabled={!item.conversationId}
            >
              <View style={[styles.avatar, { backgroundColor: palette.primary + '22' }]}>
                <Text style={{ fontSize: item.kind === 'channel' ? 18 : 20, color: palette.primary, fontWeight: '700' }}>
                  {ICON[item.kind]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: palette.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.rowSub, { color: palette.subtext }]} numberOfLines={1}>
                  {KIND_LABEL[item.kind]}{item.description ? ` · ${item.description}` : ''}
                </Text>
              </View>
              <Text style={{ color: palette.subtext, fontSize: 18 }}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  empty: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
});
