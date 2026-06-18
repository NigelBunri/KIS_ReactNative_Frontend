import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KISIcon } from '@/constants/kisIcons';
import type { ChatMessage } from '../../chatTypes';

const STARRED_KEY = 'kis.starred_messages';

export const saveStarredMessage = async (msg: ChatMessage) => {
  const raw = await AsyncStorage.getItem(STARRED_KEY).catch(() => null);
  const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
  const exists = list.some((m) => m.id === msg.id);
  if (!exists) {
    list.unshift({ ...msg, isStarred: true });
    await AsyncStorage.setItem(STARRED_KEY, JSON.stringify(list.slice(0, 500)));
  }
};

export const removeStarredMessage = async (messageId: string) => {
  const raw = await AsyncStorage.getItem(STARRED_KEY).catch(() => null);
  const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
  const updated = list.filter((m) => m.id !== messageId);
  await AsyncStorage.setItem(STARRED_KEY, JSON.stringify(updated));
};

export const loadStarredMessages = async (): Promise<ChatMessage[]> => {
  const raw = await AsyncStorage.getItem(STARRED_KEY).catch(() => null);
  return raw ? JSON.parse(raw) : [];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onJumpToMessage?: (messageId: string, conversationId?: string) => void;
  palette: any;
};

export const StarredMessagesSheet: React.FC<Props> = ({
  visible,
  onClose,
  onJumpToMessage,
  palette,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    if (visible) {
      loadStarredMessages().then(setMessages);
    }
  }, [visible]);

  const handleUnstar = useCallback(async (msg: ChatMessage) => {
    await removeStarredMessage(msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  }, []);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });

  if (!visible) return null;

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const preview =
      item.text ||
      item.styledText?.text ||
      (item.voice ? '🎤 Voice message' : '') ||
      (item.attachments?.length ? '📎 Attachment' : '') ||
      (item.location ? '📍 Location' : '') ||
      (item.poll ? '📊 Poll' : '') ||
      (item.event ? '📅 Event' : '') ||
      'Message';

    const date = new Date(item.createdAt);
    const dateLabel = isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
    });

    return (
      <Pressable
        style={[styles.row, { backgroundColor: palette.card ?? palette.surface }]}
        onPress={() => {
          onJumpToMessage?.(item.id, item.conversationId);
          onClose();
        }}
      >
        <View style={styles.starIcon}>
          <Text style={{ fontSize: 18 }}>⭐</Text>
        </View>
        <View style={styles.rowContent}>
          <Text
            style={[styles.preview, { color: palette.text }]}
            numberOfLines={2}
          >
            {preview}
          </Text>
          <Text style={[styles.dateMeta, { color: palette.subtext }]}>{dateLabel}</Text>
        </View>
        <Pressable
          onPress={() => handleUnstar(item)}
          style={styles.unstarBtn}
          hitSlop={8}
        >
          <KISIcon name="close" size={16} color={palette.subtext} />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: palette.surface ?? palette.bg, transform: [{ translateY }] },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Text style={[styles.title, { color: palette.text }]}>Starred Messages</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>⭐</Text>
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              No starred messages yet.{'\n'}Long-press any message and tap Star.
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 12, gap: 8 }}
          />
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 14,
  },
  starIcon: { marginRight: 12, marginTop: 2 },
  rowContent: { flex: 1 },
  preview: { fontSize: 14, lineHeight: 20 },
  dateMeta: { fontSize: 11, marginTop: 4 },
  unstarBtn: { padding: 4, marginLeft: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
