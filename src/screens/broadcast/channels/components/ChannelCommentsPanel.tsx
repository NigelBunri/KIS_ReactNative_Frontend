import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import type { ChannelContentComment } from '@/screens/broadcast/channels/api/channels.types';
import {
  fetchChannelComments,
  postChannelComment,
  postChannelCommentReply,
  reactToChannelComment,
  removeChannelCommentReaction,
  pinChannelComment,
  reportChannelComment,
  editChannelComment,
  deleteChannelComment,
  heartChannelComment,
  unheartChannelComment,
} from '@/screens/broadcast/channels/hooks/useChannelsData';

type Props = {
  contentId: string;
  onCountChange?: (count: number) => void;
  isAdmin?: boolean;
  currentUserId?: string;
};

type CommentWithReplies = ChannelContentComment & { replies?: ChannelContentComment[] };

function buildTree(flat: ChannelContentComment[]): CommentWithReplies[] {
  const map = new Map<string, CommentWithReplies>();
  const roots: CommentWithReplies[] = [];
  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] });
  }
  for (const [, c] of map) {
    if (c.parent && map.has(c.parent)) {
      map.get(c.parent)!.replies!.push(c);
    } else {
      roots.push(c);
    }
  }
  // pinned comments first
  roots.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
  return roots;
}

type CommentItemProps = {
  comment: CommentWithReplies;
  palette: any;
  contentId: string;
  isAdmin?: boolean;
  currentUserId?: string;
  depth?: number;
  onOptimisticLike: (id: string, liked: boolean) => void;
  onOptimisticPin: (id: string, pinned: boolean) => void;
  onReplyPosted: (reply: ChannelContentComment) => void;
  onOptimisticEdit: (id: string, body: string) => void;
  onDeleteComment: (id: string) => void;
  onOptimisticHeart: (id: string, hearted: boolean) => void;
};

