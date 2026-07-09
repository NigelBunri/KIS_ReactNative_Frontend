// src/screens/calls/components/InCallPollSheet.tsx
// In-call poll creation and voting UI.

import React, { useState, useMemo } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';
import type { InCallPoll } from '@/services/calls/callTypes';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

type Props = {
  visible: boolean;
  onClose: () => void;
  polls: InCallPoll[];
  isHost: boolean;
  localUserId: string;
  onCreatePoll: (question: string, options: string[]) => void;
  onVote: (pollId: string, option: string) => void;
  onClosePoll: (pollId: string) => void;
};

export default function InCallPollSheet({
  visible, onClose, polls, isHost, localUserId, onCreatePoll, onVote, onClosePoll,
}: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const topInset = useSafeTopInset();
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [mounted, setMounted] = useState(visible);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.spring(slideAnim, { toValue: visible ? 0 : 500, useNativeDriver: true, tension: 60, friction: 12 })
      .start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible]);

  if (!mounted) return null;

  const totalVotes = (poll: InCallPoll) => Object.keys(poll.votes).length;
  const votesFor = (poll: InCallPoll, opt: string) =>
    Object.values(poll.votes).filter(v => v === opt).length;

  const handleCreate = () => {
    const q = question.trim();
    const opts = options.map(o => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    onCreatePoll(q, opts);
    setQuestion('');
    setOptions(['', '']);
    setCreating(false);
  };

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: palette.royalInk, borderTopColor: `${palette.gold}33`, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.ivory }]}>Polls</Text>
        <View style={styles.headerRight}>
          {isHost && !creating && (
            <Pressable onPress={() => setCreating(true)} style={[styles.createBtn, { backgroundColor: `${palette.gold}26`, borderColor: `${palette.gold}60` }]}>
              <KISIcon name="plus" size={14} color={palette.gold} />
              <Text style={[styles.createText, { color: palette.gold }]}>New poll</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={10}>
            <KISIcon name="close" size={20} color={palette.subtext} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: Math.max(insets.bottom, 16) }}>

        {/* Create poll form */}
        {creating && (
          <View style={[styles.card, { backgroundColor: `${palette.gold}0F`, borderColor: `${palette.gold}33` }]}>
            <Text style={[styles.cardLabel, { color: palette.gold }]}>New poll</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.inputBorder, color: palette.text }]}
              placeholder="Question"
              placeholderTextColor={palette.subtext}
              value={question}
              onChangeText={setQuestion}
              maxLength={200}
            />
            {options.map((opt, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: palette.surface, borderColor: palette.inputBorder, color: palette.text }]}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor={palette.subtext}
                  value={opt}
                  onChangeText={v => { const next = [...options]; next[i] = v; setOptions(next); }}
                  maxLength={100}
                />
                {options.length > 2 && (
                  <Pressable onPress={() => setOptions(options.filter((_, j) => j !== i))} hitSlop={8}>
                    <KISIcon name="close" size={16} color={palette.danger} />
                  </Pressable>
                )}
              </View>
            ))}
            {options.length < 6 && (
              <Pressable onPress={() => setOptions([...options, ''])} style={styles.addOptionBtn}>
                <KISIcon name="plus" size={14} color={palette.subtext} />
                <Text style={[styles.addOptionText, { color: palette.subtext }]}>Add option</Text>
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable onPress={() => { setCreating(false); setQuestion(''); setOptions(['', '']); }}
                style={[styles.cancelBtn, { borderColor: palette.inputBorder }]}>
                <Text style={[styles.cancelText, { color: palette.subtext }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreate} style={[styles.launchBtn, { backgroundColor: palette.gold }]}>
                <Text style={[styles.launchText, { color: palette.royalInk }]}>Launch poll</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Poll list */}
        {polls.length === 0 && !creating && (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <KISIcon name="bar-chart" size={32} color={palette.subtext} />
            <Text style={[styles.emptyText, { color: palette.subtext }]}>No polls yet</Text>
          </View>
        )}

        {polls.map(poll => {
          const total = totalVotes(poll);
          const myVote = poll.votes[localUserId];
          return (
            <View key={poll.pollId} style={[styles.card, { backgroundColor: `${palette.surface}`, borderColor: palette.inputBorder }]}>
              {poll.closed && (
                <View style={[styles.closedBadge, { backgroundColor: `${palette.subtext}26` }]}>
                  <Text style={[styles.closedText, { color: palette.subtext }]}>Closed</Text>
                </View>
              )}
              <Text style={[styles.pollQuestion, { color: palette.ivory }]}>{poll.question}</Text>
              <Text style={[styles.pollMeta, { color: palette.subtext }]}>{total} vote{total !== 1 ? 's' : ''}</Text>
              {poll.options.map(opt => {
                const count = votesFor(poll, opt);
                const pct = total > 0 ? count / total : 0;
                const isMyVote = myVote === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => !poll.closed && !myVote && onVote(poll.pollId, opt)}
                    disabled={poll.closed || !!myVote}
                    style={[
                      styles.optionRow,
                      { borderColor: isMyVote ? palette.gold : palette.inputBorder },
                    ]}
                  >
                    <View style={[styles.optionFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: `${palette.gold}26` }]} />
                    <Text style={[styles.optionText, { color: isMyVote ? palette.gold : palette.ivory }]}>{opt}</Text>
                    <Text style={[styles.optionPct, { color: palette.subtext }]}>{Math.round(pct * 100)}%</Text>
                    {isMyVote && <KISIcon name="check" size={13} color={palette.gold} />}
                  </Pressable>
                );
              })}
              {isHost && !poll.closed && (
                <Pressable onPress={() => onClosePoll(poll.pollId)} style={styles.closeBtn}>
                  <Text style={[styles.closeText, { color: palette.danger }]}>Close poll</Text>
                </Pressable>
              )}
            </View>
          );
        })}
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  createText: { fontSize: 12, fontWeight: '800' },
  scroll: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10, overflow: 'hidden' },
  cardLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14 },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addOptionText: { fontSize: 13 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 18, alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 13, fontWeight: '700' },
  launchBtn: { flex: 1, borderRadius: 18, alignItems: 'center', paddingVertical: 10 },
  launchText: { fontSize: 13, fontWeight: '900' },
  emptyText: { fontSize: 14, marginTop: 8 },
  pollQuestion: { fontSize: 15, fontWeight: '800' },
  pollMeta: { fontSize: 12 },
  optionRow: {
    borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden',
  },
  optionFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optionText: { flex: 1, fontSize: 14, fontWeight: '600' },
  optionPct: { fontSize: 12 },
  closedBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  closedText: { fontSize: 11, fontWeight: '700' },
  closeBtn: { alignItems: 'center', paddingVertical: 4 },
  closeText: { fontSize: 13, fontWeight: '700' },
});
