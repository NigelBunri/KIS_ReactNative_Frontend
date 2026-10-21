// src/screens/broadcast/channels/components/LiveChatPanel.tsx
//
// Realtime live-chat overlay rendered over the video player.
// Messages arrive via useLiveStream (socket) and are rendered in a
// FlatList that auto-scrolls to the bottom on new messages.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
  }, [collapsed, fadeAnim]);

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
    } catch {
      // Restore the draft so a failed send doesn't just silently vanish —
      // onSend (useLiveStream's sendChatMessage) removes its optimistic
      // bubble on failure, so without this the user would have no sign
      // their message never went out and no easy way to retry it.
      setDraft(text);
      Alert.alert('Message not sent', 'Could not send your message. Please try again.');
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
          : [styles.bubbleOther, { backgroundColor: palette.royalInk }],
      ]}>
        {!item.isMine && (
          <View style={styles.msgNameRow}>
            <Text style={[styles.msgName, { color: palette.primaryStrong }]}>
              {item.displayName}
            </Text>
            {item.is_member && (
              <View style={[styles.memberBadge, { backgroundColor: palette.gold }]}>
                <Text style={[styles.memberBadgeText, { color: palette.royalInk }]}>MEMBER</Text>
              </View>
            )}
          </View>
        )}
        <Text style={[styles.msgText, { color: palette.ivory }]}>{item.text}</Text>
      </View>
    </View>
  ), [palette.primary, palette.primaryStrong, palette.royalInk, palette.ivory]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Toggle button */}
      <Pressable
        onPress={onToggleCollapse}
        style={[styles.toggleBtn, { backgroundColor: collapsed ? palette.royalInk : palette.card }]}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Show live chat' : 'Hide live chat'}
      >
        <KISIcon
          name="comment"
          size={16}
          color={collapsed ? palette.primaryStrong : palette.ivory}
        />
        {messages.length > 0 && !collapsed && (
          <View style={[styles.countBadge, { backgroundColor: palette.danger }]}>
            <Text style={[styles.countText, { color: palette.ivory }]}>
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
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: 'center' }}>
                No messages yet
              </Text>
            </View>
          }
        />

        {/* Input row */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={disabled ? 'Live chat unavailable' : 'Say something…'}
              placeholderTextColor={palette.subtext}
              style={[styles.input, { borderColor: palette.divider, color: palette.ivory }]}
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
                { backgroundColor: draft.trim() ? palette.primary : palette.primaryWeak },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <KISIcon name="send" size={16} color={palette.ivory} />
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: { fontSize: 9, fontWeight: '800' },
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
  msgNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  msgName: { fontSize: 10, fontWeight: '700' },
  memberBadge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  memberBadgeText: { fontSize: 7, fontWeight: '900' },
  msgText: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  input: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
