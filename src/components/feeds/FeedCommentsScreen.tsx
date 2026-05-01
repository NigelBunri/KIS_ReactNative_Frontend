import React, { useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CommentThreadPanel from '@/components/feeds/CommentThreadPanel';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { chatRoomStyles } from '@/Module/ChatRoom/chatRoomStyles';
import { useKISTheme } from '@/theme/useTheme';

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

  const previewText =
    postPreview?.text?.trim() ||
    postPreview?.title?.trim() ||
    '';

  const handleOpenPost = () => {
    onClose();
    if (onOpenPost) onOpenPost();
  };

  const fetchConversationId = useCallback(async () => {
    if (!postId) return null;
    const endpoint =
      sourceType === 'community'
        ? ROUTES.community.postCommentRoom(postId)
        : ROUTES.partners.postCommentRoom(postId);

    const res = await postRequest(
      endpoint,
      {},
      { errorMessage: 'Unable to load comments.' },
    );

    return res?.data?.conversation_id ?? res?.conversation_id ?? null;
  }, [postId, sourceType]);

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
              {title || 'Comments'}
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

        <CommentThreadPanel
          postId={postId}
          fetchConversationId={fetchConversationId}
          headerLabel={title || 'Comments'}
          placeholder="Write a comment..."
        />
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
