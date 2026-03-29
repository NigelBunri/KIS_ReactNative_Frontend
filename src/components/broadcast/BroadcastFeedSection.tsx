import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Modal,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation } from '@react-navigation/native';
import ViewShot from 'react-native-view-shot';
import Video from 'react-native-video';

import { useKISTheme } from '@/theme/useTheme';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES, { buildMediaSource, resolveBackendAssetUrl, useMediaHeaders } from '@/network';
import { logFeedEvent } from '@/network/personalization';

import BroadcastFeedCard, { type BroadcastFeedItem } from './BroadcastFeedCard';
export type { BroadcastFeedItem } from './BroadcastFeedCard';
import BroadcastAuthorProfileSheet from '@/components/broadcast/BroadcastAuthorProfileSheet';
import {
  isUserBroadcastSource,
} from '@/components/broadcast/authorProfileUtils';
import useAuthorProfilePreview from '@/components/broadcast/useAuthorProfilePreview';
import FeedPostActionsSheet, { type FeedPostAction } from '@/components/feeds/FeedPostActionsSheet';
import Skeleton from '@/components/common/Skeleton';
import ShareRenderer, { type SharePayload } from '@/components/feeds/ShareRenderer';
import { uploadFileToBackend } from '@/Module/ChatRoom/uploadFileToBackend';
import MarketStudioSection from './MarketStudioSection';
import { getAccessToken } from '@/security/authStorage';

/* ───────────────────────────────────────────── */
/* Section Layout (Feeds / Market / Lessons)     */
/* ───────────────────────────────────────────── */

type MainSection = 'feed' | 'market' | 'lessons';
export type ForYouTab = 'for_you' | 'following';

type SourceChip =
  | 'all'
  | 'channel'
  | 'community'
  | 'partner'
  | 'market'
  | 'lessons'
  | 'live';

type SortMode = 'latest' | 'trending';

type Props = {
  onSubscribeChannel: (channelId: string) => Promise<void> | void;
  searchTerm?: string;

  // Optional external controls (kept compatible)
  filterSource?: 'all' | 'channel' | 'community' | 'partner';
  mediaFilter?: 'videos' | 'shorts';

  // Optional market
  profile?: any;
  canUseMarket?: boolean;
  onUpgrade?: () => void;
  forYouTabOverride?: ForYouTab;
  onForYouTabChange?: (value: ForYouTab) => void;
  onSubscribeToSource?: (item: BroadcastFeedItem) => Promise<boolean> | void;
};

const SHORT_VIDEO_THRESHOLD_SECONDS = 3 * 60;

const normalizeAttachmentUrl = (attachment: any) => {
  if (!attachment) return null;
  if (typeof attachment === 'string') return resolveBackendAssetUrl(attachment);
  const raw =
    attachment.url ??
    attachment.uri ??
    attachment.file_url ??
    attachment.fileUrl ??
    attachment.path ??
    null;
  return resolveBackendAssetUrl(raw);
};

const resolveVideoAttachment = (item: BroadcastFeedItem) => {
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];
  for (const attachment of attachments) {
    const url = normalizeAttachmentUrl(attachment);
    if (!url) continue;

    const kind = String(
      attachment?.kind ??
        attachment?.mimeType ??
        attachment?.mime ??
        attachment?.type ??
        '',
    ).toLowerCase();

    const isVideo =
      kind.includes('video') ||
      kind === 'short_video' ||
      kind === 'long_video' ||
      kind.includes('mp4');
    if (!isVideo) continue;

    const thumb =
      resolveBackendAssetUrl(
        attachment?.thumbUrl ??
          attachment?.thumb_url ??
          attachment?.thumbnail ??
          attachment?.thumb ??
          attachment?.preview_url ??
          attachment?.previewUrl ??
          null,
      ) ?? null;

    return {
      id: String(attachment?.id ?? `${item.id}-att0`),
      url,
      thumbUrl: thumb,
      attachment,
    };
  }
  return null;
};

const isMarketBroadcast = (item: BroadcastFeedItem) => {
  if (!item) return false;
  const sourceType = String(item.source?.type ?? '').toLowerCase();
  const emittedType = String(item.source_type ?? '').toLowerCase();
  if (sourceType.includes('market') || emittedType.includes('market')) {
    return true;
  }
  if (Boolean(item.product)) {
    return true;
  }
  return false;
};

const extractDurationSeconds = (attachment: any) => {
  if (!attachment) return undefined;
  if (typeof attachment.duration_seconds === 'number') return attachment.duration_seconds;
  if (typeof attachment.duration === 'number') return attachment.duration;
  if (typeof attachment.durationSeconds === 'number') return attachment.durationSeconds;
  if (typeof attachment.duration_ms === 'number') return Math.round(attachment.duration_ms / 1000);
  if (typeof attachment.durationMs === 'number') return Math.round(attachment.durationMs / 1000);
  if (typeof attachment.durationMilliseconds === 'number')
    return Math.round(attachment.durationMilliseconds / 1000);
  return undefined;
};

