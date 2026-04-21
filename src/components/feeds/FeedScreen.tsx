import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Share,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import Clipboard from '@react-native-clipboard/clipboard';

import { useKISTheme } from '@/theme/useTheme';
import ROUTES, {
  buildMediaSource,
  resolveBackendAssetUrl,
  useMediaHeaders,
  type MediaSource,
  type MediaHeaders,
} from '@/network';
import { postRequest } from '@/network/post';
import { prepareBroadcastVideoPayload } from './videoAttachmentHelpers';
import FeedPostActionsSheet from './FeedPostActionsSheet';
import ShareRenderer, { type SharePayload } from './ShareRenderer';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import Skeleton from '@/components/common/Skeleton';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import { DEV_BACKEND_HOST } from '@/network/config';
import { useSocket } from '../../../SocketProvider';
import CommentThreadPanel from './CommentThreadPanel';
import { formatCompactCount } from './feedUtils';
import { KISIcon } from '@/constants/kisIcons';
import { FeedComposerPayload } from './composer/types';
import RichTextRenderer from './RichTextRenderer';
import FeedComposerSheet from './composer/FeedComposerSheet';
import { logFeedEvent, type FeedType } from '@/network/personalization';
import { getAccessToken } from '@/security/authStorage';

const PERSONALIZATION_HISTORY_KEY = '@kis:personalization-history';

const shuffleItems = <T,>(items: T[]): T[] => {
  if (items.length <= 1) return items;
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'All posts' },
  { key: 'media', label: 'Media only' },
  { key: 'images', label: 'Images' },
  { key: 'videos', label: 'Videos' },
  { key: 'text', label: 'Text only' },
] as const;

type FilterOptionKey = (typeof FILTER_OPTIONS)[number]['key'];

export type FeedPost = {
  id: string;
  text?: string;
  styled_text?: { text?: string };
  text_doc?: any;
  text_plain?: string;
  text_preview?: string;
  attachments?: any[];
  comments_count?: number;
  comment_conversation_id?: string | null;
  reactions?: { emoji?: string; count?: number }[];
  has_reacted?: boolean;
  created_at?: string;
  author?: { display_name?: string; id?: string };
};

type ComposerContext = { key: string; value: string };

type FeedScreenProps<T extends FeedPost> = {
  entityTitle: string;
  feedLabel: string;
  adTitle: string;
  adDescription: string;
  shareSubtitle: string;
  shareWatermarkColor: string;
  onBack: () => void;
  composerEndpoint: string;
  composerContext?: ComposerContext;
  composerErrorMessage?: string;
  loadPosts: () => Promise<T[]>;
  reactEndpoint: (postId: string) => string;
  commentRoomEndpoint: (postId: string) => string;
  deleteEndpoint: (postId: string) => string;
  broadcastEndpoint: (postId: string) => string;
  commentChatContext: (post: T) => Record<string, any>;
  chatHeaderLabel: (post: T) => string;
  emptyStateText?: string;
  feedType?: FeedType;
};

type FeedItem<T extends FeedPost> = { type: 'post'; data: T } | { type: 'ad'; id: string };

const isRemoteAssetUrl = (value?: string | null): boolean => {
  if (!value) return false;
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  if (/^file:/i.test(trimmed) || /^content:/i.test(trimmed)) return false;
  if (trimmed.startsWith('//') || /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return true;
  return false;
};

const sanitizeUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  const qIndex = trimmed.indexOf('?');
  if (qIndex >= 0) {
    const base = trimmed.slice(0, qIndex).replace(/\/+$/, '');
    const query = trimmed.slice(qIndex + 1);
    return query ? `${base}?${query}` : base;
  }
  return trimmed.replace(/\/+$/, '');
};

const ensureTrailingSlash = (value?: string | null): string | undefined => {
  const u = sanitizeUrl(value);
  if (!u) return undefined;
  return u.endsWith('/') ? u : `${u}/`;
};

const uploadFeedAttachment = async (attachment: any, token: string): Promise<any | null> => {
  if (!attachment || typeof attachment === 'string') return attachment;

  const sourceUri = attachment.url ?? attachment.uri;
  if (!sourceUri || isRemoteAssetUrl(String(sourceUri))) return attachment;

  const file = {
    uri: sourceUri,
    name: attachment.originalName ?? attachment.name ?? `kis-attachment-${Date.now()}`,
    type: attachment.mimeType ?? attachment.type ?? 'application/octet-stream',
    size: typeof attachment.size === 'number' ? attachment.size : undefined,
    durationMs: typeof attachment.durationMs === 'number' ? attachment.durationMs : undefined,
  };

  try {
    const uploaded = await uploadFileToBackend({
      file,
      authToken: token,
    });
    return { ...attachment, ...uploaded };
  } catch (error) {
    console.warn('[FeedScreen] uploadFeedAttachment failed', error);
    Alert.alert('Upload failed', 'Unable to upload attachment. Please try again.');
    return null;
  }
};

const uploadFeedAttachmentsIfNeeded = async (
  payload: FeedComposerPayload,
): Promise<FeedComposerPayload | null> => {
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (!attachments.length) return payload;

  const token = await getAccessToken();
  if (!token) {
    Alert.alert('Upload failed', 'Unable to upload attachments. Please sign in again.');
    return null;
  }

  const nextAttachments: any[] = [];
  for (const attachment of attachments) {
    const uploaded = await uploadFeedAttachment(attachment, token);
    if (uploaded === null) return null;
    nextAttachments.push(uploaded);
  }

  return { ...payload, attachments: nextAttachments };
};

const resolveMediaUrl = (raw: any): string | undefined => {
  const resolved = resolveBackendAssetUrl(raw ?? null);
  return sanitizeUrl(resolved);
};

const resolvedStreamHeaders = new Map<string, string>();

