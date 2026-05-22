// src/screens/broadcast/channels/components/LiveChatPanel.tsx
//
// Realtime live-chat overlay rendered over the video player.
// Messages arrive via useLiveStream (socket) and are rendered in a
// FlatList that auto-scrolls to the bottom on new messages.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import type { LiveChatMessage } from '../hooks/useLiveStream';

type Props = {
  messages:        LiveChatMessage[];
  onSend:          (text: string) => Promise<void>;
  palette:         any;
  disabled?:       boolean;   // true when stream is not live
  collapsed?:      boolean;
  onToggleCollapse?: () => void;
};

export default function LiveChatPanel({
  messages,
  onSend,
  palette,
  disabled = false,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const [draft,    setDraft]    = useState('');
  const [sending,  setSending]  = useState(false);
  const listRef = useRef<FlatList<LiveChatMessage>>(null);
  const fadeAnim = useRef(new Animated.Value(collapsed ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue:        collapsed ? 0 : 1,
      duration:       200,
      useNativeDriver: true,
    }).start();
  }, [collapsed]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && !collapsed) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length, collapsed]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending || disabled) return;
    setDraft('');
    setSending(true);
    try {
      await onSend(text);
    } finally {
      setSending(false);
    }
  }, [draft, sending, disabled, onSend]);

  const renderItem = useCallback(({ item }: { item: LiveChatMessage }) => (
    <View style={[styles.msgRow, item.isMine && styles.msgRowMine]}>
      <View style={[
        styles.bubble,
        item.isMine
          ? [styles.bubbleMine, { backgroundColor: palette.primary }]
          : [styles.bubbleOther, { backgroundColor: 'rgba(0,0,0,0.55)' }],
      ]}>
        {!item.isMine && (
          <Text style={[styles.msgName, { color: palette.primaryStrong ?? '#a78bfa' }]}>
            {item.displayName}
          </Text>
        )}
        <Text style={[styles.msgText, { color: '#fff' }]}>{item.text}</Text>
      </View>
    </View>
  ), [palette.primary, palette.primaryStrong]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Toggle button */}
      <Pressable
        onPress={onToggleCollapse}
        style={[styles.toggleBtn, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
      >
        <KISIcon
          name={collapsed ? 'chat' : 'chat'}
          size={16}
          color="#fff"
        />
        {messages.length > 0 && !collapsed && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {messages.length > 99 ? '99+' : messages.length}
            </Text>
          </View>
        )}
      </Pressable>

      <Animated.View
        style={[styles.panel, { opacity: fadeAnim }]}
        pointerEvents={collapsed ? 'none' : 'box-none'}
      >
        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
        />

        {/* Input row */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={disabled ? 'Live chat unavailable' : 'Say something…'}
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={[styles.input, { borderColor: 'rgba(255,255,255,0.2)' }]}
              editable={!disabled && !sending}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              blurOnSubmit={false}
              maxLength={300}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sending || disabled}
              style={[
                styles.sendBtn,
                { backgroundColor: draft.trim() ? palette.primary : 'rgba(255,255,255,0.15)' },
              ]}
            >
              <KISIcon name="send" size={16} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 220,
    maxHeight: 360,
  },
  toggleBtn: {
    alignSelf: 'flex-end',
    marginBottom: 6,
    marginRight: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E52B2B',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  panel: { flex: 1 },
  list: { maxHeight: 260 },
  listContent: { paddingHorizontal: 8, paddingVertical: 4 },
  msgRow: {
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  msgRowMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '88%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubbleOther: { borderBottomLeftRadius: 4 },
  bubbleMine:  { borderBottomRightRadius: 4 },
  msgName: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  msgText: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  input: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
