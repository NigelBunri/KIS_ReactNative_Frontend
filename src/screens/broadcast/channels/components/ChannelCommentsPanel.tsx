import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import type { ChannelContentComment } from '@/screens/broadcast/channels/api/channels.types';
import { fetchChannelComments, postChannelComment } from '@/screens/broadcast/channels/hooks/useChannelsData';

type Props = { contentId: string; onCountChange?: (count: number) => void };

export default function ChannelCommentsPanel({ contentId, onCountChange }: Props) {
  const { palette } = useKISTheme();
  const [comments, setComments] = useState<ChannelContentComment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchChannelComments(contentId);
      setComments(rows);
      onCountChange?.(rows.length);
    } finally {
      setLoading(false);
    }
  }, [contentId, onCountChange]);

  useEffect(() => { void load(); }, [load]);

  const submit = useCallback(async () => {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const result = await postChannelComment(contentId, text);
      if (result?.comment) {
        setComments(prev => [result.comment!, ...prev]);
        setBody('');
        onCountChange?.(comments.length + 1);
      }
    } finally {
      setPosting(false);
    }
  }, [body, comments.length, contentId, onCountChange, posting]);

  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Comments</Text>
        {loading ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : null}
      </View>
      <View style={[styles.inputRow, { borderColor: palette.border, backgroundColor: palette.background }]}> 
        <TextInput value={body} onChangeText={setBody} placeholder="Add a comment" placeholderTextColor={palette.subtext} style={[styles.input, { color: palette.text }]} multiline />
        <Pressable onPress={submit} style={[styles.postButton, { backgroundColor: body.trim() ? palette.text : palette.border }]}> 
          <Text style={{ color: palette.surface, fontWeight: '900', fontSize: 12 }}>{posting ? '...' : 'Post'}</Text>
        </Pressable>
      </View>
      {comments.length ? comments.map(item => (
        <View key={item.id} style={[styles.commentRow, { borderColor: palette.border }]}> 
          <Text style={[styles.author, { color: palette.text }]}>{item.user_display || 'KIS user'}</Text>
          <Text style={[styles.body, { color: palette.subtext }]}>{item.body}</Text>
        </View>
      )) : <Text style={[styles.empty, { color: palette.subtext }]}>No comments yet.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { margin: 16, borderWidth: 1, borderRadius: 8, padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '900' },
  inputRow: { marginTop: 12, borderWidth: 1, borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 38, fontSize: 13, fontWeight: '700', padding: 0 },
  postButton: { borderRadius: 8, paddingHorizontal: 13, paddingVertical: 10 },
  commentRow: { borderTopWidth: 1, paddingTop: 11, marginTop: 11 },
  author: { fontSize: 12, fontWeight: '900' },
  body: { marginTop: 3, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  empty: { marginTop: 12, fontSize: 12, fontWeight: '700' },
});