const resolveStreamHeadUrl = async (
  attachment: any,
  streamUrl: string | undefined,
  headers: MediaHeaders,
): Promise<string | undefined> => {
  if (!streamUrl) return sanitizeUrl(attachment?.url);
  const cacheKey = `${attachment?.id}-${streamUrl}`;
  if (resolvedStreamHeaders.has(cacheKey)) {
    return resolvedStreamHeaders.get(cacheKey);
  }
  if (!streamUrl.includes('/stream/')) {
    const sanitized = sanitizeUrl(streamUrl);
    if (sanitized) {
      resolvedStreamHeaders.set(cacheKey, sanitized);
    }
    return sanitized;
  }
  try {
    const response = await fetch(streamUrl, { method: 'HEAD', headers });
    const direct = response.headers.get('X-Video-URL');
    if (direct) {
      const sanitized = sanitizeUrl(direct);
      if (sanitized) {
        resolvedStreamHeaders.set(cacheKey, sanitized);
        return sanitized;
      }
    }
  } catch (error) {
    console.warn('[FeedScreen] stream HEAD failed', error);
  }
  const sanitizedFallback = sanitizeUrl(streamUrl);
  if (sanitizedFallback) {
    resolvedStreamHeaders.set(cacheKey, sanitizedFallback);
  }
  return sanitizedFallback;
};

const looksLikeLocalhost = (u?: string) =>
  !!u && (/^https?:\/\/127\.0\.0\.1[:/]/i.test(u) || /^https?:\/\/localhost[:/]/i.test(u));

