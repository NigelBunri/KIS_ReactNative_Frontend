// src/components/broadcast/ShareToChatModal.tsx
//
// The "share to a chat" half of BroadcastDetailScreen's share sheet: picks
// one of the user's existing conversations to send a link into. Reuses
// fetchConversationsForCurrentUser (the same data MessagesScreen's own chat
// list is built from) rather than a second, parallel chat-list fetch - if
// the two ever disagreed about what "your chats" means, this picker would
// be the one silently wrong.
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { fetchConversationsForCurrentUser } from '@/Module/ChatRoom/normalizeConversation';
import type { Chat } from '@/Module/ChatRoom/messagesUtils';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPicked: (chat: Chat) => void;
};

function initialsFor(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function ShareToChatModal({ visible, onClose, onPicked }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    fetchConversationsForCurrentUser([])
      .then((list) => {
        if (active) setChats(list);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [chats, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: palette.surface, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle}>
          <View style={[styles.handleBar, { backgroundColor: palette.border }]} />
        </View>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>Share to a chat</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <KISIcon name="close" size={20} color={palette.subtext} />
          </Pressable>
        </View>
        <View style={[styles.searchRow, { backgroundColor: palette.bg, borderColor: palette.border }]}>
          <KISIcon name="search" size={16} color={palette.subtext} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={palette.subtext}
            style={[styles.searchInput, { color: palette.text }]}
          />
        </View>
        {loading ? (
          <Text style={[styles.emptyText, { color: palette.subtext }]}>Loading chats…</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 420 }}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: palette.subtext }]}>
                No chats found.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? palette.surfaceElevated : 'transparent' },
                ]}
                onPress={() => onPicked(item)}
              >
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: palette.goldSoft }]}>
                    <Text style={{ color: palette.goldDeep, fontWeight: '800' }}>{initialsFor(item.name)}</Text>
                  </View>
                )}
                <Text style={[styles.rowName, { color: palette.text }]} numberOfLines={1}>
                  {item.name || 'Chat'}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '900' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 15, fontWeight: '600', flex: 1 },
  emptyText: { textAlign: 'center', paddingVertical: 24, fontSize: 13 },
});