const deriveVideoCategory = (attachment: any, durationSeconds?: number) => {
  if (!attachment) return undefined;
  const normalized = (attachment.kind ?? attachment.mimeType ?? attachment.type ?? '')
    .toString()
    .toLowerCase();

  if (normalized.includes('short')) return 'shorts';
  if (durationSeconds !== undefined) {
    return durationSeconds < SHORT_VIDEO_THRESHOLD_SECONDS ? 'shorts' : 'videos';
  }
  if (normalized.includes('video')) return 'videos';
  return undefined;
};

const enrichWithVideoMetadata = (item: BroadcastFeedItem) => {
  const videoAttachment = resolveVideoAttachment(item);
  if (!videoAttachment) return item;
  const durationSeconds = extractDurationSeconds(videoAttachment.attachment);
  const videoCategory =
    deriveVideoCategory(videoAttachment.attachment, durationSeconds) ??
    item.video_category;

  return {
    ...item,
    video_category: videoCategory,
    video_duration_seconds: durationSeconds ?? item.video_duration_seconds,
  };
};

const hasVideoAttachment = (item: BroadcastFeedItem) =>
  Boolean(resolveVideoAttachment(item));

/* ───────────────────────────────────────────── */
/* Component                                     */
/* ───────────────────────────────────────────── */

