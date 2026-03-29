import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Share,
  Alert,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES, {
  buildMediaSource,
  resolveBackendAssetUrl,
  useMediaHeaders,
} from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import Skeleton from '@/components/common/Skeleton';
import { Partner, PartnerPost } from './partnersTypes';
import FeedComposerSheet, { FeedComposerPayload } from '@/components/feeds/FeedComposerSheet';
import { prepareBroadcastVideoPayload } from '@/components/feeds/videoAttachmentHelpers';
import FeedPostActionsSheet from '@/components/feeds/FeedPostActionsSheet';
import { InlineCommentSheet, formatCommentContextLabel } from '@/components/feeds/FeedScreen';
import ShareRenderer, { type SharePayload } from '@/components/feeds/ShareRenderer';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import Video from 'react-native-video';
import { getAccessToken } from '@/security/authStorage';

type FeedItem =
  | { type: 'post'; data: PartnerPost }
  | { type: 'ad'; id: string };

type Props = {
  partner: Partner;
  onBack: () => void;
};

export default function PartnerFeedPage({ partner, onBack }: Props) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PartnerPost[]>([]);
  const [composerVisible, setComposerVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [activePost, setActivePost] = useState<PartnerPost | null>(null);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [commentThread, setCommentThread] = useState<
    { post: PartnerPost; conversationId: string; context?: Record<string, any> } | null
  >(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>({});
  const likedPostIdsRef = useRef<Record<string, boolean>>({});
  const handleCommentMessageCountChange = useCallback(
    (count: number) => {
      const postId = commentThread?.post.id;
      if (!postId) return;
      setCommentCounts((prev) => ({ ...prev, [postId]: count }));
    },
    [commentThread?.post?.id],
  );
  const shareShotRef = useRef<any>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const mediaHeaders = useMediaHeaders();
  const listRef = useRef<FlatList<FeedItem>>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(`${ROUTES.partners.posts}?partner=${partner.id}`, {
        errorMessage: 'Failed to load partner feed',
      });
      const list = (res?.data?.results ?? res?.data ?? res ?? []) as PartnerPost[];
      setPosts(Array.isArray(list) ? list : []);
      console.log('[PartnerFeedPage] loadFeed payload', list);
      console.log(
        '[PartnerFeedPage] attachments preview',
        (Array.isArray(list) ? list : []).map((post) => post?.attachments?.slice?.(0, 1)),
      );
    } finally {
      setLoading(false);
    }
  }, [partner.id]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    likedPostIdsRef.current = likedPostIds;
  }, [likedPostIds]);

  useEffect(() => {
    setCommentCounts((prev) => {
      const next = { ...prev };
      posts.forEach((post) => {
        if (next[post.id] == null && typeof post.comments_count === 'number') {
          next[post.id] = post.comments_count;
        }
      });
      return next;
    });
    setLikeCounts((prev) => {
      const next = { ...prev };
      posts.forEach((post) => {
        if (next[post.id] == null && Array.isArray(post.reactions)) {
          const count = post.reactions.reduce((sum, r) => sum + (r?.count ?? 0), 0);
          next[post.id] = count;
        }
      });
      return next;
    });
    setLikedPostIds((prev) => {
      const next = { ...prev };
      posts.forEach((post) => {
        if (typeof post.has_reacted === 'boolean') {
          next[post.id] = post.has_reacted;
        }
      });
      return next;
    });
  }, [posts]);

  const handleCreate = async (payload: FeedComposerPayload) => {
    const prepared = await prepareBroadcastVideoPayload(payload);
    if (!prepared) return;
    const payloadToSend = { partner: partner.id, ...prepared };
    delete payloadToSend.textPlain;
    delete payloadToSend.textPreview;
    delete payloadToSend.composerType;
    const res = await postRequest(ROUTES.partners.posts, payloadToSend, {
      errorMessage: 'Unable to post to partner feed.',
    });
    if (res?.success) {
      loadFeed();
    }
  };

  const handleReact = async (postId: string) => {
    const alreadyLiked = likedPostIdsRef.current[postId];
    const nextLiked = !alreadyLiked;
    setLikedPostIds((prev) => ({ ...prev, [postId]: nextLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? 0) + (nextLiked ? 1 : -1)),
    }));
    const res = await postRequest(
      ROUTES.partners.postReact(postId),
      { emoji: '👍', action: nextLiked ? 'add' : 'remove' },
      { errorMessage: 'Unable to react.' },
    );
    if (res?.data?.has_reacted !== undefined) {
      const serverLiked = Boolean(res.data.has_reacted);
      setLikedPostIds((prev) => ({ ...prev, [postId]: serverLiked }));
    }
  };

  const captureShareImage = async (payload: SharePayload) => {
    setSharePayload(payload);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
    await new Promise((resolve) => setTimeout(resolve, 60));
    const uri = await shareShotRef.current?.capture?.();
    setSharePayload(null);
    return uri as string | undefined;
  };

  const uploadShareAsset = async (uri: string) => {
    const token = await getAccessToken();
    if (!token) return null;
    const attachment = await uploadFileToBackend({
      file: {
        uri,
        name: `kis-share-${Date.now()}.png`,
        type: 'image/png',
      },
      authToken: token,
    });
    return attachment?.url ?? null;
  };

  const handleShare = async (post: PartnerPost) => {
    const text = post.text ?? post.styled_text?.text ?? '';
    const attachment = Array.isArray(post.attachments) ? post.attachments[0] : null;
    const attachmentUrl = resolveBackendAssetUrl(attachment?.url ?? attachment?.uri ?? null);
    const kind = attachment?.kind ?? attachment?.mimeType ?? '';
    const isImage = String(kind).includes('image');
    const watermarkColor = '#F97316';
    const subtitle = 'Partner share';

    if (attachmentUrl && isImage) {
      const imageUri = await captureShareImage({
        mode: 'image',
        text,
        imageUri: attachmentUrl,
        watermarkColor,
        subtitle,
      });
      if (imageUri) {
        const url = await uploadShareAsset(imageUri);
        if (url) {
          await Share.share({ message: url, url });
          return;
        }
      }
    }

    if (!attachmentUrl) {
      const imageUri = await captureShareImage({
        mode: 'text',
        text: text || 'Shared from KIS',
        watermarkColor,
        subtitle,
      });
      if (imageUri) {
        const url = await uploadShareAsset(imageUri);
        if (url) {
          await Share.share({ message: url, url });
          return;
        }
      }
    }

    if (attachmentUrl) {
      await Share.share({ message: `KIS: ${attachmentUrl}`, url: attachmentUrl });
      return;
    }

    await Share.share({ message: text || 'Shared from KIS' });
  };

  const openCommentChat = async (post: PartnerPost) => {
    setActivePost(post);
    let conversationId = post.comment_conversation_id ?? undefined;
    if (!conversationId) {
      const res = await postRequest(
        ROUTES.partners.postCommentRoom(post.id),
        {},
        { errorMessage: 'Unable to open comments.' },
      );
      conversationId =
        res?.data?.conversation_id ??
        res?.data?.conversationId ??
        res?.data?.id;
    }
    if (!conversationId) {
      Alert.alert('Comments', 'Unable to open comment thread.');
      return;
    }
    setCommentThread({
      post,
      conversationId,
      context: {
        partnerId: partner.id,
        partnerName: partner.name,
      },
    });
    setCommentSheetVisible(true);
  };

  const handleDelete = async (postId: string) => {
    const res = await postRequest(
      ROUTES.partners.postDelete(postId),
      {},
      { errorMessage: 'Unable to delete post.' },
    );
    if (res?.success) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  const handleBroadcast = async (postId: string) => {
    const res = await postRequest(
      ROUTES.partners.postBroadcast(postId),
      {},
      { errorMessage: 'Unable to broadcast post.' },
    );
    if (res?.success) {
      Alert.alert('Broadcast', 'Post added to broadcast.');
    }
  };

  const handleBlockUser = async (userId?: string) => {
    if (!userId) return;
    const res = await postRequest(
      ROUTES.moderation.userBlocks,
      { blocked: userId, reason: 'feed_block' },
      { errorMessage: 'Unable to block user.' },
    );
    if (res?.success) {
      setPosts((prev) => prev.filter((p) => p.author?.id !== userId));
    }
  };

  const handleReport = async (postId: string) => {
    const res = await postRequest(
      ROUTES.moderation.flags,
      {
        source: 'USER',
        target_type: 'POST',
        target_id: postId,
        reason: 'Reported from feed',
        severity: 'LOW',
      },
      { errorMessage: 'Unable to report post.' },
    );
    if (res?.success) {
      Alert.alert('Report', 'Thanks for letting us know.');
    }
  };

  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    posts.forEach((p, idx) => {
      items.push({ type: 'post', data: p });
      if ((idx + 1) % 3 === 0) {
        items.push({ type: 'ad', id: `ad-${idx}` });
      }
    });
    return items;
  }, [posts]);

  const scrollToActivePost = useCallback(() => {
    if (!activePost) return;
    const index = feedItems.findIndex(
      (item) => item.type === 'post' && item.data.id === activePost.id,
    );
    if (index < 0) return;
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true });
    }, 200);
  }, [activePost, feedItems]);

  const handleOpenPostFromChat = useCallback(() => {
    setCommentSheetVisible(false);
    setTimeout(() => {
      scrollToActivePost();
    }, 250);
  }, [scrollToActivePost]);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: palette.divider, backgroundColor: palette.card },
        ]}
      >
        <Pressable onPress={onBack} style={styles.headerButton}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          {partner.name} Feed
        </Text>
      </View>

      <View style={styles.feedHeader}>
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>
          General Feed
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <View
              key={`partner-feed-skel-${idx}`}
              style={[
                styles.postCard,
                { borderColor: palette.inputBorder, backgroundColor: palette.card },
              ]}
            >
              <View style={styles.postHeader}>
                <Skeleton width={36} height={36} radius={18} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="50%" height={12} radius={6} />
                  <Skeleton width="30%" height={10} radius={6} style={{ marginTop: 6 }} />
                </View>
              </View>
              <Skeleton width="100%" height={12} radius={6} style={{ marginTop: 10 }} />
              <Skeleton width="80%" height={12} radius={6} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feedItems}
          keyExtractor={(item, idx) => (item.type === 'post' ? item.data.id : item.id ?? String(idx))}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
          renderItem={({ item }) => {
            if (item.type === 'ad') {
              return (
                <View
                  style={[
                    styles.adCard,
                    { borderColor: palette.inputBorder, backgroundColor: palette.card },
                  ]}
                >
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Sponsored</Text>
                  <Text style={{ color: palette.text, fontSize: 15, fontWeight: '600', marginTop: 6 }}>
                    Reach partner members with targeted updates
                  </Text>
                  <Text style={{ color: palette.subtext, marginTop: 6 }}>
                    Promote your programs and announcements here.
                  </Text>
                </View>
              );
            }
            const post = item.data;
            const attachment = Array.isArray(post.attachments) ? post.attachments[0] : null;
            const rawAttachmentUrl =
              (typeof attachment === 'string' ? attachment : null) ??
              attachment?.url ??
              attachment?.uri ??
              attachment?.file_url ??
              attachment?.fileUrl ??
              attachment?.path ??
              null;
            const attachmentUrl = resolveBackendAssetUrl(rawAttachmentUrl);
            const thumbUrl =
              resolveBackendAssetUrl(
                attachment?.thumbUrl ??
                  attachment?.thumb_url ??
                  attachment?.thumbnail ??
                  attachment?.thumb ??
                  attachment?.preview_url ??
                  attachment?.previewUrl ??
                  null,
              ) ??
              attachmentUrl;
            const kind = attachment?.kind ?? attachment?.mimeType ?? attachment?.type ?? '';
            const isVideo = String(kind).includes('video') || String(kind).includes('mp4');
            const videoSource = buildMediaSource(attachmentUrl, mediaHeaders);
            return (
              <View
                style={[
                  styles.postCard,
                  { borderColor: palette.inputBorder, backgroundColor: palette.card },
                ]}
              >
                <View style={styles.postHeader}>
                  <ImagePlaceholder size={36} radius={18} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>
                      {post.author?.display_name ?? 'Member'}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {post.created_at ? new Date(post.created_at).toLocaleString() : 'Just now'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setActivePost(post);
                      setActionsVisible(true);
                    }}
                    style={styles.moreButton}
                  >
                    <KISIcon name="more-vert" size={18} color={palette.subtext} />
                  </Pressable>
                </View>
                {attachmentUrl ? (
                  <View style={styles.mediaWrap}>
                    {isVideo ? (
                      <Video
                        source={videoSource ?? { uri: attachmentUrl }}
                        style={styles.media}
                        controls
                        poster={thumbUrl ?? undefined}
                        posterResizeMode="cover"
                        resizeMode="cover"
                      />
                    ) : (
                      <Image source={{ uri: attachmentUrl }} style={styles.media} />
                    )}
                  </View>
                ) : null}
                <Text style={{ color: palette.text, marginTop: 10 }}>
                  {post.text ?? ''}
                </Text>
                <View style={styles.postActions}>
                  <Pressable style={styles.actionPill} onPress={() => handleReact(post.id)}>
                    <KISIcon
                      name="heart"
                      size={14}
                      color={likedPostIds[post.id] ? palette.primary : palette.subtext}
                    />
                    <Text style={{ color: palette.subtext, marginLeft: 6 }}>
                      Like{(likeCounts[post.id] ?? 0) ? ` (${likeCounts[post.id]})` : ''}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionPill}
                    onPress={() => {
                      openCommentChat(post);
                    }}
                  >
                    <KISIcon name="comment" size={14} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, marginLeft: 6 }}>
                      Comment
                      {(commentCounts[post.id] ?? post.comments_count)
                        ? ` (${commentCounts[post.id] ?? post.comments_count})`
                        : ''}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.actionPill} onPress={() => handleShare(post)}>
                    <KISIcon name="share" size={14} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, marginLeft: 6 }}>Share</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: palette.subtext }}>No posts yet.</Text>
            </View>
          }
        />
      )}

      <Pressable
        onPress={() => {
          setComposerVisible(true);
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: palette.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <KISIcon name="add" size={20} color={palette.onPrimary ?? '#fff'} />
      </Pressable>

      <FeedComposerSheet
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        onSubmit={handleCreate}
      />
      <ShareRenderer ref={shareShotRef} payload={sharePayload} />

      <FeedPostActionsSheet
        visible={actionsVisible}
        onClose={() => setActionsVisible(false)}
        actions={[
          {
            key: 'comment',
            label: 'Comment',
            onPress: () => {
              if (activePost) openCommentChat(activePost);
            },
          },
          {
            key: 'share',
            label: 'Share',
            onPress: () => {
              if (activePost) handleShare(activePost);
            },
          },
          {
            key: 'broadcast',
            label: 'Broadcast',
            onPress: () => {
              if (activePost) handleBroadcast(activePost.id);
            },
          },
          {
            key: 'report',
            label: 'Report',
            onPress: () => {
              if (activePost) handleReport(activePost.id);
            },
          },
          {
            key: 'block',
            label: 'Block user',
            onPress: () => {
              if (activePost) handleBlockUser(activePost.author?.id);
            },
          },
          {
            key: 'delete',
            label: 'Delete post',
            destructive: true,
            onPress: () => {
              if (activePost) handleDelete(activePost.id);
            },
          },
        ].filter((action) => action.key !== 'delete' || activePost?.id)}
      />

      <InlineCommentSheet
        visible={commentSheetVisible}
        conversationId={commentThread?.conversationId}
        headerLabel={`Feed: ${
          commentThread?.post?.text ?? commentThread?.post?.styled_text?.text ?? partner.name
        }`}
        contextLabel={formatCommentContextLabel(commentThread?.context)}
        onClose={() => {
          setCommentSheetVisible(false);
          setCommentThread(null);
        }}
        onMessageCountChange={handleCommentMessageCountChange}
        onPressContext={handleOpenPostFromChat}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  feedHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  postCard: { borderWidth: 2, borderRadius: 14, padding: 14, marginBottom: 14 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  moreButton: { padding: 6 },
  postActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  adCard: { borderWidth: 2, borderRadius: 14, padding: 14, marginBottom: 14 },
  mediaWrap: { marginTop: 10 },
  media: { width: '100%', height: 180, borderRadius: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
});
