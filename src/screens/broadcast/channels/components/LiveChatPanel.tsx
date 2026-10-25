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
  // Chat moderation (D4/D5 parity batch) - canModerate gates the Delete
  // action in the long-press sheet; Report is always offered. Both are
  // optional so existing call sites that haven't wired them up yet degrade
  // to long-press doing nothing, rather than crashing.
  canModerate?:    boolean;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onReportMessage?: (messageId: string) => Promise<void>;
};

export default function LiveChatPanel({
  messages,
  onSend,
  palette,
  disabled = false,
  collapsed = false,
  onToggleCollapse,
  canModerate = false,
  onDeleteMessage,
  onReportMessage,
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

  const handleLongPressMessage = useCallback((item: LiveChatMessage) => {
    if (!onDeleteMessage && !onReportMessage) return;
    const options: Array<{ text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }> = [];
    if (canModerate && onDeleteMessage) {
      options.push({
        text: 'Delete message',
        style: 'destructive',
        onPress: () => {
          onDeleteMessage(item.id).catch(() =>
            Alert.alert('Unable to delete', 'Could not delete this message. Please try again.'),
          );
        },
      });
    }
    if (onReportMessage) {
      options.push({
        text: 'Report message',
        onPress: () => {
          onReportMessage(item.id)
            .then(() => Alert.alert('Reported', 'Thanks — our team will review this message.'))
            .catch(() => Alert.alert('Unable to report', 'Could not report this message. Please try again.'));
        },
      });
    }
    if (!options.length) return;
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message options', undefined, options);
  }, [canModerate, onDeleteMessage, onReportMessage]);

  // Matches Module/ChatRoom/componets/MessageBubble.tsx's own convention
  // exactly (outgoingBubble/incomingBubble are the dedicated theme-aware
  // chat tokens - see theme/constants.ts) rather than inventing a second
  // one here. outgoingBubble/primary vary enough between light and dark
  // that a single static text color isn't safe on top of them (unlike
  // incomingBubble, which the palette already guarantees contrasts with
  // `text`) - same luminance check the real chat module uses.
  const outgoingBubbleColor = palette.outgoingBubble ?? palette.primary;
  const outgoingTextColor = (() => {
    const hex = String(outgoingBubbleColor || '').replace('#', '');
    if (hex.length !== 6) return '#ffffff';
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 160 ? '#111111' : '#ffffff';
  })();

  const renderItem = useCallback(({ item }: { item: LiveChatMessage }) => (
    <Pressable
      style={[styles.msgRow, item.isMine && styles.msgRowMine]}
      onLongPress={() => handleLongPressMessage(item)}
      delayLongPress={350}
    >
      <View style={[
        styles.bubble,
        item.isMine
          ? [styles.bubbleMine, { backgroundColor: outgoingBubbleColor }]
          : [styles.bubbleOther, { backgroundColor: palette.incomingBubble ?? palette.surface ?? palette.card }],
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
        <Text style={[styles.msgText, { color: item.isMine ? outgoingTextColor : palette.text }]}>{item.text}</Text>
      </View>
    </Pressable>
  ), [outgoingBubbleColor, outgoingTextColor, palette.incomingBubble, palette.surface, palette.card, palette.primaryStrong, palette.gold, palette.royalInk, palette.text, handleLongPressMessage]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Toggle button */}
      <Pressable
        onPress={onToggleCollapse}
        style={[styles.toggleBtn, { backgroundColor: palette.card ?? palette.surface }]}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Show live chat' : 'Hide live chat'}
      >
        <KISIcon
          name="comment"
          size={16}
          color={collapsed ? palette.primaryStrong : palette.text}
        />
        {messages.length > 0 && !collapsed && (
          <View style={[styles.countBadge, { backgroundColor: palette.danger }]}>
            <Text style={[styles.countText, { color: palette.onPrimary ?? '#fff' }]}>
              {messages.length > 99 ? '99+' : messages.length}
            </Text>
          </View>
        )}
      </Pressable>

      <Animated.View
        style={[styles.panel, { opacity: fadeAnim }, collapsed && styles.panelCollapsed]}
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
              style={[
                styles.input,
                {
                  backgroundColor: palette.composerInputBg ?? palette.inputBg,
                  borderColor: palette.composerInputBorder ?? palette.divider,
                  color: palette.text,
                },
              ]}
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
              <KISIcon name="send" size={16} color={palette.onPrimary ?? '#fff'} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Was position: 'absolute', bottom: 0, right: 0, width: 220 - its own
    // independent screen-relative positioning, completely detached from
    // its parent's layout (LiveWatchPage.tsx's bottomPanelWrap, which has
    // its own Chat/Polls/Q&A tab row stacked above where this renders).
    // Since this escaped the parent's normal flow, the parent's own
    // height collapsed down to just its tab row, and this panel's
    // independent "bottom: 0" pinned it to the exact same screen-bottom
    // corner as that tab row - the two overlapped directly instead of
    // stacking, visually crushing the tabs, message list, and input into
    // one cramped cluster. Flowing in the parent's own stack (which
    // already sizes/positions the whole column, including safe-area
    // clearance) fixes that; width matches the parent's own dynamic
    // chatPanelWidth via '100%' instead of a second, slightly different
    // hardcoded value.
    width: '100%',
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
  // Now that `container` flows in its parent's normal layout (not its
  // old independent absolute positioning - see that style's comment),
  // opacity alone no longer hides this when collapsed: a 0-opacity View
  // still reserves its full layout height, so collapsing chat would
  // otherwise leave a big invisible gap below the tab row instead of
  // actually shrinking the column back down to it.
  panelCollapsed: { height: 0, overflow: 'hidden' },
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
