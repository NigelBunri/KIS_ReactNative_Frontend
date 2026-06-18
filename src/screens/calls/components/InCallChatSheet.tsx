// src/screens/calls/components/InCallChatSheet.tsx
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { InCallMessage } from '@/services/calls/callTypes';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  messages: InCallMessage[];
  visible: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  localUserId: string;
};

export default function InCallChatSheet({ messages, visible, onClose, onSend, localUserId }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Track mounted state so we defer unmounting until slide-out animation completes.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible]);

  useEffect(() => {
    if (visible && messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, visible]);

  const send = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }, [text, onSend]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  const styles = useMemo(() => StyleSheet.create({
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '65%',
      backgroundColor: palette.royalInk,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderTopColor: `${palette.gold}33`,
      zIndex: 50,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: { color: palette.ivory, fontSize: 16, fontWeight: '700' },
    closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    messageList: { padding: 12, gap: 8, flexGrow: 1 },
    bubble: {
      maxWidth: '78%',
      borderRadius: 16,
      padding: 10,
      gap: 2,
    },
    bubbleMe: {
      alignSelf: 'flex-end',
      backgroundColor: palette.gold,
      borderBottomRightRadius: 4,
    },
    bubbleThem: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderBottomLeftRadius: 4,
    },
    senderName: { color: palette.subtext, fontSize: 11, fontWeight: '600' },
    messageText: { color: palette.ivory, fontSize: 14, lineHeight: 20 },
    // royalInk on gold achieves ~10:1 contrast ratio (passes WCAG AA and AAA).
    messageTextMe: { color: palette.royalInk },
    timeText: { color: palette.subtext, fontSize: 10, alignSelf: 'flex-end' },
    // Timestamp inside own (gold) bubble needs dark text for contrast.
    timeTextMe: { color: `${palette.royalInk}99` },
    emptyState: { flex: 1, alignItems: 'center', paddingTop: 40 },
    emptyText: { color: palette.subtext, fontSize: 14 },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.1)',
      paddingBottom: Math.max(insets.bottom, 10),
    },
    input: {
      flex: 1,
      color: palette.ivory,
      fontSize: 14,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      maxHeight: 120,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: `${palette.gold}4D` },
  }), [palette, insets.bottom]);

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>In-call chat</Text>
        <Pressable
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityLabel="Close chat"
          accessibilityRole="button"
          hitSlop={8}
        >
          <KISIcon name="close" size={20} color={palette.ivory} />
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isMe = item.userId === localUserId;
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              {!isMe && (
                <Text style={styles.senderName}>{item.displayName}</Text>
              )}
              <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
                {item.text}
              </Text>
              <Text style={[styles.timeText, isMe && styles.timeTextMe]}>
                {new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet. Say hi! 👋</Text>
          </View>
        }
      />

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message everyone..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            accessibilityLabel="Send message"
            accessibilityRole="button"
            disabled={!text.trim()}
          >
            <KISIcon name="send" size={20} color={text.trim() ? palette.ivory : 'rgba(255,255,255,0.3)'} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
