import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

type CommunityComment = {
  id: string | number;
  text?: string;
  created_at?: string;
  author?: {
    id?: string;
    display_name?: string | null;
    phone?: string | null;
  };
};

type Props = {
  postId: string;
  listEndpoint: (postId: string) => string;
  createEndpoint: (postId: string) => string;
  onCountChange?: (count: number) => void;
};

const unwrapList = (response: any): CommunityComment[] => {
  const value =
    response?.data?.results ??
    response?.results ??
    response?.data ??
    response ??
    [];
  return Array.isArray(value) ? value : [];
};

export default function CommunityCommentThreadPanel({
  postId,
  listEndpoint,
  createEndpoint,
  onCountChange,
}: Props) {
  const { palette } = useKISTheme();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  useEffect(() => {
    onCountChangeRef.current?.(comments.length);
  }, [comments.length]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRequest(listEndpoint(postId), {
        errorMessage: 'Unable to load comments.',
      });
      const list = unwrapList(response);
      setComments(list);
    } catch (err: any) {
      setError(err?.message || 'Unable to load comments.');
    } finally {
      setLoading(false);
    }
  }, [listEndpoint, postId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await postRequest(
        createEndpoint(postId),
        { text },
        { errorMessage: 'Unable to post comment.' },
      );
      const created = response?.data ?? response;
      setComments((previous) => [...previous, created as CommunityComment]);
      setDraft('');
    } catch (err: any) {
      setError(err?.message || 'Unable to post comment.');
    } finally {
      setSending(false);
    }
  }, [createEndpoint, draft, postId, sending]);

  return (
    <View style={[styles.container, { borderTopColor: palette.divider }]}>
      <Text style={[styles.title, { color: palette.text }]}>Comments</Text>
      {loading ? (
        <ActivityIndicator color={palette.primary} style={styles.loader} />
      ) : comments.length === 0 ? (
        <Text style={[styles.empty, { color: palette.subtext }]}>
          No comments yet.
        </Text>
      ) : (
        comments.map((comment) => (
          <View
            key={String(comment.id)}
            style={[styles.comment, { backgroundColor: palette.surface }]}
          >
            <Text style={[styles.author, { color: palette.text }]}>
              {comment.author?.display_name || comment.author?.phone || 'Member'}
            </Text>
            <Text style={[styles.body, { color: palette.text }]}>
              {String(comment.text ?? '')}
            </Text>
          </View>
        ))
      )}
      {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
      <View style={[styles.composer, { borderColor: palette.inputBorder }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a comment"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { color: palette.text }]}
          multiline
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim() || sending}
          style={({ pressed }) => [
            styles.send,
            {
              backgroundColor: palette.primary,
              opacity: !draft.trim() || sending || pressed ? 0.55 : 1,
            },
          ]}
        >
          <Text style={styles.sendText}>{sending ? 'Sending' : 'Post'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, marginTop: 10, paddingTop: 12 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  loader: { marginVertical: 12 },
  empty: { fontSize: 13, marginBottom: 10 },
  comment: { borderRadius: 8, marginBottom: 7, padding: 10 },
  author: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  body: { fontSize: 14, lineHeight: 19 },
  error: { fontSize: 12, marginBottom: 8 },
  composer: {
    alignItems: 'flex-end',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 6,
  },
  input: { flex: 1, fontSize: 14, maxHeight: 96, minHeight: 36, paddingHorizontal: 6 },
  send: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  sendText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