export default function BroadcastFeedSection({
  onSubscribeChannel,
  searchTerm = '',
  filterSource = 'all',
  mediaFilter,
  profile,
  canUseMarket = false,
  onUpgrade,
  forYouTabOverride,
  onForYouTabChange,
  onSubscribeToSource,
}: Props) {
  const { palette } = useKISTheme();
  const navigation = useNavigation();
  const mediaHeaders = useMediaHeaders();
  const {
    visible: authorProfileVisible,
    loading: authorProfileLoading,
    error: authorProfileError,
    profile: authorProfile,
    openAuthorProfile,
    closeAuthorProfile,
  } = useAuthorProfilePreview();

  /* ─────────────────────────
   * Main section & UX prefs
   * ───────────────────────── */

  const [mainSection, setMainSection] = useState<MainSection>('feed'); // feed | market | lessons
  const [forYouTab, setForYouTab] = useState<ForYouTab>('for_you'); // for_you | following
  const [sourceChip, setSourceChip] = useState<SourceChip>('all'); // all/channel/community/partner/market/lessons/live
  const [sortMode, setSortMode] = useState<SortMode>('latest'); // latest/trending
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [compactMode, setCompactMode] = useState(false); // future: compact cards
  const [safeMode, setSafeMode] = useState(false); // future: content gating
  const activeForYouTab = forYouTabOverride ?? forYouTab;

  const updateForYouTab = useCallback(
    (next: ForYouTab) => {
      setForYouTab(next);
      onForYouTabChange?.(next);
    },
    [onForYouTabChange],
  );

  const PREF_KEY = 'kis.broadcast.ui.prefs.v1';
  const loadPrefs = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PREF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.mainSection) setMainSection(parsed.mainSection);
      if (parsed?.forYouTab) updateForYouTab(parsed.forYouTab);
      if (parsed?.sourceChip) setSourceChip(parsed.sourceChip);
      if (parsed?.sortMode) setSortMode(parsed.sortMode);
      if (typeof parsed?.autoplayEnabled === 'boolean') setAutoplayEnabled(parsed.autoplayEnabled);
      if (typeof parsed?.compactMode === 'boolean') setCompactMode(parsed.compactMode);
      if (typeof parsed?.safeMode === 'boolean') setSafeMode(parsed.safeMode);
    } catch {
      // ignore
    }
  }, [updateForYouTab]);

  const persistPrefs = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        PREF_KEY,
        JSON.stringify({
          mainSection,
          forYouTab: activeForYouTab,
          sourceChip,
          sortMode,
          autoplayEnabled,
          compactMode,
          safeMode,
        }),
      );
    } catch {
      // ignore
    }
  }, [activeForYouTab, mainSection, sourceChip, sortMode, autoplayEnabled, compactMode, safeMode]);

  useEffect(() => {
    loadPrefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persistPrefs();
  }, [persistPrefs]);

  useEffect(() => {
    if (!forYouTabOverride) return;
    if (forYouTabOverride === forYouTab) return;
    setForYouTab(forYouTabOverride);
  }, [forYouTabOverride, forYouTab]);

  /* ─────────────────────────
   * Data state
   * ───────────────────────── */

  const [broadcasts, setBroadcasts] = useState<BroadcastFeedItem[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [broadcastConversationIds, setBroadcastConversationIds] = useState<Record<string, string | null>>({});
  const broadcastConversationIdsRef = useRef<Record<string, string | null>>({});
  const [activeBroadcastCommentId, setActiveBroadcastCommentId] = useState<string | null>(null);

  const handleCommentCountChange = useCallback((itemId: string, count: number) => {
    setCommentCounts((prev) => ({ ...prev, [itemId]: count }));
  }, []);

  useEffect(() => {
    broadcastConversationIdsRef.current = broadcastConversationIds;
  }, [broadcastConversationIds]);

  useEffect(() => {
    setBroadcastConversationIds((prev) => {
      let changed = false;
      const next = { ...prev };
      broadcasts.forEach((broadcast) => {
        if (next[broadcast.id] === undefined && broadcast.comment_conversation_id != null) {
          next[broadcast.id] = broadcast.comment_conversation_id;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [broadcasts]);

  const setBroadcastConversationId = useCallback((itemId: string, value: string | null) => {
    setBroadcastConversationIds((prev) => {
      if (prev[itemId] === value) return prev;
      return { ...prev, [itemId]: value };
    });
  }, []);

  const fetchBroadcastConversationId = useCallback(
    async (itemId: string) => {
      const cached = broadcastConversationIdsRef.current[itemId];
      if (cached?.startsWith?.('broadcast:')) {
        console.log('[BroadcastFeedSection] reusing broadcast conversation', { itemId, cached });
        return cached;
      }
      try {
        const url = ROUTES.broadcasts.commentRoom(itemId);
        console.log('[BroadcastFeedSection] requesting broadcast conversation', {
          itemId,
          cached,
          url,
        });
        const res = await postRequest(url, {}, { errorMessage: 'Unable to load comments.' });
        const resolved =
          res?.data?.conversation_id ?? res?.data?.conversationId ?? res?.data?.id ?? null;
        console.log('[BroadcastFeedSection] received conversation id', { itemId, resolved });
        setBroadcastConversationId(itemId, resolved);
        return resolved;
      } catch (err) {
        console.warn('[BroadcastFeedSection] fetchConversation failed', err);
        setBroadcastConversationId(itemId, null);
        return null;
      }
    },
    [setBroadcastConversationId],
  );

  const toggleBroadcastComments = useCallback((itemId: string) => {
    setActiveBroadcastCommentId((prev) => (prev === itemId ? null : itemId));
  }, []);

  // Share
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const shareShotRef = useRef<ViewShot>(null);

  // Saved broadcasts (local) — can later sync server-side
  const SAVED_KEY = 'kis.broadcast.saved.v1';
  const [_savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const loadSaved = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      if (!raw) return;
      setSavedIds(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);
  const persistSaved = useCallback(async (next: Record<string, boolean>) => {
    try {
      await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const toggleSaved = useCallback(
    async (item: BroadcastFeedItem) => {
      setSavedIds((prev) => {
        const next = { ...prev, [item.id]: !prev[item.id] };
        persistSaved(next);
        return next;
      });
      // optional server hook: ROUTES.broadcasts.save(item.id)
    },
    [persistSaved],
  );

  /* ─────────────────────────
   * Attachment helpers
   * ───────────────────────── */

  /* ─────────────────────────
   * Stream URL resolution
   * ───────────────────────── */

  const [pendingVideoItem, setPendingVideoItem] = useState<BroadcastFeedItem | null>(null);
  const [resolvedMediaUrls, setResolvedMediaUrls] = useState<Record<string, string>>({});

  const resolveDirectMediaUrl = useCallback(
    async (attachmentBundle: { id: string; url: string }) => {
      if (!attachmentBundle?.url) return null;
      if (!attachmentBundle.url.includes('/stream/')) return attachmentBundle.url;

      const cacheHit = resolvedMediaUrls[attachmentBundle.id];
      if (cacheHit) return cacheHit;

      try {
        const response = await fetch(attachmentBundle.url, {
          method: 'HEAD',
          headers: mediaHeaders,
        });
        const direct = response.headers.get('X-Video-URL');
        if (direct) {
          setResolvedMediaUrls((prev) => ({ ...prev, [attachmentBundle.id]: direct }));
          return direct;
        }
      } catch (error) {
        console.warn('[BroadcastFeedSection] stream HEAD failed', error);
      }

      return attachmentBundle.url;
    },
    [mediaHeaders, resolvedMediaUrls],
  );

  /* ─────────────────────────
   * Load broadcasts
   * ───────────────────────── */

  const loadBroadcasts = useCallback(async () => {
    setLoadingBroadcasts(true);
    const res = await getRequest(ROUTES.broadcasts.list, {
      errorMessage: 'Unable to load broadcasts.',
    });

    if (res?.success) {
      const payload = res.data?.results ?? res.data ?? [];
      const list: BroadcastFeedItem[] = Array.isArray(payload) ? payload : [];
      const enriched = list.map(enrichWithVideoMetadata);
      setBroadcasts(enriched);
      void logFeedEvent({
        feedType: 'broadcast',
        event: 'impression',
        metadata: {
          mainSection,
          filterSource,
          sourceChip,
          sortMode,
          count: enriched.length,
        },
      });
    }

    setLoadingBroadcasts(false);
  }, [filterSource, mainSection, sourceChip, sortMode]);

  useEffect(() => {
    loadBroadcasts();
  }, [loadBroadcasts]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('broadcast.refresh', () => {
      loadBroadcasts();
    });
    return () => sub.remove();
  }, [loadBroadcasts]);

  /* ─────────────────────────
   * Discovery & filtering
   * ───────────────────────── */

  const normalizedSearch = (searchTerm || '').trim().toLowerCase();

  const computedFiltered = useMemo(() => {
    let items = [...broadcasts];

    // External legacy filter (kept compatible)
    if (filterSource && filterSource !== 'all') {
      items = items.filter((it) => it.source?.type?.toLowerCase() === filterSource);
    }

    // Main section gating
    if (mainSection === 'lessons') {
      items = items.filter((it) => Boolean(it.is_lesson) || it.source?.type === 'lesson' || it.video_category === 'lessons');
    } else if (mainSection === 'market') {
      items = items.filter((it) => Boolean(it.product) || it.source?.type === 'market' || it.source_type === 'market');
    } else {
      // feed: filter out market posts
      items = items.filter((it) => !isMarketBroadcast(it));
    }

    // For You / Following (stub until server provides following)
    if (activeForYouTab === 'following') {
      // Heuristic: show only items from sources the user is subscribed to
      items = items.filter((it) => Boolean(it.source?.is_subscribed) || Boolean(it.source?.is_member));
    }

    // Source chips (design-level filter)
    if (sourceChip !== 'all') {
      if (sourceChip === 'live') items = items.filter((it) => Boolean(it.is_live) || it.source?.type === 'live');
      if (sourceChip === 'lessons') items = items.filter((it) => Boolean(it.is_lesson) || it.source?.type === 'lesson');
      if (sourceChip === 'market') items = items.filter((it) => Boolean(it.product) || it.source?.type === 'market');
      if (sourceChip === 'channel') items = items.filter((it) => it.source?.type === 'channel');
      if (sourceChip === 'community') items = items.filter((it) => it.source?.type === 'community');
      if (sourceChip === 'partner') items = items.filter((it) => it.source?.type === 'partner');
    }

    // Media filter
    if (mediaFilter) {
      if (mediaFilter === 'videos') items = items.filter((it) => it.video_category === 'videos');
      if (mediaFilter === 'shorts') items = items.filter((it) => it.video_category === 'shorts');
    }

    // Search
    if (normalizedSearch) {
      items = items.filter((it) => {
        const hay = `${it.title || ''} ${it.text || ''} ${it.text_plain || ''} ${it.source?.name || ''}`.toLowerCase();
        return hay.includes(normalizedSearch);
      });
    }

    // Safe mode (stub)
    if (safeMode) {
      items = items.filter((it) => !it.is_premium);
    }

    // Sorting
    if (sortMode === 'trending') {
      items.sort((a, b) => {
        const aScore = (a.reaction_count ?? 0) + (a.comment_count ?? 0) + (a.share_count ?? 0);
        const bScore = (b.reaction_count ?? 0) + (b.comment_count ?? 0) + (b.share_count ?? 0);
        return bScore - aScore;
      });
    }

    return items;
  }, [activeForYouTab, broadcasts, filterSource, normalizedSearch, mediaFilter, mainSection, sourceChip, sortMode, safeMode]);

  const videoItems = useMemo(
    () => computedFiltered.filter(hasVideoAttachment),
    [computedFiltered],
  );

  /* ─────────────────────────
   * Video modal (shorts-like)
   * ───────────────────────── */

  const videoPlayerRef = useRef<any>(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoQueue, setVideoQueue] = useState<BroadcastFeedItem[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  const actuallyOpenVideoModal = useCallback(
    (item: BroadcastFeedItem) => {
      const index = videoItems.findIndex((entry) => entry.id === item.id);
      if (index === -1) return;
      setVideoQueue(videoItems);
      setCurrentVideoIndex(index);
      setIsVideoPlaying(false);
      setVideoModalVisible(true);
    },
    [videoItems],
  );

  const tryResolveStreamUrl = useCallback(
    async (bundle: { id: string; url: string }) => {
      await resolveDirectMediaUrl(bundle);
    },
    [resolveDirectMediaUrl],
  );

  const openVideoModal = (item: BroadcastFeedItem) => {
    const v = resolveVideoAttachment(item);
    if (!v) return;

    void logFeedEvent({ feedType: 'broadcast', event: 'video_open', targetId: item.id });

    const prepareAndOpen = async () => {
      if (v.url?.includes('/stream/')) {
        await tryResolveStreamUrl({ id: v.id, url: v.url });
      }
      actuallyOpenVideoModal(item);
    };

    if (!mediaHeaders.Authorization) {
      setPendingVideoItem(item);
      return;
    }

    prepareAndOpen();
  };

  useEffect(() => {
    if (!pendingVideoItem || !mediaHeaders.Authorization) return;
    const v = resolveVideoAttachment(pendingVideoItem);
    if (!v) return;

    const prepareAndOpen = async () => {
      if (v.url?.includes('/stream/')) {
        await tryResolveStreamUrl({ id: v.id, url: v.url });
      }
      actuallyOpenVideoModal(pendingVideoItem);
      setPendingVideoItem(null);
    };

    prepareAndOpen();
  }, [pendingVideoItem, mediaHeaders.Authorization, actuallyOpenVideoModal, tryResolveStreamUrl]);

  const closeVideoModal = useCallback(() => {
    setIsVideoPlaying(false);
    videoPlayerRef.current?.seek?.(0);
    translateY.setValue(0);
    setVideoModalVisible(false);
    setVideoQueue([]);
    setCurrentVideoIndex(0);
  }, [translateY]);

  const goToNextVideo = useCallback(() => {
    if (currentVideoIndex < videoQueue.length - 1) {
      setCurrentVideoIndex((prev) => prev + 1);
      setIsVideoPlaying(true);
      return true;
    }
    closeVideoModal();
    return false;
  }, [currentVideoIndex, videoQueue, closeVideoModal]);

  const goToPreviousVideo = useCallback(() => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex((prev) => prev - 1);
      setIsVideoPlaying(true);
      return true;
    }
    return false;
  }, [currentVideoIndex]);

  const handleVideoEnd = () => {
    if (!autoplayEnabled) {
      setIsVideoPlaying(false);
      return;
    }
    goToNextVideo();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dy) > 20 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_evt, gesture) => translateY.setValue(gesture.dy),
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy < -90) {
            Animated.timing(translateY, {
              toValue: -450,
              duration: 220,
              useNativeDriver: true,
            }).start(() => {
              translateY.setValue(0);
              goToNextVideo();
            });
            return;
          }
          if (gesture.dy > 90) {
            Animated.timing(translateY, {
              toValue: 450,
              duration: 220,
              useNativeDriver: true,
            }).start(() => {
              translateY.setValue(0);
              goToPreviousVideo();
            });
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            tension: 70,
            friction: 9,
            useNativeDriver: true,
          }).start();
        },
      }),
    [goToNextVideo, goToPreviousVideo, translateY],
  );

  const currentVideoItem = videoQueue[currentVideoIndex];
  const currentVideoBundle = currentVideoItem ? resolveVideoAttachment(currentVideoItem) : null;

  const resolvedCurrentVideoUrl =
    currentVideoBundle?.id && resolvedMediaUrls[currentVideoBundle.id]
      ? resolvedMediaUrls[currentVideoBundle.id]
      : currentVideoBundle?.url;

  const currentVideoSource =
    resolvedCurrentVideoUrl
      ? buildMediaSource(
          resolvedCurrentVideoUrl,
          resolvedCurrentVideoUrl?.includes('/media/') ? undefined : mediaHeaders,
        )
      : undefined;

  /* ─────────────────────────
   * Share flow
   * ───────────────────────── */

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
      file: { uri, name: `kis-share-${Date.now()}.png`, type: 'image/png' },
      authToken: token,
    });

    return attachment?.url ?? null;
  };

  const handleShare = async (item: BroadcastFeedItem) => {
    const text = item.text_plain ?? item.text ?? item.styled_text?.text ?? item.product?.name ?? '';
    const attachment = Array.isArray(item.attachments) ? item.attachments[0] : null;
    const attachmentUrl = attachment?.url ?? attachment?.uri ?? null;
    const kind = attachment?.kind ?? attachment?.mimeType ?? '';
    const isImage = String(kind).includes('image');

    const watermarkColor = '#22C55E';
    const subtitle = item.source?.name ?? item.title ?? 'Broadcast';

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
          await postRequest(
            ROUTES.broadcasts.share(item.id),
            { platform: 'app' },
            { errorMessage: 'Unable to log share.' },
          );
          await Share.share({ message: url, url });
          return;
        }
      }
    }

    const imageUri = await captureShareImage({
      mode: 'text',
      text: text || 'Shared from KIS',
      watermarkColor,
      subtitle,
    });

    if (imageUri) {
      const url = await uploadShareAsset(imageUri);
      if (url) {
        await postRequest(
          ROUTES.broadcasts.share(item.id),
          { platform: 'app' },
          { errorMessage: 'Unable to log share.' },
        );
        await Share.share({ message: url, url });
      }
    }
  };

  const copyBroadcastLink = (item: BroadcastFeedItem) => {
    const fallback = `https://kis.app/broadcasts/${item.id}`;
    const permalink = (item as any).permalink ?? (item as any).link ?? (item as any).url ?? fallback;
    Clipboard.setString(permalink);
    Alert.alert('Link copied', 'Broadcast link saved to clipboard.');
  };

  /* ─────────────────────────
   * Moderation / actions
   * ───────────────────────── */

  const handleReport = async (item: BroadcastFeedItem) => {
    const res = await postRequest(
      ROUTES.moderation.flags,
      {
        source: 'USER',
        target_type: 'POST',
        target_id: item.id,
        reason: 'Inappropriate broadcast content',
        severity: 'MEDIUM',
      },
      { errorMessage: 'Unable to report broadcast.' },
    );
    if (res?.success) {
      Alert.alert('Report submitted', 'We will review this broadcast.');
      return true;
    }
    Alert.alert('Report failed', res?.message || 'Try again later.');
    return false;
  };

  const handleMute = async (item: BroadcastFeedItem) => {
    const targetId = item.author?.id;
    if (!targetId) {
      Alert.alert('Mute', 'Unable to find broadcaster.');
      return false;
    }
    const res = await postRequest(
      ROUTES.moderation.userBlocks,
      { blocked: targetId },
      { errorMessage: 'Unable to mute broadcaster.' },
    );
    if (res?.success) {
      Alert.alert('Muted', 'You will no longer see broadcasts from this broadcaster.');
      loadBroadcasts();
      return true;
    }
    Alert.alert('Mute failed', res?.message || 'Try again later.');
    return false;
  };

  const handleHideBroadcast = async (item: BroadcastFeedItem) => {
    const res = await postRequest(
      ROUTES.broadcasts.hide(item.id),
      {},
      { errorMessage: 'Unable to hide broadcast.' },
    );
    if (res?.success) {
      Alert.alert('Hidden', 'This broadcast will be hidden from your feed.');
      loadBroadcasts();
      return true;
    }
    Alert.alert('Hide failed', res?.message || 'Try again later.');
    return false;
  };

  const handleLike = async (item: BroadcastFeedItem) => {
    const res = await postRequest(
      ROUTES.broadcasts.react(item.id),
      { emoji: '❤️' },
      { errorMessage: 'Unable to react.' },
    );
    if (!res?.success) return;

    const nextCount = res.data?.count ?? (res as any)?.count ?? item.reaction_count ?? 0;
    const reacted = res.data?.reacted ?? (res as any)?.reacted;

    setBroadcasts((prev) =>
      prev.map((b) =>
        b.id === item.id
          ? { ...b, reaction_count: nextCount, viewer_reaction: reacted ? '❤️' : null }
          : b,
      ),
    );
  };

  const handleJoinLesson = async (_item: BroadcastFeedItem) => {
    Alert.alert('Lesson', 'Joining lesson… (hook ready)');
  };

  /* ─────────────────────────
   * Subscribe/open source
   * ───────────────────────── */

  const handleJoinCommunity = async (item: BroadcastFeedItem) => {
    const communityId = item.source?.id;
    if (!communityId) return false;
    const joinPolicy = item.source?.join_policy ?? 'request';
    const url =
      joinPolicy === 'open'
        ? ROUTES.community.join(String(communityId))
        : ROUTES.community.requestJoin(String(communityId));
    const res = await postRequest(url, {}, { errorMessage: 'Unable to join community.' });
    if (res?.success) {
      loadBroadcasts();
      return true;
    }
    return false;
  };

  const handleJoinPartner = async (item: BroadcastFeedItem) => {
    const partnerId = item.source?.id;
    if (!partnerId) return false;
    const allowSubscribe = item.source?.allow_subscribe;
    const allowApply = item.source?.allow_apply;
    const url =
      allowSubscribe && !allowApply
        ? ROUTES.partners.subscribe(String(partnerId))
        : ROUTES.partners.apply(String(partnerId));
    const res = await postRequest(url, {}, { errorMessage: 'Unable to join partner.' });
    if (res?.success) {
      loadBroadcasts();
      return true;
    }
    return false;
  };

  const handleOpenSource = (item: BroadcastFeedItem) => {
    const source = item.source;
    if (!source) return;

    if (source.type === 'channel' && source.conversation_id) {
      DeviceEventEmitter.emit('chat.open', {
        conversationId: source.conversation_id,
        name: source.name ?? 'Channel',
        kind: 'channel',
      });
      navigation.navigate('Messages' as never);
      return;
    }

    if (source.type === 'community' && source.id) {
      DeviceEventEmitter.emit('chat.open', {
        id: String(source.id),
        name: source.name ?? 'Community',
        kind: 'community',
      });
      navigation.navigate('Messages' as never);
      return;
    }

    if (source.type === 'partner' && source.id) {
      DeviceEventEmitter.emit('partner.open', {
        partnerId: String(source.id),
        feed: 'general',
      });
      navigation.navigate('Partners' as never);
    }
  };

  const handleSubscribeToBroadcaster = async (item: BroadcastFeedItem) => {
    const source = item.source;
    if (!source) {
      Alert.alert('Subscribe', 'Unable to identify broadcaster.');
      return false;
    }

    if (onSubscribeToSource) {
      const success = await onSubscribeToSource(item);
      if (success) {
        loadBroadcasts();
      }
      return Boolean(success);
    }

    if (source.type === 'channel' && source.id) {
      await onSubscribeChannel(String(source.id));
      loadBroadcasts();
      return true;
    }

    if (source.type === 'community') return handleJoinCommunity(item);
    if (source.type === 'partner') return handleJoinPartner(item);

    Alert.alert('Subscribe', 'This broadcaster cannot be subscribed to yet.');
    return false;
  };

  /* ─────────────────────────
   * Action menu
   * ───────────────────────── */

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuItem, setMenuItem] = useState<BroadcastFeedItem | null>(null);

  const openActionMenu = (item: BroadcastFeedItem) => {
    setMenuItem(item);
    setMenuVisible(true);
  };

  const closeActionMenu = () => {
    setMenuVisible(false);
    setMenuItem(null);
  };

  /* ─────────────────────────
   * Render
   * ───────────────────────── */

  const renderFeedBody = () => (
    <View style={{ paddingHorizontal: 12, paddingBottom: 90, gap: 12 }}>
      {loadingBroadcasts ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <Skeleton height={140} radius={16} />
          <Skeleton height={140} radius={16} />
        </View>
      ) : broadcasts.length === 0 ? (
        <Text style={{ color: palette.subtext }}>No broadcasts yet.</Text>
      ) : computedFiltered.length === 0 ? (
        <Text style={{ color: palette.subtext }}>No broadcasts match this filter.</Text>
      ) : (
        computedFiltered.map((item) => (
          <BroadcastFeedCard
            key={item.id}
            item={{
              ...item,
              comment_count: commentCounts[item.id] ?? item.comment_count ?? 0,
            }}
            onLike={() => handleLike(item)}
            onShare={() => handleShare(item)}
            onOpenSource={() => handleOpenSource(item)}
            onMenuPress={() => openActionMenu(item)}
            onVideoPress={() => hasVideoAttachment(item) && openVideoModal(item)}
            onOpenMarket={() => Alert.alert('Market', 'Opening storefront… (wired next)')}
            onSave={() => toggleSaved(item)}
            onJoinLesson={() => handleJoinLesson(item)}
            commentConversationId={broadcastConversationIds[item.id] ?? null}
            fetchConversationId={() => fetchBroadcastConversationId(item.id)}
            onConversationResolved={(id) => setBroadcastConversationId(item.id, id)}
            onMessageCountChange={(count) => handleCommentCountChange(item.id, count)}
            contextLabel={item.source?.name ?? item.title ?? 'Broadcast'}
            showComments={activeBroadcastCommentId === item.id}
            onToggleComments={() => toggleBroadcastComments(item.id)}
            onSubscribe={() => handleSubscribeToBroadcaster(item)}
            onOpenAuthorProfile={
              isUserBroadcastSource(item)
                ? () => {
                    void openAuthorProfile(item);
                  }
                : undefined
            }
          />
        ))
      )}
    </View>
  );

  const renderMarketBody = () => (
    <View style={{ paddingHorizontal: 12, paddingBottom: 90 }}>
      <MarketStudioSection
        profile={profile}
        canUseMarket={canUseMarket}
        onUpgrade={onUpgrade}
      />
    </View>
  );

  const renderLessonsBody = () => (
    <View style={{ paddingHorizontal: 12, paddingBottom: 90, gap: 12 }}>
      <View style={[styles.lessonHero, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>
          Lessons
        </Text>
        <Text style={{ color: palette.subtext, marginTop: 4 }}>
          Live classrooms, replays, and guided learning — all inside broadcasts.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => setSourceChip('lessons')}
            style={[styles.heroBtn, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Explore lessons</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Create lesson', 'Lesson studio coming next.')}
            style={[styles.heroBtn, { backgroundColor: palette.surface, borderColor: palette.divider }]}
          >
            <Text style={{ color: palette.text, fontWeight: '900' }}>Create lesson</Text>
          </Pressable>
        </View>
      </View>

      {renderFeedBody()}
    </View>
  );

  const broadcastMenuActions: FeedPostAction[] = menuItem
    ? (() => {
        const actions: FeedPostAction[] = [
          {
            key: 'share',
            label: 'Share broadcast',
            onPress: () => handleShare(menuItem),
          },
          {
            key: 'copy-link',
            label: 'Copy link',
            onPress: () => copyBroadcastLink(menuItem),
          },
          {
            key: 'report',
            label: 'Report broadcast',
            onPress: () => handleReport(menuItem),
          },
          {
            key: 'mute',
            label: 'Mute broadcaster',
            onPress: () => handleMute(menuItem),
          },
          {
            key: 'hide',
            label: 'Hide broadcast',
            onPress: () => handleHideBroadcast(menuItem),
            destructive: true,
          },
        ];

        const sourceType = menuItem.source?.type;
        const sourceId = menuItem.source?.id;
        if (sourceType === 'channel' && sourceId) {
          actions.push({
            key: 'subscribe',
            label: 'Subscribe to channel',
            onPress: () => handleSubscribeToBroadcaster(menuItem),
          });
        } else if (sourceType === 'community') {
          actions.push({
            key: 'join-community',
            label: 'Join community',
            onPress: () => handleJoinCommunity(menuItem),
          });
        } else if (sourceType === 'partner') {
          actions.push({
            key: 'join-partner',
            label: 'Join partner',
            onPress: () => handleJoinPartner(menuItem),
          });
        }

        if (menuItem.source?.can_open) {
          actions.push({
            key: 'open-source',
            label: 'Open source',
            onPress: () => handleOpenSource(menuItem),
          });
        }

        actions.push(
          {
            key: 'follow',
            label: 'Follow broadcaster',
            onPress: () => Alert.alert('Follow', 'Follow system is ready (hook next).'),
          },
          {
            key: 'pin',
            label: 'Pin broadcast',
            onPress: () => Alert.alert('Pinned', 'Pinned locally (feature hook ready).'),
          },
          {
            key: 'schedule',
            label: 'Schedule reminder',
            onPress: () => Alert.alert('Scheduled', 'Reminder scheduling hook ready.'),
          },
          {
            key: 'analytics',
            label: 'View insights',
            onPress: () => Alert.alert('Insights', 'Analytics screen hook ready.'),
          },
        );

        return actions;
      })()
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Body */}
      {mainSection === 'feed' && renderFeedBody()}
      {mainSection === 'market' && renderMarketBody()}
      {mainSection === 'lessons' && renderLessonsBody()}

      <ShareRenderer ref={shareShotRef} payload={sharePayload} />

      <FeedPostActionsSheet
        visible={menuVisible}
        onClose={closeActionMenu}
        actions={broadcastMenuActions}
      />

      {/* Video Modal */}
      <Modal
        visible={videoModalVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        supportedOrientations={['portrait', 'landscape']}
        statusBarTranslucent
        onRequestClose={closeVideoModal}
      >
        <View style={styles.videoModal}>
          {currentVideoBundle ? (
            <>
              <Animated.View
                style={[styles.videoContainer, { transform: [{ translateY }] }]}
                {...panResponder.panHandlers}
              >
                <Pressable
                  onPress={closeVideoModal}
                  style={styles.videoCloseButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <KISIcon name="close" size={24} color="#fff" />
                </Pressable>

                <Video
                  ref={videoPlayerRef}
                  key={videoQueue[currentVideoIndex]?.id}
                  source={currentVideoSource ?? { uri: currentVideoBundle?.url ?? '' }}
                  style={styles.videoPlayer}
                  paused={!isVideoPlaying}
                  controls={false}
                  resizeMode="contain"
                  poster={currentVideoBundle?.thumbUrl ?? currentVideoBundle?.url ?? undefined}
                  posterResizeMode="cover"
                  onEnd={handleVideoEnd}
                  onError={(error) => {
                    console.warn('Video playback error', error);
                    Alert.alert('Playback error', 'Unable to play this broadcast.');
                  }}
                />

                {!isVideoPlaying && (
                  <Pressable style={styles.modalPlayOverlay} onPress={() => setIsVideoPlaying(true)}>
                    <KISIcon name="play" size={34} color="#fff" />
                    <Text style={styles.modalPlayLabel}>Play</Text>
                  </Pressable>
                )}
              </Animated.View>

              {currentVideoItem && (
                <View style={styles.videoFloatingActions}>
                  <Pressable
                    onPress={() => handleShare(currentVideoItem)}
                    style={styles.videoFloatingActionButton}
                  >
                    <KISIcon name="share" size={20} color="#fff" />
                    <Text style={styles.actionCountText}>{currentVideoItem.share_count ?? 0}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleLike(currentVideoItem)}
                    style={styles.videoFloatingActionButton}
                  >
                    <KISIcon
                      name="heart"
                      size={20}
                      color={currentVideoItem.viewer_reaction ? '#F97316' : '#fff'}
                    />
                    <Text style={[styles.actionCountText, currentVideoItem.viewer_reaction ? { color: '#F97316' } : null]}>
                      {currentVideoItem.reaction_count ?? 0}
                    </Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.videoControls}>
                <Pressable onPress={() => setAutoplayEnabled((p) => !p)} style={styles.videoControlButton}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    Autoplay {autoplayEnabled ? 'On' : 'Off'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setIsVideoPlaying((p) => !p)} style={styles.videoControlButton}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {isVideoPlaying ? 'Pause' : 'Play'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <ActivityIndicator size="large" color={palette.primary} />
          )}
        </View>
      </Modal>

      <BroadcastAuthorProfileSheet
        visible={authorProfileVisible}
        loading={authorProfileLoading}
        error={authorProfileError}
        profile={authorProfile}
        onClose={closeAuthorProfile}
      />
    </View>
  );
}

/* ───────────────────────────────────────────── */
/* Styles                                        */
/* ───────────────────────────────────────────── */

const styles = StyleSheet.create({
  headerWrap: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerTopRow: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mainTabsRow: {
    marginTop: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 10,
  },
  mainTab: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  segmentRow: {
    marginTop: 12,
    marginHorizontal: 12,
    borderWidth: 2,
    borderRadius: 18,
    padding: 6,
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chipsRow: {
    marginTop: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 2,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  lessonHero: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  heroBtn: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  fab: {
    position: 'absolute',
    right: 14,
    bottom: 20,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  videoModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  videoPlayer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
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
    fontWeight: '700',
  },
  videoControls: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  videoControlButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  videoFloatingActions: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    flexDirection: 'column-reverse',
    alignItems: 'center',
  },
  videoFloatingActionButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionCountText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  videoCloseButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
