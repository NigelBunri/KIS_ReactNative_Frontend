// src/screens/calls/components/InCallChatSheet.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
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
import type { InCallMessage } from '@/services/calls/callTypes';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  messages: InCallMessage[];
  visible: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  localUserId: string;
};

export default function InCallChatSheet({ messages, visible, onClose, onSend, localUserId }: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
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

  if (!visible) return null;

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>In-call chat</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <KISIcon name="x" size={20} color="rgba(255,255,255,0.7)" />
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
              <Text style={styles.timeText}>
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
          <Pressable onPress={send} style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}>
            <KISIcon name="send" size={20} color={text.trim() ? '#fff' : 'rgba(255,255,255,0.3)'} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    backgroundColor: '#111128',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
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
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 6 },
  messageList: { padding: 12, gap: 8, flexGrow: 1 },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    padding: 10,
    gap: 2,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 4,
  },
  senderName: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  messageText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  messageTextMe: { color: '#fff' },
  timeText: { color: 'rgba(255,255,255,0.4)', fontSize: 10, alignSelf: 'flex-end' },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 40 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(99,102,241,0.35)' },
});