function CommentItem({ comment, palette, contentId, isAdmin, currentUserId = '', depth = 0, onOptimisticLike, onOptimisticPin, onReplyPosted, onOptimisticEdit, onDeleteComment, onOptimisticHeart }: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(comment.body);
  const [savingEdit, setSavingEdit] = useState(false);

  const submitReply = async () => {
    const text = replyText.trim();
    if (!text || postingReply) return;
    setPostingReply(true);
    try {
      const result = await postChannelCommentReply(contentId, text, comment.id);
      if (result?.comment) {
        onReplyPosted(result.comment);
        setReplyText('');
        setReplyOpen(false);
      }
    } finally {
      setPostingReply(false);
    }
  };

  const toggleLike = async () => {
    const nowLiked = !comment.is_liked;
    onOptimisticLike(comment.id, nowLiked);
    if (nowLiked) {
      await reactToChannelComment(comment.id);
    } else {
      await removeChannelCommentReaction(comment.id);
    }
  };

  const togglePin = async () => {
    const nowPinned = !comment.is_pinned;
    onOptimisticPin(comment.id, nowPinned);
    await pinChannelComment(comment.id, nowPinned);
  };

  const saveEdit = async () => {
    const text = editText.trim();
    if (!text || savingEdit) return;
    setSavingEdit(true);
    try {
      await editChannelComment(comment.id, text);
      onOptimisticEdit(comment.id, text);
      setEditMode(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete comment', 'Delete this comment permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteChannelComment(comment.id);
          onDeleteComment(comment.id);
        },
      },
    ]);
  };

  const toggleHeart = async () => {
    const nowHearted = !comment.has_creator_heart;
    onOptimisticHeart(comment.id, nowHearted);
    if (nowHearted) {
      await heartChannelComment(comment.id);
    } else {
      await unheartChannelComment(comment.id);
    }
  };

  const isOwnComment = Boolean(currentUserId && comment.user === currentUserId);

  return (
    <View style={[styles.commentRow, depth > 0 && styles.replyRow, { borderColor: palette.border }]}>
      {comment.is_pinned && (
        <View style={styles.pinnedBadge}>
          <KISIcon name="pin" size={11} color={palette.primaryStrong} />
          <Text style={[styles.pinnedLabel, { color: palette.primaryStrong }]}>Pinned</Text>
        </View>
      )}
      <View style={styles.authorRow}>
        <Text style={[styles.author, { color: palette.text }]}>{comment.user_display || 'KIS user'}</Text>
        {comment.has_creator_heart && (
          <View style={styles.heartCrownBadge}>
            <KISIcon name="heart" size={11} color={palette.danger} />
            <KISIcon name="crown" size={10} color={palette.gold} />
          </View>
        )}
      </View>
      {editMode ? (
        <View style={[styles.editInputRow, { borderColor: palette.border, backgroundColor: palette.bg }]}>
          <TextInput
            value={editText}
            onChangeText={setEditText}
            style={[styles.replyInput, { color: palette.text, flex: 1 }]}
            autoFocus
            multiline
          />
          <Pressable onPress={saveEdit} style={[styles.postButton, { backgroundColor: editText.trim() ? palette.text : palette.border }]}>
            <Text style={{ color: palette.surface, fontWeight: '900', fontSize: 12 }}>{savingEdit ? '…' : 'Save'}</Text>
          </Pressable>
          <Pressable onPress={() => { setEditMode(false); setEditText(comment.body); }} style={[styles.postButton, { backgroundColor: palette.border }]}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 12 }}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.body, { color: palette.subtext }]}>{comment.body}</Text>
      )}
      <View style={styles.commentActions}>
        <Pressable onPress={toggleLike} style={styles.actionBtn} hitSlop={10}>
          <KISIcon name="heart" focused={comment.is_liked} size={14} color={comment.is_liked ? palette.danger : palette.subtext} />
          {(comment.like_count ?? 0) > 0 && (
            <Text style={[styles.actionCount, { color: palette.subtext }]}>{comment.like_count}</Text>
          )}
        </Pressable>
        {depth === 0 && (
          <Pressable onPress={() => setReplyOpen(v => !v)} style={styles.actionBtn} hitSlop={10}>
            <KISIcon name="reply" size={13} color={palette.subtext} />
            <Text style={[styles.actionLabel, { color: palette.subtext }]}>Reply</Text>
            {(comment.reply_count ?? 0) > 0 && (
              <Text style={[styles.actionCount, { color: palette.subtext }]}>{comment.reply_count}</Text>
            )}
          </Pressable>
        )}
        {isAdmin && depth === 0 && (
          <Pressable onPress={togglePin} style={styles.actionBtn} hitSlop={10}>
            <KISIcon name="pin" size={13} color={comment.is_pinned ? palette.primaryStrong : palette.subtext} />
          </Pressable>
        )}
        {isAdmin && (
          <Pressable onPress={toggleHeart} style={styles.actionBtn} hitSlop={10}>
            <KISIcon name="heart" size={13} color={comment.has_creator_heart ? palette.danger : palette.subtext} />
            <KISIcon name="crown" size={11} color={comment.has_creator_heart ? palette.gold : palette.subtext} />
          </Pressable>
        )}
        {isOwnComment && !editMode && (
          <Pressable onPress={() => { setEditMode(true); setEditText(comment.body); }} style={styles.actionBtn} hitSlop={10}>
            <KISIcon name="edit" size={13} color={palette.subtext} />
          </Pressable>
        )}
        {(isOwnComment || isAdmin) && (
          <Pressable onPress={handleDelete} style={styles.actionBtn} hitSlop={10}>
            <KISIcon name="trash" size={13} color={palette.subtext} />
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            Alert.alert('Report comment', 'Report this comment as inappropriate?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Report',
                style: 'destructive',
                onPress: async () => {
                  await reportChannelComment(comment.id);
                  Alert.alert('Reported', 'Thank you for helping keep the community safe.');
                },
              },
            ]);
          }}
          style={styles.actionBtn}
          hitSlop={10}
        >
          <KISIcon name="report" size={13} color={palette.subtext} />
        </Pressable>
      </View>
      {replyOpen && (
        <View style={[styles.replyInputRow, { borderColor: palette.border, backgroundColor: palette.bg }]}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder={`Reply to ${comment.user_display || 'KIS user'}…`}
            placeholderTextColor={palette.subtext}
            style={[styles.replyInput, { color: palette.text }]}
            autoFocus
          />
          <Pressable
            onPress={submitReply}
            style={[styles.postButton, { backgroundColor: replyText.trim() ? palette.text : palette.border }]}
          >
            <Text style={{ color: palette.surface, fontWeight: '900', fontSize: 12 }}>
              {postingReply ? '…' : 'Post'}
            </Text>
          </Pressable>
        </View>
      )}
      {(comment.replies ?? []).map(reply => (
        <CommentItem
          key={reply.id}
          comment={reply}
          palette={palette}
          contentId={contentId}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          depth={depth + 1}
          onOptimisticLike={onOptimisticLike}
          onOptimisticPin={onOptimisticPin}
          onReplyPosted={onReplyPosted}
          onOptimisticEdit={onOptimisticEdit}
          onDeleteComment={onDeleteComment}
          onOptimisticHeart={onOptimisticHeart}
        />
      ))}
    </View>
  );
}

