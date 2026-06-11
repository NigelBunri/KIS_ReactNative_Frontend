// src/screens/tabs/MesssagingSubTabs/HubTab.tsx
// Channels & Broadcasts hub — WhatsApp-style "channels" discovery + subscribed feed

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import Skeleton from '@/components/common/Skeleton';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';

type Channel = {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  subscriber_count?: number;
  is_subscribed?: boolean;
  conversation_id?: string;
  last_message?: string;
  last_message_at?: string;
};

type HubTabProps = {
  searchTerm?: string;
  onOpenChat?: (chat: Chat) => void;
};

export default function HubTab({ searchTerm = '', onOpenChat }: HubTabProps) {
  const { palette } = useKISTheme();

  const [subscribed, setSubscribed] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [discoverVisible, setDiscoverVisible] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverResults, setDiscoverResults] = useState<Channel[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const loadSubscribed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(`${ROUTES.channels.getAllChannels}?subscribed=true`, {
        errorMessage: '',
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
      setSubscribed(list as Channel[]);
    } catch {
      setSubscribed([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchChannels = useCallback(async (q: string) => {
    setDiscoverLoading(true);
    try {
      const url = q.trim()
        ? `${ROUTES.channels.getAllChannels}?search=${encodeURIComponent(q.trim())}`
        : ROUTES.channels.getAllChannels;
      const res = await getRequest(url, { errorMessage: '' });
      const list = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setDiscoverResults(list as Channel[]);
    } catch {
      setDiscoverResults([]);
    } finally {
      setDiscoverLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscribed();
  }, [loadSubscribed]);

  useEffect(() => {
    if (!discoverVisible) return;
    const t = setTimeout(() => void searchChannels(discoverQuery), 300);
    return () => clearTimeout(t);
  }, [discoverQuery, discoverVisible, searchChannels]);

  const handleSubscribe = useCallback(async (channel: Channel) => {
    if (subscribing) return;
    setSubscribing(channel.id);
    try {
      const res = await postRequest(
        ROUTES.channels.subscribeChannel(channel.id),
        {},
        { errorMessage: '' },
      );
      if (res?.success || res?.ok || (res as any)?.status === 'subscribed') {
        const updated = { ...channel, is_subscribed: true };
        setDiscoverResults(prev => prev.map(c => c.id === channel.id ? updated : c));
        setSubscribed(prev => {
          const exists = prev.some(c => c.id === channel.id);
          return exists ? prev.map(c => c.id === channel.id ? updated : c) : [updated, ...prev];
        });
      }
    } catch {
      // best-effort
    } finally {
      setSubscribing(null);
    }
  }, [subscribing]);

  const handleUnsubscribe = useCallback(async (channel: Channel) => {
    if (subscribing) return;
    setSubscribing(channel.id);
    try {
      await postRequest(
        `${ROUTES.channels.subscribeChannel(channel.id)}unsubscribe/`,
        {},
        { errorMessage: '' },
      );
      setSubscribed(prev => prev.filter(c => c.id !== channel.id));
      setDiscoverResults(prev => prev.map(c => c.id === channel.id ? { ...c, is_subscribed: false } : c));
    } catch {
      // best-effort
    } finally {
      setSubscribing(null);
    }
  }, [subscribing]);

  const openChannelChat = useCallback(
    (channel: Channel) => {
      if (!onOpenChat || !channel.conversation_id) return;
      onOpenChat({
        id: String(channel.conversation_id),
        conversationId: String(channel.conversation_id),
        name: channel.name,
        kind: 'channel',
        isGroup: false,
        avatarUrl: channel.avatar_url,
      });
    },
    [onOpenChat],
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return subscribed;
    return subscribed.filter(c => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q));
  }, [subscribed, searchTerm]);

  const renderChannelRow = ({ item }: { item: Channel }) => (
    <Pressable
      onPress={() => openChannelChat(item)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? (palette.surface ?? '#f5f5f5') : 'transparent', borderBottomColor: palette.divider ?? palette.inputBorder },
      ]}
    >
      {item.avatar_url ? (
        <View style={[styles.avatar, { overflow: 'hidden', borderRadius: 22 }]}>
          <ImagePlaceholder size={44} radius={22} />
        </View>
      ) : (
        <View style={[styles.avatar, { backgroundColor: palette.primarySoft ?? palette.surface, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }]}>
          <KISIcon name="broadcast" size={20} color={palette.primary ?? '#C9A227'} />
        </View>
      )}
      <View style={styles.rowContent}>
        <Text style={[styles.rowName, { color: palette.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.rowSub, { color: palette.subtext }]} numberOfLines={1}>
          {item.last_message || item.description || 'Channel'}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {item.last_message_at ? (
          <Text style={[styles.rowTime, { color: palette.subtext }]}>
            {formatTime(item.last_message_at)}
          </Text>
        ) : null}
        <KISIcon name="chevron-right" size={14} color={palette.subtext} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.divider ?? palette.inputBorder }]}>
        <Text style={[styles.title, { color: palette.text }]}>Channels</Text>
        <Pressable
          onPress={() => { setDiscoverVisible(true); void searchChannels(''); }}
          style={styles.headerBtn}
          hitSlop={8}
        >
          <KISIcon name="search" size={20} color={palette.text} />
        </Pressable>
      </View>

      {/* Subscribed channel list */}
      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.row, { borderBottomColor: palette.divider ?? palette.inputBorder }]}>
              <Skeleton width={44} height={44} radius={22} />
              <View style={styles.rowContent}>
                <Skeleton width={120} height={12} radius={6} />
                <Skeleton width={180} height={10} radius={6} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <KISIcon name="broadcast" size={48} color={palette.divider ?? '#ccc'} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No channels yet</Text>
          <Text style={[styles.emptySub, { color: palette.subtext }]}>
            Follow channels to get updates from people and organizations.
          </Text>
          <Pressable
            onPress={() => { setDiscoverVisible(true); void searchChannels(''); }}
            style={[styles.discoverBtn, { backgroundColor: palette.primary ?? '#C9A227' }]}
          >
            <Text style={{ color: palette.onPrimary ?? '#fff', fontWeight: '700' }}>Find channels</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderChannelRow}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* Discover Modal */}
      <Modal
        visible={discoverVisible}
        animationType="slide"
        onRequestClose={() => setDiscoverVisible(false)}
      >
        <View style={[styles.root, { backgroundColor: palette.bg }]}>
          <View style={[styles.header, { borderBottomColor: palette.divider ?? palette.inputBorder }]}>
            <Pressable onPress={() => setDiscoverVisible(false)} style={styles.headerBtn} hitSlop={8}>
              <KISIcon name="close" size={22} color={palette.text} />
            </Pressable>
            <View style={[styles.searchBar, { backgroundColor: palette.surface ?? palette.card, borderColor: palette.inputBorder }]}>
              <KISIcon name="search" size={15} color={palette.subtext} />
              <TextInput
                style={[styles.searchInput, { color: palette.text }]}
                placeholder="Search channels…"
                placeholderTextColor={palette.subtext}
                value={discoverQuery}
                onChangeText={setDiscoverQuery}
                autoFocus
              />
              {discoverQuery.length > 0 && (
                <Pressable onPress={() => setDiscoverQuery('')} hitSlop={8}>
                  <KISIcon name="close" size={14} color={palette.subtext} />
                </Pressable>
              )}
            </View>
          </View>

          {discoverLoading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={discoverResults}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
              ListEmptyComponent={
                <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 32 }}>
                  {discoverQuery ? 'No channels found.' : 'Start typing to find channels.'}
                </Text>
              }
              renderItem={({ item }) => {
                const isSubbed = item.is_subscribed || subscribed.some(c => c.id === item.id);
                const isBusy = subscribing === item.id;
                return (
                  <View style={[styles.discoverCard, { backgroundColor: palette.card, borderColor: palette.inputBorder }]}>
                    <View style={[styles.avatar, { backgroundColor: palette.primarySoft ?? palette.surface, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }]}>
                      <KISIcon name="broadcast" size={20} color={palette.primary ?? '#C9A227'} />
                    </View>
                    <View style={styles.rowContent}>
                      <Text style={[styles.rowName, { color: palette.text }]} numberOfLines={1}>{item.name}</Text>
                      {item.subscriber_count != null && (
                        <Text style={[styles.rowSub, { color: palette.subtext }]}>
                          {formatCount(item.subscriber_count)} followers
                        </Text>
                      )}
                      {item.description ? (
                        <Text style={[styles.rowSub, { color: palette.subtext }]} numberOfLines={2}>{item.description}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => isSubbed ? void handleUnsubscribe(item) : void handleSubscribe(item)}
                      disabled={isBusy}
                      style={[
                        styles.subBtn,
                        {
                          backgroundColor: isSubbed ? 'transparent' : (palette.primary ?? '#C9A227'),
                          borderWidth: isSubbed ? 1 : 0,
                          borderColor: palette.primary ?? '#C9A227',
                          opacity: isBusy ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: isSubbed ? (palette.primary ?? '#C9A227') : (palette.onPrimary ?? '#fff'), fontSize: 12, fontWeight: '700' }}>
                        {isBusy ? '…' : isSubbed ? 'Unfollow' : 'Follow'}
                      </Text>
                    </Pressable>
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  headerBtn: { padding: 4 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0, margin: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowContent: { flex: 1, gap: 3 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowTime: { fontSize: 11 },
  avatar: { width: 44, height: 44 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  discoverBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  discoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  subBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
});
