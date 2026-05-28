import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import {
  fetchLiveQA,
  startLiveQA,
  endLiveQA,
  fetchQAQuestions,
  submitQAQuestion,
  upvoteQAQuestion,
} from '@/screens/broadcast/channels/hooks/useChannelsData';

type QASession = {
  id: string;
  is_active?: boolean;
};

type QAQuestion = {
  id: string;
  question_text: string;
  upvote_count?: number;
  is_answered?: boolean;
  user_upvoted?: boolean;
};

type Props = {
  streamId: string;
  isManager: boolean;
  palette: any;
};

export default function LiveQAPanel({ streamId, isManager, palette }: Props) {
  const [session, setSession] = useState<QASession | null>(null);
  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionText, setQuestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await fetchLiveQA(streamId);
      setSession(sess);
      if (sess?.id) {
        const qs = await fetchQAQuestions(sess.id);
        setQuestions([...qs].sort((a: QAQuestion, b: QAQuestion) => (b.upvote_count ?? 0) - (a.upvote_count ?? 0)));
      }
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => { void load(); }, [load]);

  const handleStartQA = useCallback(async () => {
    const sess = await startLiveQA(streamId);
    if (sess) {
      setSession(sess);
      setQuestions([]);
    }
  }, [streamId]);

  const handleEndQA = useCallback(async () => {
    if (!session) return;
    await endLiveQA(streamId);
    setSession(prev => prev ? { ...prev, is_active: false } : null);
  }, [session, streamId]);

  const handleSubmitQuestion = useCallback(async () => {
    const text = questionText.trim();
    if (!text || submitting || !session?.id) return;
    setSubmitting(true);
    try {
      const q = await submitQAQuestion(session.id, text);
      if (q) {
        setQuestions(prev => [q, ...prev]);
        setQuestionText('');
      }
    } finally {
      setSubmitting(false);
    }
  }, [questionText, session, submitting]);

  const handleUpvote = useCallback(async (questionId: string) => {
    setQuestions(prev =>
      [...prev.map(q =>
        q.id === questionId
          ? { ...q, upvote_count: (q.upvote_count ?? 0) + (q.user_upvoted ? -1 : 1), user_upvoted: !q.user_upvoted }
          : q,
      )].sort((a, b) => (b.upvote_count ?? 0) - (a.upvote_count ?? 0)),
    );
    await upvoteQAQuestion(questionId);
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.primaryStrong} />
      </View>
    );
  }

  if (!session || session.is_active === false) {
    return (
      <View style={styles.centered}>
        {isManager ? (
          <Pressable
            onPress={handleStartQA}
            style={[styles.startBtn, { backgroundColor: palette.primaryStrong }]}
          >
            <KISIcon name="message-square" size={16} color={palette.surface} />
            <Text style={[styles.startBtnText, { color: palette.surface }]}>Start Q&A</Text>
          </Pressable>
        ) : (
          <Text style={[styles.noQA, { color: palette.subtext }]}>No Q&A active</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Live Q&A</Text>
        {isManager && (
          <Pressable
            onPress={handleEndQA}
            style={[styles.endBtn, { borderColor: palette.border }]}
          >
            <Text style={[styles.endBtnText, { color: palette.subtext }]}>End Q&A</Text>
          </Pressable>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
        {questions.length === 0 && (
          <Text style={[styles.emptyText, { color: palette.subtext }]}>No questions yet. Be the first!</Text>
        )}
        {questions.map(q => (
          <View key={q.id} style={[styles.questionRow, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.questionText, { color: q.is_answered ? palette.subtext : palette.text }]}>
                {q.question_text}
              </Text>
              {q.is_answered && (
                <Text style={[styles.answeredBadge, { color: palette.primaryStrong }]}>Answered</Text>
              )}
            </View>
            <Pressable
              onPress={() => handleUpvote(q.id)}
              style={[styles.upvoteBtn, { backgroundColor: q.user_upvoted ? palette.primarySoft : palette.bg, borderColor: q.user_upvoted ? palette.primaryStrong : palette.border }]}
            >
              <KISIcon name="arrow-right" size={14} color={q.user_upvoted ? palette.primaryStrong : palette.subtext} style={{ transform: [{ rotate: '-90deg' }] }} />
              <Text style={[styles.upvoteCount, { color: q.user_upvoted ? palette.primaryStrong : palette.subtext }]}>
                {q.upvote_count ?? 0}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.inputRow, { borderTopColor: palette.border, backgroundColor: palette.bg }]}>
        <TextInput
          value={questionText}
          onChangeText={setQuestionText}
          placeholder="Ask a question…"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { color: palette.text }]}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={handleSubmitQuestion}
        />
        <Pressable
          onPress={handleSubmitQuestion}
          disabled={submitting || !questionText.trim()}
          style={[styles.sendBtn, { backgroundColor: questionText.trim() ? palette.primaryStrong : palette.border }]}
        >
          <KISIcon name="send" size={16} color={palette.surface} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  startBtnText: { fontSize: 14, fontWeight: '900' },
  noQA: { fontSize: 14, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '900' },
  endBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  endBtnText: { fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 13, fontWeight: '700', textAlign: 'center', padding: 24 },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  questionText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  answeredBadge: { fontSize: 11, fontWeight: '800' },
  upvoteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    flexShrink: 0,
    minWidth: 40,
  },
  upvoteCount: { fontSize: 12, fontWeight: '800' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 38,
    fontSize: 14,
    fontWeight: '600',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