export default function FeedScreen<T extends FeedPost>({
  entityTitle,
  feedLabel,
  adTitle,
  adDescription,
  shareSubtitle,
  shareWatermarkColor,
  onBack,
  composerEndpoint,
  composerContext,
  composerErrorMessage,
  loadPosts,
  reactEndpoint,
  commentRoomEndpoint,
  deleteEndpoint,
  broadcastEndpoint,
  commentChatContext,
  chatHeaderLabel: _chatHeaderLabel,
  emptyStateText,
  feedType = 'broadcast',
}: FeedScreenProps<T>) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const mediaHeaders = useMediaHeaders();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOptionKey>('all');
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<T[]>([]);
  const [composerVisible, setComposerVisible] = useState(false);
  const [userHasPersonalizedHistory, setUserHasPersonalizedHistory] = useState(false);

  const [actionsVisible, setActionsVisible] = useState(false);
  const [activePost, setActivePost] = useState<T | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);

  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [conversationIds, setConversationIds] = useState<Record<string, string | null>>({});
  const conversationIdsRef = useRef<Record<string, string | null>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>({});
  const likedPostIdsRef = useRef<Record<string, boolean>>({});
  const [feedScrollEnabled, setFeedScrollEnabled] = useState(true);

  const shareShotRef = useRef<any>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  const listRef = useRef<FlatList<FeedItem<T>>>(null);

  // VIDEO MODAL STATE
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [isModalVideoPlaying, setIsModalVideoPlaying] = useState(false);

  const [modalPost, setModalPost] = useState<T | null>(null);
  const [modalVideoAttachment, setModalVideoAttachment] = useState<any | null>(null);

  const [modalVideoCandidates, setModalVideoCandidates] = useState<string[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [pendingVideoRequest, setPendingVideoRequest] = useState<
    { streamUrl?: string; directUrl?: string; attachment?: any; post: T } | null
  >(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PERSONALIZATION_HISTORY_KEY);
        if (!active) return;
        setUserHasPersonalizedHistory(stored === 'true');
      } catch (error) {
        console.warn('[FeedScreen] failed to load personalization history', error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const videoPlayerRef = useRef<any>(null);

  const normalizedFeedType = feedType;
  const logImpression = useCallback(
    (count: number) => {
      if (!normalizedFeedType) return;
      void logFeedEvent({
        feedType: normalizedFeedType,
        event: 'impression',
        metadata: { count },
      });
    },
    [normalizedFeedType],
  );

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadPosts();
      const normalized = Array.isArray(list) ? list : [];
      const shouldShuffle = !userHasPersonalizedHistory && normalized.length > 1;
      const finalList = shouldShuffle ? shuffleItems(normalized) : normalized;
      setPosts(finalList);
      logImpression(finalList.length);
    } finally {
      setLoading(false);
    }
  }, [loadPosts, logImpression, userHasPersonalizedHistory]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    likedPostIdsRef.current = likedPostIds;
  }, [likedPostIds]);

  useEffect(() => {
    conversationIdsRef.current = conversationIds;
  }, [conversationIds]);

  useEffect(() => {
    setConversationIds((prev) => {
      let changed = false;
      const next = { ...prev };
      posts.forEach((post) => {
        if (next[post.id] === undefined && post.comment_conversation_id != null) {
          next[post.id] = post.comment_conversation_id;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [posts]);

  const toggleCommentThread = useCallback((postId: string) => {
    if (normalizedFeedType) {
      void logFeedEvent({ feedType: normalizedFeedType, event: 'comments_toggle', targetId: postId });
    }
        setActiveCommentPostId((prev) => (prev === postId ? null : postId));
    setFeedScrollEnabled(true);
  }, [normalizedFeedType]);

  const handleCommentScrollStart = useCallback(() => {
    setFeedScrollEnabled(false);
  }, []);

  const handleCommentScrollEnd = useCallback(() => {
    setFeedScrollEnabled(true);
  }, []);

  const setConversationIdForPost = useCallback((postId: string, value: string | null) => {
    setConversationIds((prev) => {
      if (prev[postId] === value) return prev;
      return { ...prev, [postId]: value };
    });
  }, []);

  const fetchConversationIdForPost = useCallback(
    async (postId: string) => {
      const cached = conversationIdsRef.current[postId];
      if (cached !== undefined) {
        return cached;
      }
      try {
        const res = await postRequest(
          commentRoomEndpoint(postId),
          {},
          { errorMessage: 'Unable to load comments.' },
        );
        const resolved =
          res?.data?.conversation_id ?? res?.data?.conversationId ?? res?.data?.id ?? null;
        setConversationIdForPost(postId, resolved);
        return resolved;
      } catch (err) {
        console.warn('[FeedScreen] fetchConversationId failed', err);
        setConversationIdForPost(postId, null);
        return null;
      }
    },
    [commentRoomEndpoint, setConversationIdForPost],
  );

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
          next[post.id] = post.reactions.reduce((sum, r) => sum + (r?.count ?? 0), 0);
        }
      });
      return next;
    });

    setLikedPostIds((prev) => {
      const next = { ...prev };
      posts.forEach((post) => {
        if (typeof post.has_reacted === 'boolean') next[post.id] = post.has_reacted;
      });
      return next;
    });
  }, [posts]);

  const handleCommentCountChange = useCallback(
    (postId: string, count: number) => {
      setCommentCounts((prev) => {
        if (prev[postId] === count) return prev;
        return { ...prev, [postId]: count };
      });
    },
    [],
  );
  const displayedPosts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      const fallbackText = post.text_plain ?? post.text ?? post.styled_text?.text ?? '';
      if (normalizedQuery && !fallbackText.toLowerCase().includes(normalizedQuery)) return false;

      const atts = Array.isArray(post.attachments) ? post.attachments : [];
      const hasMedia = atts.length > 0;
      const attachment = atts[0];

      const rawKind =
        typeof attachment === 'string'
          ? attachment
          : attachment?.kind ?? attachment?.mimeType ?? attachment?.type ?? '';

      const kind = String(rawKind).toLowerCase();
      const isImage = kind.includes('image') || kind.includes('jpeg') || kind.includes('png');
      const isVideo = kind.includes('video') || kind.includes('mp4') || kind.includes('mov');

      switch (activeFilter) {
        case 'media':
          return hasMedia;
        case 'images':
          return hasMedia && isImage;
        case 'videos':
          return hasMedia && isVideo;
        case 'text':
          return !hasMedia;
        default:
          return true;
      }
    });
  }, [activeFilter, posts, searchQuery]);

  const handleCreate = useCallback(
    async (payload: FeedComposerPayload) => {
      const prepared = await prepareBroadcastVideoPayload(payload);
      if (!prepared) return;

      const enrichedPayload = await uploadFeedAttachmentsIfNeeded(prepared);
      if (!enrichedPayload) return;

      const requestPayload = { ...enrichedPayload };
      delete requestPayload.textPlain;
      delete requestPayload.textPreview;
      delete requestPayload.composerType;

      const contextPayload = composerContext ? { [composerContext.key]: composerContext.value } : {};

      const res = await postRequest(
        composerEndpoint,
        { ...contextPayload, ...requestPayload },
        { errorMessage: composerErrorMessage ?? 'Unable to post.' },
      );
      if (res?.success) loadFeed();
    },
    [composerContext, composerEndpoint, composerErrorMessage, loadFeed],
  );

  const attemptOpenVideoModal = useCallback(
    async (opts: { streamUrl?: string; directUrl?: string; attachment?: any; post: T }) => {
      const candidateStream = ensureTrailingSlash(opts.streamUrl);
      const candidateDirect =
        opts.streamUrl && opts.attachment
          ? await resolveStreamHeadUrl(opts.attachment, opts.streamUrl, mediaHeaders)
          : sanitizeUrl(opts.directUrl);

      const candidates = Array.from(new Set([candidateStream, candidateDirect].filter(Boolean) as string[]));

      if (!candidates.length) {
        Alert.alert('Video', 'No playable video URL found for this post.');
        return;
      }

      if (looksLikeLocalhost(candidates[0])) {
        console.warn(
          '[FeedScreen] video URL is localhost. On a real device this will fail. Use your LAN IP instead.',
          candidates[0],
        );
      }

      if (normalizedFeedType) {
        void logFeedEvent({ feedType: normalizedFeedType, event: 'video_open', targetId: opts.post.id });
      }

      setModalPost(opts.post);
      setModalVideoAttachment(opts.attachment ?? null);
      setModalVideoCandidates(candidates);
      setCandidateIndex(0);
      setIsModalVideoPlaying(false);
      setVideoModalVisible(true);

      requestAnimationFrame(() => setIsModalVideoPlaying(true));
    },
    [mediaHeaders, normalizedFeedType],
  );

  const openVideoModal = useCallback(
    (opts: { streamUrl?: string; directUrl?: string; attachment?: any; post: T }) => {
      if (!mediaHeaders.Authorization) {
        setPendingVideoRequest(opts);
        return;
      }
      void attemptOpenVideoModal(opts);
    },
    [attemptOpenVideoModal, mediaHeaders.Authorization],
  );

  useEffect(() => {
    if (!pendingVideoRequest || !mediaHeaders.Authorization) return;
    const pending = pendingVideoRequest;
    setPendingVideoRequest(null);
    void attemptOpenVideoModal(pending);
  }, [attemptOpenVideoModal, mediaHeaders.Authorization, pendingVideoRequest]);

  const closeVideoModal = useCallback(() => {
    setVideoModalVisible(false);
    setModalPost(null);
    setModalVideoAttachment(null);
    setModalVideoCandidates([]);
    setCandidateIndex(0);
    setIsModalVideoPlaying(false);
  }, []);

  const currentVideoUrl = modalVideoCandidates[candidateIndex];

  const currentVideoSource: MediaSource | undefined = useMemo(() => {
    if (!currentVideoUrl) return undefined;
    return buildMediaSource(currentVideoUrl, mediaHeaders);
  }, [currentVideoUrl, mediaHeaders]);

  const tryNextCandidate = useCallback(() => {
    setCandidateIndex((idx) => {
      const next = idx + 1;
      if (next >= modalVideoCandidates.length) return idx;
      return next;
    });
    setIsModalVideoPlaying(true);
  }, [modalVideoCandidates]);

  const markPersonalizationHistory = useCallback(async () => {
    if (userHasPersonalizedHistory) return;
    try {
      await AsyncStorage.setItem(PERSONALIZATION_HISTORY_KEY, 'true');
    } catch (error) {
      console.warn('[FeedScreen] failed to persist personalization history', error);
    }
    setUserHasPersonalizedHistory(true);
  }, [userHasPersonalizedHistory]);

  const handleReact = useCallback(
    async (postId: string) => {
      const alreadyLiked = likedPostIdsRef.current[postId];
      const nextLiked = !alreadyLiked;

      setLikedPostIds((prev) => ({ ...prev, [postId]: nextLiked }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] ?? 0) + (nextLiked ? 1 : -1)),
      }));

      const res = await postRequest(
        reactEndpoint(postId),
        { emoji: '👍', action: nextLiked ? 'add' : 'remove' },
        { errorMessage: 'Unable to react.' },
      );

      if (res?.data?.has_reacted !== undefined) {
        setLikedPostIds((prev) => ({ ...prev, [postId]: Boolean(res.data.has_reacted) }));
      }
      void markPersonalizationHistory();
    },
    [markPersonalizationHistory, reactEndpoint],
  );

  const captureShareImage = useCallback(async (payload: SharePayload) => {
    setSharePayload(payload);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
    await new Promise((resolve) => setTimeout(resolve, 60));
    const uri = await shareShotRef.current?.capture?.();
    setSharePayload(null);
    return uri as string | undefined;
  }, []);

  const uploadShareAsset = useCallback(async (uri: string) => {
    const token = await getAccessToken();
    if (!token) return null;
    const attachment = await uploadFileToBackend({
      file: { uri, name: `kis-share-${Date.now()}.png`, type: 'image/png' },
      authToken: token,
    });
    return attachment?.url ?? null;
  }, []);

  const handleShare = useCallback(
    async (post: T) => {
      const text = post.text_plain ?? post.text ?? post.styled_text?.text ?? '';
      const attachment = Array.isArray(post.attachments) ? post.attachments[0] : null;

      const attachmentUrl = resolveBackendAssetUrl(
        (typeof attachment === 'string' ? attachment : null) ?? attachment?.url ?? attachment?.uri ?? null,
      );

      const kind = attachment?.kind ?? attachment?.mimeType ?? attachment?.type ?? '';
      const isImage = String(kind).includes('image');

      const watermarkColor = shareWatermarkColor;
      const subtitle = shareSubtitle;

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
    },
    [captureShareImage, shareSubtitle, shareWatermarkColor, uploadShareAsset],
  );

  const copyPostLink = useCallback((post: T) => {
    const fallback = `https://kis.app/posts/${post.id}`;
    const permalink =
      (post as any).permalink ??
      (post as any).url ??
      (post as any).link ??
      fallback;
    Clipboard.setString(permalink);
    Alert.alert('Link copied', 'Post link saved to clipboard.');
  }, []);

  const handleDelete = useCallback(
    async (postId: string) => {
      const res = await postRequest(deleteEndpoint(postId), {}, { errorMessage: 'Unable to delete post.' });
      if (res?.success) setPosts((prev) => prev.filter((p) => p.id !== postId));
    },
    [deleteEndpoint],
  );

  const handleBroadcast = useCallback(
    async (postId: string) => {
      const res = await postRequest(broadcastEndpoint(postId), {}, { errorMessage: 'Unable to broadcast post.' });
      if (res?.success) Alert.alert('Broadcast', 'Post added to broadcast.');
    },
    [broadcastEndpoint],
  );

  const handleBlockUser = useCallback(async (userId?: string) => {
    if (!userId) return;
    const res = await postRequest(
      ROUTES.moderation.userBlocks,
      { blocked: userId, reason: 'feed_block' },
      { errorMessage: 'Unable to block user.' },
    );
    if (res?.success) setPosts((prev) => prev.filter((p) => p.author?.id !== userId));
  }, []);

  const handleReport = useCallback(async (postId: string) => {
    const res = await postRequest(
      ROUTES.moderation.flags,
      { source: 'USER', target_type: 'POST', target_id: postId, reason: 'Reported from feed', severity: 'LOW' },
      { errorMessage: 'Unable to report post.' },
    );
    if (res?.success) Alert.alert('Report', 'Thanks for letting us know.');
  }, []);

  const feedItems = useMemo(() => {
    const items: FeedItem<T>[] = [];
    displayedPosts.forEach((post, idx) => {
      items.push({ type: 'post', data: post });
      if ((idx + 1) % 3 === 0) items.push({ type: 'ad', id: `ad-${idx}` });
    });
    return items;
  }, [displayedPosts]);

  const listEmptyMessage = searchQuery ? 'No posts match your search or filters.' : emptyStateText ?? 'No posts yet.';

  // ======== “Design EXACTLY like mock” header + section ========

  const renderSearchFilters = () => (
    <View style={styles.headerStack}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{feedLabel}</Text>

      <View style={styles.searchWrapOuter}>
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: palette.card,
              borderColor: palette.divider,
            },
          ]}
        >
          <KISIcon name="search" size={18} color={palette.subtext} />
          <TextInput
            placeholder="Search posts..."
            placeholderTextColor={palette.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInputNew, { color: palette.text }]}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRowNew}
        >
          {FILTER_OPTIONS.map((option) => {
            const isActive = option.key === activeFilter;
            return (
              <Pressable
                key={option.key}
                onPress={() => setActiveFilter(option.key)}
                style={[
                  styles.filterChipNew,
                  {
                    backgroundColor: isActive ? '#274B8F' : '#F1F3F6',
                    borderColor: isActive ? 'transparent' : 'rgba(0,0,0,0.06)',
                  },
                ]}
              >
                <Text style={[styles.filterChipTextNew, { color: isActive ? '#fff' : '#4B5563' }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* Soft background glow like the mock (no extra deps) */}
      <View pointerEvents="none" style={styles.bgGlowA} />
      <View pointerEvents="none" style={styles.bgGlowB} />

      {/* Top App Bar (center title, back left, bell right) */}
      <View
        style={[
          styles.appBar,
          {
            paddingTop: insets.top + 6,
            backgroundColor: palette.card,
          },
        ]}
      >
        <Pressable onPress={onBack} style={styles.appBarIconBtn} hitSlop={10}>
          <KISIcon name="arrow-left" size={22} color={palette.text} />
        </Pressable>

        <Text style={[styles.appBarTitle, { color: palette.text }]} numberOfLines={1}>
          {entityTitle}
        </Text>

        <Pressable
          onPress={() => {
            // optional: hook to notifications later
          }}
          style={styles.appBarIconBtn}
          hitSlop={10}
        >
          {/* If your icon set uses a different name, swap here (e.g. "notifications") */}
          <KISIcon name="bell" size={22} color={palette.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          {renderSearchFilters()}

          <View style={{ marginTop: 14, gap: 14 }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <View key={`feed-skel-${idx}`} style={[styles.card, styles.cardShadow, { backgroundColor: palette.card }]}>
                <View style={styles.postTopRow}>
                  <Skeleton width={40} height={40} radius={20} />
                  <View style={{ flex: 1 }}>
                    <Skeleton width="45%" height={12} radius={6} />
                    <Skeleton width="30%" height={10} radius={6} style={{ marginTop: 6 }} />
                  </View>
                  <Skeleton width={18} height={18} radius={9} />
                </View>
                <Skeleton width="92%" height={12} radius={6} style={{ marginTop: 12 }} />
                <Skeleton width="70%" height={12} radius={6} style={{ marginTop: 8 }} />
                <Skeleton width="100%" height={170} radius={16} style={{ marginTop: 12 }} />
                <View style={{ flexDirection: 'row', gap: 18, marginTop: 14 }}>
                  <Skeleton width={60} height={16} radius={8} />
                  <Skeleton width={60} height={16} radius={8} />
                  <Skeleton width={60} height={16} radius={8} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feedItems}
          keyExtractor={(item, idx) => (item.type === 'post' ? item.data.id : item.id ?? String(idx))}
          ListHeaderComponent={renderSearchFilters}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 110 }}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          }}
          scrollEnabled={feedScrollEnabled}
          renderItem={({ item }) => {
            if (item.type === 'ad') {
              return (
                <View style={[styles.card, styles.cardShadow, styles.adCardNew]}>
                  <Text style={styles.sponsoredLabel}>Sponsored</Text>
                  <View style={styles.adRow}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.adTitleNew}>{adTitle}</Text>
                      <Text style={styles.adDescNew} numberOfLines={3}>
                        {adDescription}
                      </Text>

                      <Pressable
                        onPress={() => {}}
                        style={({ pressed }) => [styles.adBtn, { opacity: pressed ? 0.9 : 1 }]}
                      >
                        <Text style={styles.adBtnText}>Learn More</Text>
                      </Pressable>
                    </View>

                    <View style={styles.adImageWrap}>
                      <ImagePlaceholder size={88} radius={14} style={{ width: 110, height: 88 }} />
                    </View>
                  </View>
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

            const attachmentUrl = resolveMediaUrl(rawAttachmentUrl);

            const kind = attachment?.kind ?? attachment?.mimeType ?? attachment?.type ?? '';
            const isVideo =
              String(kind).toLowerCase().includes('video') || String(kind).toLowerCase().includes('mp4');

            const videoStreamFn = ROUTES.broadcasts?.videoStream;
            const streamUrl =
              isVideo &&
              attachment?.id &&
              typeof videoStreamFn === 'function'
                ? ensureTrailingSlash(videoStreamFn(attachment.id))
                : undefined;

            const thumbUrl =
              resolveMediaUrl(
                attachment?.thumbUrl ??
                  attachment?.thumb_url ??
                  attachment?.thumbnail ??
                  attachment?.thumb ??
                  attachment?.preview_url ??
                  attachment?.previewUrl ??
                  null,
              ) ?? attachmentUrl;

            const likeCount = likeCounts[post.id] ?? 0;
            const commentCount = commentCounts[post.id] ?? post.comments_count ?? 0;

            return (
              <View style={[styles.card, styles.cardShadow]}>
                <View style={styles.postTopRow}>
                  <View style={styles.avatarStack}>
                    <ImagePlaceholder size={40} radius={20} style={styles.avatarNew} />
                    {/* tiny “heart badge” like mock */}
                    <View style={styles.avatarBadge}>
                      <Text style={styles.avatarBadgeText}>❤</Text>
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.authorName} numberOfLines={1}>
                      {post.author?.display_name ?? 'Member'}
                    </Text>
                    <Text style={styles.postTime} numberOfLines={1}>
                      {post.created_at ? new Date(post.created_at).toLocaleString() : 'Just now'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      setActivePost(post);
                      setActionsVisible(true);
                    }}
                    style={styles.moreBtnNew}
                    hitSlop={10}
                  >
                    <Text style={styles.moreDots}>•••</Text>
                  </Pressable>
                </View>

                <View style={{ marginTop: 10 }}>
                  <RichTextRenderer
                    doc={(post.text ?? post.text_doc) ?? undefined}
                    fallback={
                      post.text_plain ??
                      (typeof post.text === 'string' ? post.text : '') ??
                      post.styled_text?.text ??
                      ''
                    }
                  />
                </View>

                {attachmentUrl ? (
                  isVideo ? (
                    <Pressable
                      style={styles.mediaWrapNew}
                      onPress={() =>
                        void openVideoModal({
                          streamUrl,
                          directUrl: attachmentUrl,
                          attachment,
                          post,
                        })
                      }
                    >
                      <Image source={{ uri: thumbUrl ?? attachmentUrl }} style={styles.mediaNew} resizeMode="cover" />
                      <View style={styles.playOverlayNew} pointerEvents="none">
                        <View style={styles.playCircleNew}>
                          <Text style={styles.playTriangle}>▶</Text>
                        </View>
                      </View>
                    </Pressable>
                  ) : (
                    <View style={styles.mediaWrapNew}>
                      <Image source={{ uri: attachmentUrl }} style={styles.mediaNew} resizeMode="cover" />
                    </View>
                  )
                ) : null}

                {/* bottom action row like mock (icon + count) */}
                <View style={styles.actionsRowNew}>
                  <Pressable style={styles.actionItemNew} onPress={() => handleReact(post.id)}>
                    <Text style={[styles.actionIconNew, likedPostIds[post.id] ? styles.actionIconLiked : null]}>
                      ❤
                    </Text>
                    <Text style={styles.actionCountNew}>{formatCompactCount(likeCount)}</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionItemNew}
                    onPress={() => toggleCommentThread(post.id)}
                  >
                    <Text style={styles.actionIconNew}>💬</Text>
                    <Text style={styles.actionCountNew}>{formatCompactCount(commentCount)}</Text>
                  </Pressable>

                  <Pressable style={styles.actionItemNew} onPress={() => handleShare(post)}>
                    <Text style={styles.actionIconNew}>↗</Text>
                    <Text style={styles.actionCountNew}></Text>
                  </Pressable>
                </View>

                {activeCommentPostId === post.id && (
                  <CommentThreadPanel
                    postId={post.id}
                    initialConversationId={
                      conversationIds[post.id] ?? post.comment_conversation_id ?? null
                    }
                    fetchConversationId={() => fetchConversationIdForPost(post.id)}
                    onConversationResolved={(id) => setConversationIdForPost(post.id, id)}
                    onMessageCountChange={(count) => handleCommentCountChange(post.id, count)}
                    headerLabel="Comments"
                    contextLabel={formatCommentContextLabel(commentChatContext(post))}
                    onScrollStart={handleCommentScrollStart}
                    onScrollEnd={handleCommentScrollEnd}
                  />
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <Text style={{ color: palette.subtext }}>{listEmptyMessage}</Text>
            </View>
          }
        />
      )}

      {/* FAB: colorful circle + plus like mock */}
      <Pressable
        onPress={() => setComposerVisible(true)}
        style={({ pressed }) => [styles.fabNew, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <View style={styles.fabGradient}>
          <Text style={styles.fabPlus}>＋</Text>
        </View>
      </Pressable>

      {/* VIDEO MODAL (full-screen experience like broadcasts) */}
      <Modal
        visible={videoModalVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        supportedOrientations={['portrait', 'landscape']}
        statusBarTranslucent
        onRequestClose={closeVideoModal}
      >
        <View style={[styles.videoModal, { paddingTop: insets.top }]}>
          {currentVideoSource ? (
            <View style={styles.videoContainer}>
              <Pressable
                onPress={closeVideoModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[
                  styles.videoCloseButton,
                  { top: insets.top + 12, left: 16, borderColor: 'rgba(255,255,255,0.4)' },
                ]}
              >
                <KISIcon name="close" size={24} color="#fff" />
              </Pressable>

              <Video
                key={currentVideoUrl ?? 'no-video'}
                ref={videoPlayerRef}
                source={currentVideoSource}
                style={styles.videoPlayer}
                paused={!isModalVideoPlaying}
                controls={false}
                resizeMode="contain"
                ignoreSilentSwitch="ignore"
                playInBackground={false}
                playWhenInactive={false}
                allowsExternalPlayback={false}
                poster={
                  resolveMediaUrl(modalVideoAttachment?.thumbUrl ?? modalVideoAttachment?.thumb_url ?? null) ??
                  resolveMediaUrl(modalVideoAttachment?.url ?? null) ??
                  undefined
                }
                posterResizeMode="cover"
                onError={(e) => {
                  console.warn('[FeedScreen] videoModal playback error', JSON.stringify(e, null, 2));
                  const hasNext = candidateIndex + 1 < modalVideoCandidates.length;
                  if (hasNext) {
                    setIsModalVideoPlaying(true);
                    tryNextCandidate();
                    return;
                  }
                  Alert.alert('Playback error', 'Unable to play the selected video.');
                }}
                onEnd={() => setIsModalVideoPlaying(false)}
              />
              {!isModalVideoPlaying && (
                <Pressable style={styles.modalPlayOverlay} onPress={() => setIsModalVideoPlaying(true)}>
                  <KISIcon name="play" size={32} color="#fff" />
                  <Text style={styles.modalPlayLabel}>Play</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={[styles.videoContainer, { padding: 16 }]}>
              <Text style={[styles.videoMessage, { color: palette.text }]}>No video source available.</Text>
              {modalVideoCandidates.length ? (
                <Text style={[styles.videoSubmessage, { color: palette.subtext }]}>
                  Candidates: {modalVideoCandidates.join('  •  ')}
                </Text>
              ) : null}
            </View>
          )}

          {modalPost ? (
            <View style={styles.videoFloatingActions}>
              <Pressable
                style={styles.videoFloatingActionButton}
                onPress={() => modalPost && handleShare(modalPost)}
              >
                <KISIcon name="share" size={20} color="#fff" />
                <Text style={styles.actionCountText}>Share</Text>
              </Pressable>
              <Pressable
                style={styles.videoFloatingActionButton}
                onPress={() => modalPost && toggleCommentThread(modalPost.id)}
              >
                <KISIcon name="comment" size={20} color="#fff" />
                <Text style={styles.actionCountText}>
                  {formatCompactCount(commentCounts[modalPost.id] ?? modalPost.comments_count ?? 0)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => modalPost && handleReact(modalPost.id)}
                style={[
                  styles.videoFloatingActionButton,
                  modalPost && likedPostIds[modalPost.id] ? styles.videoFloatingActive : null,
                ]}
              >
                <KISIcon
                  name="heart"
                  size={20}
                  color={modalPost && likedPostIds[modalPost.id] ? '#F97316' : '#fff'}
                />
                <Text
                  style={[
                    styles.actionCountText,
                    modalPost && likedPostIds[modalPost.id] ? { color: '#F97316' } : null,
                  ]}
                >
                  {formatCompactCount(likeCounts[modalPost.id] ?? 0)}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {looksLikeLocalhost(currentVideoUrl) ? (
            <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, textAlign: 'center' }}>
                Note: This URL is localhost. On a real iPhone, replace {DEV_BACKEND_HOST} with your computer LAN IP.
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <FeedComposerSheet visible={composerVisible} onClose={() => setComposerVisible(false)} onSubmit={handleCreate} />
      <ShareRenderer ref={shareShotRef} payload={sharePayload} />

      <FeedPostActionsSheet
        visible={actionsVisible}
        onClose={() => setActionsVisible(false)}
        actions={[
          { key: 'share', label: 'Share', onPress: () => activePost && handleShare(activePost) },
          { key: 'copy-link', label: 'Copy link', onPress: () => activePost && copyPostLink(activePost) },
          { key: 'broadcast', label: 'Broadcast', onPress: () => activePost && handleBroadcast(activePost.id) },
          { key: 'report', label: 'Report', onPress: () => activePost && handleReport(activePost.id) },
          { key: 'block', label: 'Block user', onPress: () => activePost && handleBlockUser(activePost.author?.id) },
          { key: 'delete', label: 'Delete post', destructive: true, onPress: () => activePost && handleDelete(activePost.id) },
        ].filter((action) => action.key !== 'delete' || activePost?.id)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Soft “pink/blue glow” background like mock
  bgGlowA: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: 'rgba(255, 105, 180, 0.22)',
  },
  bgGlowB: {
    position: 'absolute',
    top: 40,
    left: -110,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: 'rgba(99, 179, 237, 0.22)',
  },

  // AppBar (center title)
  appBar: {
    paddingBottom: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  appBarIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },

  headerStack: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },

  // Search + chips block
  searchWrapOuter: {
    gap: 10,
  },
  searchWrap: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputNew: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filtersRowNew: {
    paddingVertical: 2,
    gap: 10,
    paddingRight: 8,
  },
  filterChipNew: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipTextNew: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Cards (rounded, soft shadow)
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  cardShadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 4,
    },
    default: {},
  }) as any,

  // Post top row
  postTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarStack: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarNew: { width: 40, height: 40 },
  avatarBadge: {
    position: 'absolute',
    left: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  avatarBadgeText: { fontSize: 10, color: '#F43F5E', fontWeight: '900' },

  authorName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  postTime: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginTop: 2 },

  moreBtnNew: { paddingHorizontal: 8, paddingVertical: 6 },
  moreDots: { fontSize: 18, fontWeight: '800', color: '#9CA3AF' },

  // Media like mock
  mediaWrapNew: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EEF2F7',
  },
  mediaNew: {
    width: '100%',
    height: 200,
  },
  playOverlayNew: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  playCircleNew: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: { fontSize: 26, color: '#fff', marginLeft: 2 },

  // Actions row like mock (left aligned, icon + count)
  actionsRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginTop: 14,
  },
  actionItemNew: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionIconNew: { fontSize: 18, color: '#6B7280' },
  actionIconLiked: { color: '#F43F5E' },
  actionCountNew: { fontSize: 14, fontWeight: '800', color: '#EF4444' },

  // Ad card like mock
  adCardNew: {
    paddingTop: 12,
  },
  sponsoredLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  adRow: { flexDirection: 'row', alignItems: 'center' },
  adTitleNew: { fontSize: 16, fontWeight: '900', color: '#1F3B77' },
  adDescNew: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#6B7280' },
  adBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  adBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  adImageWrap: {
    width: 120,
    height: 92,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // FAB like mock (colorful)
  fabNew: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 66,
    height: 66,
    borderRadius: 33,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 7 },
      default: {},
    }),
  },
  fabGradient: {
    flex: 1,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4D7D',
  },
  fabPlus: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: -2 },

  videoModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  videoPlayer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  videoCloseButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 2,
  },
  modalPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 6,
  },
  modalPlayLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  videoMessage: {
    fontSize: 16,
    fontWeight: '600',
  },
  videoSubmessage: {
    marginTop: 8,
    fontSize: 13,
  },
  videoFloatingActions: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    flexDirection: 'column-reverse',
    alignItems: 'center',
  },
  videoFloatingActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  videoFloatingActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  actionCountText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
});

