// src/screens/calls/components/InCallQASheet.tsx
// Q&A mode — audience submits questions, host manages the queue.

import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { QAQuestion } from '@/services/calls/callTypes';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type Props = {
  visible: boolean;
  onClose: () => void;
  qaQueue: QAQuestion[];
  isHost: boolean;
  onSubmitQuestion: (text: string, anonymous: boolean) => void;
  onDismiss: (questionId: string) => void;
  onMarkAnswered: (questionId: string) => void;
};

export default function InCallQASheet({
  visible, onClose, qaQueue, isHost, onSubmitQuestion, onDismiss, onMarkAnswered,
}: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [mounted, setMounted] = useState(visible);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.spring(slideAnim, { toValue: visible ? 0 : 500, useNativeDriver: true, tension: 60, friction: 12 })
      .start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible]);

  if (!mounted) return null;

  const unanswered = qaQueue.filter(q => !q.answered);
  const answered = qaQueue.filter(q => q.answered);

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: palette.royalInk, borderTopColor: `${palette.gold}33`, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.ivory }]}>Q&A</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <KISIcon name="close" size={20} color={palette.subtext} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ gap: 14, padding: 14, paddingBottom: Math.max(insets.bottom, 16) }}>

        {/* Submit area (non-host) */}
        {!isHost && (
          <View style={[styles.submitCard, { backgroundColor: palette.surface, borderColor: palette.inputBorder }]}>
            <TextInput
              style={[styles.input, { color: palette.text }]}
              placeholder="Ask a question…"
              placeholderTextColor={palette.subtext}
              value={text}
              onChangeText={setText}
              maxLength={300}
              multiline
            />
            <View style={styles.submitRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Switch
                  value={anonymous}
                  onValueChange={setAnonymous}
                  trackColor={{ false: palette.inputBorder, true: `${palette.gold}80` }}
                  thumbColor={anonymous ? palette.gold : palette.subtext}
                />
                <Text style={[styles.anonLabel, { color: palette.subtext }]}>Anonymous</Text>
              </View>
              <Pressable
                onPress={() => { if (text.trim()) { onSubmitQuestion(text.trim(), anonymous); setText(''); } }}
                disabled={!text.trim()}
                style={[styles.sendBtn, { backgroundColor: text.trim() ? palette.gold : `${palette.gold}40` }]}
              >
                <Text style={[styles.sendText, { color: palette.royalInk }]}>Send</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Queue */}
        {unanswered.length > 0 && (
          <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Waiting ({unanswered.length})</Text>
        )}
        {unanswered.map(q => (
          <View key={q.questionId} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.inputBorder }]}>
            <Text style={[styles.qText, { color: palette.ivory }]}>{q.text}</Text>
            <Text style={[styles.qMeta, { color: palette.subtext }]}>{q.displayName}</Text>
            {isHost && (
              <View style={styles.hostActions}>
                <Pressable onPress={() => onMarkAnswered(q.questionId)} style={[styles.actionBtn, { backgroundColor: `${palette.success}26` }]}>
                  <KISIcon name="check" size={14} color={palette.success} />
                  <Text style={[styles.actionText, { color: palette.success }]}>Answered</Text>
                </Pressable>
                <Pressable onPress={() => onDismiss(q.questionId)} style={[styles.actionBtn, { backgroundColor: `${palette.danger}1A` }]}>
                  <KISIcon name="close" size={14} color={palette.danger} />
                  <Text style={[styles.actionText, { color: palette.danger }]}>Dismiss</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}

        {answered.length > 0 && (
          <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Answered ({answered.length})</Text>
        )}
        {answered.map(q => (
          <View key={q.questionId} style={[styles.card, { backgroundColor: `${palette.success}0A`, borderColor: `${palette.success}30`, opacity: 0.7 }]}>
            <Text style={[styles.qText, { color: palette.ivory }]}>{q.text}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <KISIcon name="check" size={12} color={palette.success} />
              <Text style={[styles.qMeta, { color: palette.success }]}>Answered · {q.displayName}</Text>
            </View>
          </View>
        ))}

        {qaQueue.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <KISIcon name="chatbubble-ellipses" size={32} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>
              {isHost ? 'No questions yet' : 'Submit a question above'}
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, zIndex: 50,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 17, fontWeight: '900' },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  submitCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  input: { fontSize: 14, minHeight: 60 },
  submitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  anonLabel: { fontSize: 13 },
  sendBtn: { borderRadius: 18, paddingHorizontal: 18, paddingVertical: 9 },
  sendText: { fontSize: 13, fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  qText: { fontSize: 14, fontWeight: '600' },
  qMeta: { fontSize: 11 },
  hostActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  actionText: { fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 14, marginTop: 8 },
});