export default function ChannelCommentsPanel({ contentId, onCountChange, isAdmin = false, currentUserId = '' }: Props) {
  const { palette } = useKISTheme();
  const [flatComments, setFlatComments] = useState<ChannelContentComment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [sort, setSort] = useState<'new' | 'top' | 'pinned'>('new');

  const tree = buildTree(flatComments);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchChannelComments(contentId, sort);
      setFlatComments(rows);
      onCountChange?.(rows.length);
    } finally {
      setLoading(false);
    }
  }, [contentId, onCountChange, sort]);

  useEffect(() => { void load(); }, [load]);

  const submit = useCallback(async () => {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const result = await postChannelComment(contentId, text);
      if (result?.comment) {
        setFlatComments(prev => {
          const updated = [result.comment!, ...prev];
          onCountChange?.(updated.length);
          return updated;
        });
        setBody('');
      }
    } finally {
      setPosting(false);
    }
  }, [body, contentId, onCountChange, posting]);

  const handleOptimisticLike = useCallback((id: string, liked: boolean) => {
    setFlatComments(prev => prev.map(c =>
      c.id === id
        ? { ...c, is_liked: liked, like_count: Math.max(0, (c.like_count ?? 0) + (liked ? 1 : -1)) }
        : c,
    ));
  }, []);

  const handleOptimisticPin = useCallback((id: string, pinned: boolean) => {
    setFlatComments(prev => prev.map(c =>
      c.id === id ? { ...c, is_pinned: pinned } : c,
    ));
  }, []);

  const handleReplyPosted = useCallback((reply: ChannelContentComment) => {
    setFlatComments(prev => {
      const updated = [...prev, reply];
      onCountChange?.(updated.length);
      return updated;
    });
  }, [onCountChange]);

  const handleOptimisticEdit = useCallback((id: string, body: string) => {
    setFlatComments(prev => prev.map(c =>
      c.id === id ? { ...c, body } : c,
    ));
  }, []);

  const handleDeleteComment = useCallback((id: string) => {
    setFlatComments(prev => {
      const updated = prev.filter(c => c.id !== id);
      onCountChange?.(updated.length);
      return updated;
    });
  }, [onCountChange]);

  const handleOptimisticHeart = useCallback((id: string, hearted: boolean) => {
    setFlatComments(prev => prev.map(c =>
      c.id === id ? { ...c, has_creator_heart: hearted } : c,
    ));
  }, []);

  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Comments</Text>
        {loading ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : null}
      </View>
      <View style={styles.sortRow}>
        {(['new', 'top', 'pinned'] as const).map(option => (
          <Pressable
            key={option}
            onPress={() => setSort(option)}
            style={[
              styles.sortPill,
              { borderColor: palette.border, backgroundColor: sort === option ? palette.primaryStrong : palette.bg },
            ]}
          >
            <Text style={[styles.sortPillLabel, { color: sort === option ? palette.surface : palette.subtext }]}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.inputRow, { borderColor: palette.border, backgroundColor: palette.bg }]}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Add a comment"
          placeholderTextColor={palette.subtext}
          style={[styles.input, { color: palette.text }]}
          multiline
        />
        <Pressable
          onPress={submit}
          style={[styles.postButton, { backgroundColor: body.trim() ? palette.text : palette.border }]}
        >
          <Text style={{ color: palette.surface, fontWeight: '900', fontSize: 12 }}>{posting ? '...' : 'Post'}</Text>
        </Pressable>
      </View>
      {tree.length ? tree.map(item => (
        <CommentItem
          key={item.id}
          comment={item}
          palette={palette}
          contentId={contentId}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onOptimisticLike={handleOptimisticLike}
          onOptimisticPin={handleOptimisticPin}
          onReplyPosted={handleReplyPosted}
          onOptimisticEdit={handleOptimisticEdit}
          onDeleteComment={handleDeleteComment}
          onOptimisticHeart={handleOptimisticHeart}
        />
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
  replyRow: { marginLeft: 16, paddingLeft: 12, borderLeftWidth: 2, borderTopWidth: 0, marginTop: 8, paddingTop: 8 },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pinnedLabel: { fontSize: 10, fontWeight: '800' },
  author: { fontSize: 12, fontWeight: '900' },
  body: { marginTop: 3, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: 11, fontWeight: '700' },
  actionCount: { fontSize: 11, fontWeight: '700' },
  replyInputRow: { marginTop: 8, borderWidth: 1, borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  replyInput: { flex: 1, minHeight: 32, fontSize: 12, fontWeight: '700', padding: 0 },
  empty: { marginTop: 12, fontSize: 12, fontWeight: '700' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  sortPill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  sortPillLabel: { fontSize: 11, fontWeight: '800' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heartCrownBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editInputRow: { marginTop: 6, borderWidth: 1, borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
});
