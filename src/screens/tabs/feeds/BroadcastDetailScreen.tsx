import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { resolveBackendAssetUrl } from '@/network';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import BroadcastFeedVideoPreview from '@/components/broadcast/BroadcastFeedVideoPreview';
import { isVideoAttachment } from '@/components/broadcast/attachmentPreview';

const REACTION_EVENT = 'broadcast.reaction';

const pickAttachmentUrl = (attachment: any): string | undefined => {
  if (!attachment) return undefined;
  if (typeof attachment === 'string') return attachment;
  return (
    attachment.fileUrl ??
    attachment.url ??
    attachment.uri ??
    attachment.file_url ??
    attachment.path ??
    attachment.previewUrl ??
    attachment.preview_url
  );
};

export default function BroadcastDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'BroadcastDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'BroadcastDetail'>>();
  const { palette } = useKISTheme();

  const initialItem = route.params?.item ?? null;
  const [broadcastItem, setBroadcastItem] = useState<any | null>(initialItem);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialItem ? null : 'Broadcast details are only available when navigating from the feed list.',
  );
  const broadcastId = broadcastItem?.id ?? route.params?.id;
  const reactionCount = Number(broadcastItem?.reaction_count ?? broadcastItem?.engagement?.reactions ?? 0);
  const commentCount = Number(broadcastItem?.comment_count ?? broadcastItem?.engagement?.comments ?? 0);
  const viewerReaction = broadcastItem?.viewer_reaction ?? null;
  const viewerSaved = Boolean(broadcastItem?.viewer_saved);
  const shareCount = Number(broadcastItem?.share_count ?? 0);
  const title = broadcastItem?.title ?? broadcastItem?.source?.name ?? 'Broadcast';
  const body = broadcastItem?.text_plain ?? broadcastItem?.text ?? broadcastItem?.body ?? '';

  const handleReact = useCallback(async () => {
    if (!broadcastItem) return;
    const previousCount = Number(broadcastItem?.reaction_count ?? broadcastItem?.engagement?.reactions ?? 0);
    const previousReaction = broadcastItem?.viewer_reaction ?? null;
    const hadSameReaction = previousReaction === '❤️';
    const hadDifferentReaction = Boolean(previousReaction && previousReaction !== '❤️');
    setBroadcastItem((prev: any) =>
      prev
        ? {
            ...prev,
            reaction_count: hadSameReaction
              ? Math.max(previousCount - 1, 0)
              : hadDifferentReaction
                ? previousCount
                : previousCount + 1,
            viewer_reaction: hadSameReaction ? null : '❤️',
            engagement: {
              ...(prev.engagement ?? {}),
              reactions: hadSameReaction
                ? Math.max(previousCount - 1, 0)
                : hadDifferentReaction
                  ? previousCount
                  : previousCount + 1,
            },
          }
        : prev,
    );
    try {
      const response = await postRequest(
        ROUTES.broadcasts.react(broadcastId ?? ''),
        { emoji: '❤️' },
        { errorMessage: 'Unable to register reaction.' },
      );
      if (!response?.success) {
        throw new Error(response?.message ?? 'Could not react');
      }
      const count = Number(response?.data?.count ?? response?.count ?? previousCount);
      const reacted = Boolean(response?.data?.reacted ?? response?.reacted);
      setBroadcastItem((prev: any) =>
        prev
          ? {
              ...prev,
              reaction_count: count,
              viewer_reaction: reacted ? '❤️' : null,
              engagement: {
                ...(prev.engagement ?? {}),
                reactions: count,
              },
            }
          : prev,
      );
      DeviceEventEmitter.emit(REACTION_EVENT, {
        id: broadcastId,
        count,
        reacted,
        emoji: reacted ? '❤️' : null,
      });
    } catch {
      setBroadcastItem((prev: any) =>
        prev
          ? {
              ...prev,
              reaction_count: previousCount,
              viewer_reaction: previousReaction,
              engagement: {
                ...(prev.engagement ?? {}),
                reactions: previousCount,
              },
            }
          : prev,
      );
    }
  }, [broadcastId, broadcastItem]);

  const handleOpenComments = useCallback(async () => {
    if (!broadcastId) return;
    const res = await postRequest(
      ROUTES.broadcasts.commentRoom(broadcastId),
      {},
      { errorMessage: 'Unable to load comments.' },
    );
    const conversationId =
      res?.data?.conversation_id ??
      res?.data?.conversationId ??
      res?.data?.id ??
      null;
    if (!conversationId) {
      Alert.alert('Comments', 'Unable to open the comment room for this broadcast.');
      return;
    }
    DeviceEventEmitter.emit('chat.open', {
      conversationId,
      name: title,
      kind: 'broadcast_comments',
    });
  }, [broadcastId, title]);

  const handleToggleSaved = useCallback(async () => {
    if (!broadcastId) return;
    const previousSaved = Boolean(broadcastItem?.viewer_saved);
    setBroadcastItem((prev: any) => (prev ? { ...prev, viewer_saved: !previousSaved } : prev));
    const endpoint = ROUTES.broadcasts.save(broadcastId);
    const res = previousSaved
      ? await postRequest(`${endpoint}?action=unsave`, {}, { errorMessage: 'Unable to remove saved broadcast.' })
      : await postRequest(endpoint, {}, { errorMessage: 'Unable to save broadcast.' });
    if (!res?.success) {
      setBroadcastItem((prev: any) => (prev ? { ...prev, viewer_saved: previousSaved } : prev));
      Alert.alert('Saved posts', 'Unable to update this saved post right now.');
    }
  }, [broadcastId, broadcastItem?.viewer_saved]);

  const handleShare = useCallback(async () => {
    if (!broadcastId) return;
    const previousShareCount = Number(broadcastItem?.share_count ?? 0);
    setBroadcastItem((prev: any) => (prev ? { ...prev, share_count: previousShareCount + 1 } : prev));
    const res = await postRequest(
      ROUTES.broadcasts.share(broadcastId),
      { platform: 'app' },
      { errorMessage: 'Unable to log share.' },
    );
    if (!res?.success) {
      setBroadcastItem((prev: any) => (prev ? { ...prev, share_count: previousShareCount } : prev));
      Alert.alert('Share', 'Unable to log this share right now.');
    }
    await Share.share({
      title,
      message: [title?.trim(), body?.trim()].filter(Boolean).join('\n\n'),
    });
  }, [body, broadcastId, broadcastItem?.share_count, title]);

  const attachments = useMemo(
    () => (Array.isArray(broadcastItem?.attachments) ? broadcastItem.attachments.filter(Boolean) : []),
    [broadcastItem?.attachments],
  );
  const attachmentUrls = useMemo(() => {
    return attachments
      .map((attachment: any) => pickAttachmentUrl(attachment))
      .filter(Boolean)
      .map((url: string) => resolveBackendAssetUrl(url))
      .filter(Boolean);
  }, [attachments]);
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState(0);

  useEffect(() => {
    setActiveAttachmentIndex(0);
  }, [attachmentUrls.length]);

  const attachmentUrl = attachmentUrls[activeAttachmentIndex] ?? null;
  const activeAttachment = attachments[activeAttachmentIndex] ?? null;
  const activeAttachmentIsVideo = isVideoAttachment(activeAttachment);
  const showCarousel = attachmentUrls.length > 0;
  const showControls = attachmentUrls.length > 1;
  const handlePrevAttachment = () => {
    setActiveAttachmentIndex((prev) =>
      attachmentUrls.length ? (prev === 0 ? attachmentUrls.length - 1 : prev - 1) : 0,
    );
  };
  const handleNextAttachment = () => {
    setActiveAttachmentIndex((prev) =>
      attachmentUrls.length ? (prev + 1) % attachmentUrls.length : 0,
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.error, { color: palette.text }]}>{error}</Text>
        <Pressable
          onPress={() =>
            setError('Broadcast details are only available when navigating from the feed list.')
          }
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!broadcastItem) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.error, { color: palette.text }]}>Broadcast not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.bg }]} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <KISIcon name="arrow-left" size={24} color={palette.text} />
        <Text style={[styles.backLabel, { color: palette.text }]}>Back</Text>
      </Pressable>
      <Text style={[styles.heading, { color: palette.text }]}>{title}</Text>
      {showCarousel ? (
        <View style={[styles.slideshowWrap, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          {activeAttachmentIsVideo && activeAttachment ? (
            <BroadcastFeedVideoPreview
              attachment={activeAttachment}
              palette={palette as any}
              containerStyle={styles.videoWrap}
              videoStyle={styles.image}
            />
          ) : attachmentUrl ? (
            <Image source={{ uri: attachmentUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, { backgroundColor: palette.bar }]} />
          )}

          {showControls ? (
            <>
              <Pressable style={[styles.navButton, styles.navLeft]} onPress={handlePrevAttachment}>
                <Text style={[styles.navButtonText, { color: palette.primaryStrong }]}>{'‹'}</Text>
              </Pressable>
              <Pressable style={[styles.navButton, styles.navRight]} onPress={handleNextAttachment}>
                <Text style={[styles.navButtonText, { color: palette.primaryStrong }]}>{'›'}</Text>
              </Pressable>
              <View style={styles.dotRow}>
                {attachmentUrls.map((_: string, dotIndex: number) => (
                  <View
                    key={`dot-${dotIndex}`}
                    style={[
                      styles.dot,
                      dotIndex === activeAttachmentIndex ? styles.dotActive : null,
                      {
                        backgroundColor:
                          dotIndex === activeAttachmentIndex ? palette.primaryStrong : palette.surface,
                      },
                    ]}
                  />
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
      {body ? (
        <Text style={[styles.body, { color: palette.text }]}>{body}</Text>
      ) : null}
      <View style={[styles.actionRow, { borderTopColor: palette.divider }]}>
        <Pressable onPress={handleToggleSaved} style={styles.actionItem}>
          <KISIcon name="bookmark" size={20} color={viewerSaved ? palette.primaryStrong : palette.subtext} />
          <Text style={[styles.actionText, { color: viewerSaved ? palette.primaryStrong : palette.subtext }]}>
            {viewerSaved ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
        <Pressable onPress={handleReact} style={styles.actionItem}>
          <KISIcon name="heart" size={20} color={viewerReaction ? palette.primaryStrong : palette.subtext} />
          <Text style={[styles.actionText, { color: viewerReaction ? palette.primaryStrong : palette.subtext }]}>
            React{reactionCount > 0 ? ` ${reactionCount}` : ''}
          </Text>
        </Pressable>
        <Pressable onPress={handleOpenComments} style={styles.actionItem}>
          <KISIcon name="comment" size={20} color={palette.subtext} />
          <Text style={[styles.actionText, { color: palette.subtext }]}>
            Comment{commentCount > 0 ? ` ${commentCount}` : ''}
          </Text>
        </Pressable>
        <Pressable onPress={handleShare} style={styles.actionItem}>
          <KISIcon name="share" size={20} color={palette.subtext} />
          <Text style={[styles.actionText, { color: palette.subtext }]}>
            Share{shareCount > 0 ? ` ${shareCount}` : ''}
          </Text>
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.counter, { color: palette.subtext }]}>
          {reactionCount} reaction
          {reactionCount === 1 ? '' : 's'}
        </Text>
        <Text style={[styles.counter, { color: palette.subtext }]}>
          {commentCount} comment
          {commentCount === 1 ? '' : 's'}
        </Text>
        <Text style={[styles.counter, { color: palette.subtext }]}>
          {shareCount} share
          {shareCount === 1 ? '' : 's'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: '#000',
  },
  videoWrap: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  slideshowWrap: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
    borderWidth: 2,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 2,
  },
  navLeft: {
    left: 12,
  },
  navRight: {
    right: 12,
  },
  navButtonText: {
    fontSize: 20,
    fontWeight: '900',
  },
  dotRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  dotActive: {
    borderColor: '#fff',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  counter: {
    fontSize: 13,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
