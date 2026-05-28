import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchLivePolls,
  createLivePoll,
  voteLivePoll,
  endLivePoll,
} from '@/screens/broadcast/channels/hooks/useChannelsData';

type PollOption = {
  index: number;
  text: string;
  vote_count?: number;
};

type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  is_active?: boolean;
  total_votes?: number;
  user_vote_index?: number | null;
};

type Props = {
  streamId: string;
  isManager: boolean;
  palette: any;
};

export default function LivePollsPanel({ streamId, isManager, palette }: Props) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchLivePolls(streamId);
      setPolls(rows);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => { void load(); }, [load]);

  const handleVote = useCallback(async (pollId: string, optionIndex: number) => {
    setPolls(prev => prev.map(p => {
      if (p.id !== pollId) return p;
      const opts = p.options.map((o, i) => ({
        ...o,
        vote_count: (o.vote_count ?? 0) + (i === optionIndex ? 1 : 0),
      }));
      return { ...p, options: opts, user_vote_index: optionIndex, total_votes: (p.total_votes ?? 0) + 1 };
    }));
    await voteLivePoll(pollId, optionIndex);
  }, []);

  const handleEndPoll = useCallback(async (pollId: string) => {
    await endLivePoll(pollId);
    setPolls(prev => prev.map(p => p.id === pollId ? { ...p, is_active: false } : p));
  }, []);

  const handleCreate = useCallback(async () => {
    const q = question.trim();
    const opts = options.map(o => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) {
      Alert.alert('Poll', 'Please enter a question and at least 2 options.');
      return;
    }
    setCreating(true);
    try {
      const newPoll = await createLivePoll(streamId, q, opts);
      if (newPoll) {
        setPolls(prev => [newPoll, ...prev]);
        setQuestion('');
        setOptions(['', '', '', '']);
        setShowCreate(false);
      }
    } finally {
      setCreating(false);
    }
  }, [question, options, streamId]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isManager && (
        <Pressable
          onPress={() => setShowCreate(v => !v)}
          style={[styles.createBtn, { backgroundColor: palette.primaryStrong }]}
        >
          <KISIcon name="poll" size={14} color={palette.surface} />
          <Text style={[styles.createBtnText, { color: palette.surface }]}>
            {showCreate ? 'Cancel' : 'Create Poll'}
          </Text>
        </Pressable>
      )}

      {showCreate && isManager && (
        <View style={[styles.createForm, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.formLabel, { color: palette.text }]}>Question</Text>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask a question…"
            placeholderTextColor={palette.subtext}
            style={[styles.formInput, { color: palette.text, borderColor: palette.border }]}
          />
          <Text style={[styles.formLabel, { color: palette.text, marginTop: 10 }]}>Options</Text>
          {options.map((opt, i) => (
            <TextInput
              key={i}
              value={opt}
              onChangeText={text => {
                const next = [...options];
                next[i] = text;
                setOptions(next);
              }}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor={palette.subtext}
              style={[styles.formInput, { color: palette.text, borderColor: palette.border, marginTop: 6 }]}
            />
          ))}
          <Pressable
            onPress={handleCreate}
            disabled={creating}
            style={[styles.submitBtn, { backgroundColor: palette.text }]}
          >
            <Text style={[styles.submitBtnText, { color: palette.surface }]}>
              {creating ? 'Creating…' : 'Launch Poll'}
            </Text>
          </Pressable>
        </View>
      )}

      {polls.length === 0 && !showCreate && (
        <Text style={[styles.empty, { color: palette.subtext }]}>No active polls.</Text>
      )}

      {polls.map(poll => {
        const totalVotes = poll.total_votes ?? poll.options.reduce((s, o) => s + (o.vote_count ?? 0), 0);
        const voted = poll.user_vote_index != null;
        return (
          <View key={poll.id} style={[styles.pollCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.pollHeader}>
              <Text style={[styles.pollQuestion, { color: palette.text }]}>{poll.question}</Text>
              {!poll.is_active && (
                <Text style={[styles.endedBadge, { color: palette.subtext }]}>Ended</Text>
              )}
            </View>
            {poll.options.map((opt, i) => {
              const count = opt.vote_count ?? 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isSelected = poll.user_vote_index === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    if (!voted && poll.is_active !== false) {
                      void handleVote(poll.id, i);
                    }
                  }}
                  style={[
                    styles.optionBtn,
                    {
                      borderColor: isSelected ? palette.primaryStrong : palette.border,
                      backgroundColor: isSelected ? palette.primarySoft : palette.background,
                    },
                  ]}
                >
                  <View style={[styles.optionBar, { width: `${pct}%` as any, backgroundColor: palette.primarySoft }]} />
                  <Text style={[styles.optionText, { color: isSelected ? palette.primaryStrong : palette.text }]}>
                    {opt.text}
                  </Text>
                  {voted && (
                    <Text style={[styles.optionPct, { color: palette.subtext }]}>{pct}%</Text>
                  )}
                </Pressable>
              );
            })}
            <Text style={[styles.voteCount, { color: palette.subtext }]}>{totalVotes} vote{totalVotes === 1 ? '' : 's'}</Text>
            {isManager && poll.is_active !== false && (
              <Pressable
                onPress={() => handleEndPoll(poll.id)}
                style={[styles.endBtn, { borderColor: palette.border }]}
              >
                <Text style={[styles.endBtnText, { color: palette.subtext }]}>End poll</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, gap: 12 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  createBtnText: { fontSize: 13, fontWeight: '800' },
  createForm: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  formLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 14,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '900' },
  empty: { fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 20 },
  pollCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  pollHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pollQuestion: { flex: 1, fontSize: 15, fontWeight: '900' },
  endedBadge: { fontSize: 11, fontWeight: '700' },
  optionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  optionBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
  },
  optionText: { flex: 1, fontSize: 13, fontWeight: '700', zIndex: 1 },
  optionPct: { fontSize: 12, fontWeight: '800', zIndex: 1 },
  voteCount: { fontSize: 11, fontWeight: '600' },
  endBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  endBtnText: { fontSize: 12, fontWeight: '700' },
});
