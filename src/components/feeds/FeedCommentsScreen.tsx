import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { useSocket } from '../../../SocketProvider';
import { MessageList } from '@/Module/ChatRoom/componets/main/MessageList';
import { chatRoomStyles } from '@/Module/ChatRoom/chatRoomStyles';
import type { ChatMessage } from '@/Module/ChatRoom/chatTypes';

type Comment = {
  id: string;
  text: string;
  created_at?: string;
  author?: { id?: string; display_name?: string };
  author_id?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  sourceType: 'community' | 'partner';
  postId: string;
  title?: string;
  postPreview?: {
    title?: string;
    text?: string;
  };
  onOpenPost?: () => void;
};

export default function FeedCommentsScreen({
  visible,
  onClose,
  sourceType,
  postId,
  title,
  postPreview,
  onOpenPost,
}: Props) {
  const { palette } = useKISTheme();
  const { currentUserId } = useSocket();
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const url =
      sourceType === 'community'
        ? ROUTES.community.postComments(postId)
        : ROUTES.partners.postComments(postId);
    const res = await getRequest(url, { errorMessage: 'Failed to load comments.' });
    const list = res?.data?.results ?? res?.data ?? res ?? [];
    setComments(Array.isArray(list) ? list : []);
    setLoading(false);
  }, [postId, sourceType]);

  useEffect(() => {
    if (!visible) return;
    loadComments();
  }, [visible, loadComments]);

  const handlePost = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    const url =
      sourceType === 'community'
        ? ROUTES.community.postComment(postId)
        : ROUTES.partners.postComment(postId);
    const res = await postRequest(url, { text: trimmed }, { errorMessage: 'Unable to post comment.' });
    setPosting(false);
    if (res?.success) {
      setText('');
      loadComments();
    }
  };

  const messages = useMemo(() => {
    const roomId = `${sourceType}:${postId}`;
    return comments.map((comment) => {
      const authorId = comment.author?.id ?? comment.author_id ?? 'unknown';
      const createdAt = comment.created_at ?? new Date().toISOString();
      const fromMe =
        currentUserId != null && String(authorId) === String(currentUserId);
      return {
        id: String(comment.id),
        roomId,
        clientId: String(comment.id),
        createdAt,
        senderId: String(authorId),
        senderName: comment.author?.display_name ?? 'Member',
        fromMe,
        kind: 'text',
        status: 'sent',
        text: comment.text,
      } as ChatMessage;
    });
  }, [comments, currentUserId, postId, sourceType]);

  const previewText =
    postPreview?.text?.trim() ||
    postPreview?.title?.trim() ||
    '';

  const handleOpenPost = () => {
    onClose();
    if (onOpenPost) {
      onOpenPost();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[chatRoomStyles.root, { backgroundColor: palette.bg }]}>
        <View style={[chatRoomStyles.header, { borderBottomColor: palette.divider }]}>
          <Pressable onPress={onClose} style={chatRoomStyles.headerBackButton}>
            <KISIcon name="arrow-left" size={20} color={palette.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[chatRoomStyles.headerTitle, { color: palette.text }]} numberOfLines={1}>
              {title || 'How to see'}
            </Text>
            {previewText ? (
              <Pressable onPress={handleOpenPost}>
                <Text
                  style={[styles.previewText, { color: palette.subtext }]}
                  numberOfLines={1}
                >
                  {previewText}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {onOpenPost ? (
            <Pressable onPress={handleOpenPost} style={chatRoomStyles.headerIconButton}>
              <KISIcon name="link" size={18} color={palette.subtext} />
            </Pressable>
          ) : null}
        </View>

        {messages.length ? (
          <MessageList
            messages={messages}
            palette={palette}
            isEmpty={false}
            currentUserId={currentUserId ?? undefined}
            startAtBottom
          />
        ) : (
          <View style={chatRoomStyles.emptyStateContainer}>
            <Text style={{ color: palette.subtext }}>
              {loading ? 'Loading comments...' : 'No comments yet.'}
            </Text>
          </View>
        )}

        <View
          style={[
            chatRoomStyles.composerContainer,
            { borderTopColor: palette.divider, backgroundColor: palette.card },
          ]}
        >
          <View style={chatRoomStyles.composerMainRow}>
            <View
              style={[
                chatRoomStyles.composerInputWrapper,
                { borderColor: palette.divider, backgroundColor: palette.surface },
              ]}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Write a comment..."
                placeholderTextColor={palette.subtext}
                style={[chatRoomStyles.composerInput, { color: palette.text }]}
                multiline
              />
            </View>
            <Pressable
              onPress={handlePost}
              style={({ pressed }) => [
                chatRoomStyles.composerActionButton,
                {
                  backgroundColor: palette.primary,
                  opacity: pressed || posting ? 0.7 : 1,
                },
              ]}
              disabled={posting}
            >
              <KISIcon name="send" size={16} color={palette.onPrimary ?? '#fff'} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  previewText: {
    fontSize: 12,
    marginTop: 2,
  },
});