type CommentMessage = {
  id: string;
  clientId?: string;
  text: string;
  senderName: string;
  senderId?: string;
  createdAt: string;
  mine?: boolean;
};

type InlineCommentSheetProps = {
  visible: boolean;
  conversationId?: string | null;
  headerLabel?: string;
  contextLabel?: string;
  placeholder?: string;
  onClose: () => void;
  onMessageCountChange?: (count: number) => void;
  onPressContext?: () => void;
};

const ChatEvents = {
  JOIN: 'chat.join',
  LEAVE: 'chat.leave',
  SEND: 'chat.send',
  MESSAGE: 'chat.message',
  HISTORY: 'chat.history',
} as const;

const parseTimestamp = (value?: string) => {
  if (!value) return 0;
  const when = Date.parse(value);
  if (Number.isNaN(when)) return 0;
  return when;
};

export const formatCommentContextLabel = (context?: Record<string, any>) => {
  if (!context) return undefined;
  const entries = Object.entries(context).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  if (!entries.length) return undefined;
  return entries.map(([key, value]) => `${key}: ${value}`).join(' • ');
};

export const InlineCommentSheet: React.FC<InlineCommentSheetProps> = ({
  visible,
  conversationId,
  headerLabel,
  contextLabel,
  placeholder,
  onClose,
  onMessageCountChange,
  onPressContext,
}) => {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const { socket, isConnected, currentUserId } = useSocket();
  const [messages, setMessages] = useState<CommentMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const listRef = useRef<FlatList<CommentMessage>>(null);
  const sentLocalRef = useRef(new Set<string>());

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setMessages([]);
    setStatusMessage(null);
  }, [conversationId]);

  useEffect(() => {
    if (!visible || !conversationId || !socket) return undefined;
    socket.emit(ChatEvents.JOIN, { conversationId }, (ack: any) => {
      if (!ack?.ok) {
        setStatusMessage(ack?.error ?? 'Unable to join conversation.');
      } else {
        setStatusMessage('Tracking comments');
      }
    });
    return () => {
      if (socket && conversationId) {
        socket.emit(ChatEvents.LEAVE, { conversationId });
      }
    };
  }, [conversationId, socket, visible]);

  const mapMessage = useCallback(
    (payload: any): CommentMessage => {
      const text =
        payload?.text ??
        payload?.message ??
        payload?.styled_text?.text ??
        payload?.previewText ??
        payload?.preview ??
        '';
      const id =
        payload?.id ??
        payload?.serverId ??
        payload?.messageId ??
        payload?.clientId ??
        `${conversationId ?? 'thread'}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const senderId =
        payload?.senderId ??
        payload?.sender?.id ??
        payload?.sender_id ??
        payload?.userId ??
        payload?.user?.id ??
        payload?.user?.pk;
      const senderName =
        payload?.senderName ??
        payload?.sender?.display_name ??
        payload?.sender?.name ??
        payload?.user?.display_name ??
        payload?.user?.name ??
        'Someone';
      const createdAt =
        payload?.createdAt ??
        payload?.created_at ??
        payload?.created ??
        payload?.timestamp ??
        new Date().toISOString();
      const mine =
        senderId && currentUserId ? String(senderId) === String(currentUserId) : false;
      return {
        id: String(id),
        clientId: payload?.clientId,
        text: String(text ?? ''),
        senderName: String(senderName),
        senderId: senderId ? String(senderId) : undefined,
        createdAt,
        mine,
      };
    },
    [conversationId, currentUserId],
  );

  const addMessage = useCallback((message: CommentMessage) => {
    setMessages((prev) => {
      if (
        prev.some(
          (existing) =>
            existing.id === message.id ||
            (message.clientId && existing.clientId && existing.clientId === message.clientId),
        )
      ) {
        return prev;
      }
      const next = [...prev, message];
      next.sort((a, b) => parseTimestamp(a.createdAt) - parseTimestamp(b.createdAt));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!socket || !conversationId) return undefined;
    const handler = (payload: any) => {
      if (payload?.conversationId !== conversationId) return;
      if (payload?.clientId && sentLocalRef.current.has(payload.clientId)) {
        sentLocalRef.current.delete(payload.clientId);
        return;
      }
      addMessage(mapMessage(payload));
    };
    socket.on(ChatEvents.MESSAGE, handler);
    return () => {
      socket.off(ChatEvents.MESSAGE, handler);
    };
  }, [socket, conversationId, addMessage, mapMessage]);

  useEffect(() => {
    if (!visible || !socket || !conversationId) return undefined;
    if (!isConnected && !socket.connected) return undefined;
    let active = true;
    setLoading(true);
    socket.timeout(5000).emit(
      ChatEvents.HISTORY,
      { conversationId, limit: 60 },
      (err: any, ack?: any) => {
        if (!active) return;
        setLoading(false);
        if (err || !ack?.ok) {
          setStatusMessage(err?.message ?? ack?.error ?? 'Unable to load comments.');
          return;
        }
        const items = Array.isArray(ack?.data?.messages) ? ack.data.messages : [];
        if (!items.length) {
          setMessages([]);
          return;
        }
        const mapped = items.map((item: any) => mapMessage(item));
        mapped.sort((a: CommentMessage, b: CommentMessage) => parseTimestamp(a.createdAt) - parseTimestamp(b.createdAt));
        setMessages(mapped);
      },
    );
    return () => {
      active = false;
    };
  }, [visible, socket, conversationId, isConnected, mapMessage]);

  useEffect(() => {
    if (!messages.length) {
      return;
    }
    onMessageCountChange?.(messages.length);
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, [messages.length, onMessageCountChange]);

  const sendComment = useCallback(() => {
    if (!socket || !conversationId) return;
    const text = draft.trim();
    if (!text) return;
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localMessage: CommentMessage = {
      id: clientId,
      clientId,
      text,
      senderName: 'You',
      createdAt: new Date().toISOString(),
      mine: true,
    };
    addMessage(localMessage);
    sentLocalRef.current.add(clientId);
    setDraft('');
    socket.emit(
      ChatEvents.SEND,
      { conversationId, clientId, kind: 'text', text },
      (ack: any) => {
        if (!ack?.ok) {
          setStatusMessage(ack?.error ?? 'Unable to post comment.');
        }
      },
    );
    setTimeout(() => sentLocalRef.current.delete(clientId), 60_000);
  }, [socket, conversationId, draft, addMessage]);

  const canSend = Boolean(
    draft.trim().length && socket && conversationId && (isConnected || socket.connected),
  );

  const statusLabel =
    statusMessage ||
    (isConnected || socket?.connected ? 'Tracking comments' : 'Offline – comments sync when online');

  const renderItem = useCallback(
    ({ item }: { item: CommentMessage }) => (
      <View
        style={[
          commentStyles.commentRow,
          item.mine ? commentStyles.commentMine : commentStyles.commentOther,
        ]}
      >
        <View style={commentStyles.avatar}>
          <Text style={commentStyles.avatarLabel}>
            {item.senderName.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={commentStyles.commentBody}>
          <View style={commentStyles.commentHeader}>
            <Text style={commentStyles.commentAuthor}>{item.senderName}</Text>
            <Text style={commentStyles.commentTime}>
              {new Date(item.createdAt).toLocaleTimeString()}
            </Text>
          </View>
          <Text style={commentStyles.commentText}>{item.text}</Text>
        </View>
      </View>
    ),
    [],
  );

  const emptyComponent = useMemo(
    () => (
      <View style={commentStyles.emptyState}>
        <Text style={commentStyles.emptyText}>No comments yet. Be the first to share a thought.</Text>
      </View>
    ),
    [],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[commentStyles.container, { paddingTop: insets.top + 12 }]}>
        <View style={commentStyles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[commentStyles.headerLabel, { color: palette.text }]}>
              {headerLabel ?? 'Comments'}
            </Text>
            {contextLabel ? (
              onPressContext ? (
                <Pressable onPress={onPressContext}>
                  <Text style={[commentStyles.contextLabel, commentStyles.contextLink]}>
                    {contextLabel}
                  </Text>
                </Pressable>
              ) : (
                <Text style={commentStyles.contextLabel}>{contextLabel}</Text>
              )
            ) : null}
            <Text style={[commentStyles.statusLabel, { color: palette.muted }]}>{statusLabel}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[commentStyles.closeLabel, { color: palette.accent }]}>Close</Text>
          </Pressable>
        </View>

        <View style={commentStyles.listWrapper}>
          {loading ? (
            <View style={commentStyles.loading}>
              <ActivityIndicator size="small" color={palette.accent} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={
                messages.length ? commentStyles.listContent : commentStyles.listEmpty
              }
              ListEmptyComponent={emptyComponent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={80}
        >
          <View style={[commentStyles.composerRow, { borderColor: palette.divider }]}>
            <TextInput
              style={[
                commentStyles.composerInput,
                { borderColor: palette.inputBorder, color: palette.text },
              ]}
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder ?? 'Write a comment…'}
              placeholderTextColor={palette.muted}
              multiline
              numberOfLines={2}
            />
            <Pressable
              onPress={sendComment}
              disabled={!canSend}
              style={({ pressed }) => [
                commentStyles.sendButton,
                {
                  backgroundColor: palette.accent,
                  opacity: !canSend ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={commentStyles.sendLabel}>Post</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const commentStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050814',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLabel: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  contextLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
  },
  contextLink: {
    textDecorationLine: 'underline',
  },
  statusLabel: {
    fontSize: 12,
  },
  closeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  listWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  listContent: {
    paddingBottom: 16,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  commentMine: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  commentOther: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  commentTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  commentText: {
    fontSize: 14,
    color: '#e2e8f0',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  composerInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 120,
  },
  sendButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sendLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
  },
});
