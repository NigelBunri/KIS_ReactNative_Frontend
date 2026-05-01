import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Image,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { resolveBackendAssetUrl } from '@/network';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import BroadcastFeedVideoPreview from '@/components/broadcast/BroadcastFeedVideoPreview';
import { isVideoAttachment } from '@/components/broadcast/attachmentPreview';
import RichTextRenderer from '@/components/feeds/RichTextRenderer';
import {
  getFeedPlainText,
  getFeedRichTextValue,
} from '@/components/feeds/richTextValue';
import { wasNativeShareCompleted } from '@/utils/shareCompletion';

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

const shuffleFeeds = <T,>(items: T[], avoidFirstId?: string | null): T[] => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  if (
    avoidFirstId &&
    shuffled.length > 1 &&
    (shuffled[0] as any)?.id === avoidFirstId
  ) {
    const swapIndex = shuffled.findIndex(
      item => (item as any)?.id !== avoidFirstId,
    );
    if (swapIndex > 0) {
      [shuffled[0], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[0]];
    }
  }
  return shuffled;
};

const getFeedTitle = (item: any) =>
  item?.title ?? item?.source?.name ?? 'Broadcast';

const getFeedSource = (item: any) =>
  item?.source?.name ??
  item?.author?.display_name ??
  item?.author?.name ??
  'Broadcast';

const getFeedBody = (item: any) => getFeedPlainText(item) || item?.body || '';

const getFirstFeedImageUrl = (item: any) => {
  const attachments = Array.isArray(item?.attachments)
    ? item.attachments.filter(Boolean)
    : [];
  return attachments
    .map((attachment: any) => pickAttachmentUrl(attachment))
    .filter(Boolean)
    .map((url: string) => resolveBackendAssetUrl(url))
    .filter(Boolean)[0];
};

export default function BroadcastDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'BroadcastDetail'>>();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, 'BroadcastDetail'>
    >();
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const swipeY = React.useRef(new Animated.Value(0)).current;

  const initialItem = route.params?.item ?? null;
  const routeItems = useMemo(
    () =>
      Array.isArray(route.params?.items) && route.params.items.length
        ? route.params.items
        : initialItem
        ? [initialItem]
        : [],
    [initialItem, route.params?.items],
  );
  const [feedItems, setFeedItems] = useState<any[]>(routeItems);
  const [activeFeedIndex, setActiveFeedIndex] = useState(() => {
    const paramIndex = Number(route.params?.index ?? 0);
    return Number.isFinite(paramIndex) && paramIndex >= 0 ? paramIndex : 0;
  });
  const [broadcastItem, setBroadcastItem] = useState<any | null>(initialItem);
  const [refreshingTop, setRefreshingTop] = useState(false);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialItem
      ? null
      : 'Broadcast details are only available when navigating from the feed list.',
  );
  const broadcastId = broadcastItem?.id ?? route.params?.id;
  const reactionCount = Number(
    broadcastItem?.reaction_count ?? broadcastItem?.engagement?.reactions ?? 0,
  );
  const commentCount = Number(
    broadcastItem?.comment_count ?? broadcastItem?.engagement?.comments ?? 0,
  );
  const viewerReaction = broadcastItem?.viewer_reaction ?? null;
  const viewerSaved = Boolean(broadcastItem?.viewer_saved);
  const shareCount = Number(broadcastItem?.share_count ?? 0);
  const title =
    broadcastItem?.title ?? broadcastItem?.source?.name ?? 'Broadcast';
  const sourceName =
    broadcastItem?.source?.name ??
    broadcastItem?.author?.display_name ??
    broadcastItem?.author?.name ??
    'Broadcast';
  const body = getFeedPlainText(broadcastItem) || broadcastItem?.body || '';
  const richTextValue = getFeedRichTextValue(broadcastItem);
  useEffect(() => {
    setFeedItems(routeItems);
  }, [routeItems]);

  const matchedFeedIndex = feedItems.findIndex(
    item => item?.id === broadcastItem?.id,
  );
  const currentFeedIndex =
    matchedFeedIndex >= 0 ? matchedFeedIndex : activeFeedIndex;
  const previousFeedIndex = currentFeedIndex - 1;
  const nextFeedIndex = currentFeedIndex + 1;
  const previousFeedItem = feedItems[previousFeedIndex] ?? null;
  const nextFeedItem = feedItems[nextFeedIndex] ?? null;

  const openFeedAtIndex = useCallback(
    (nextIndex: number) => {
      const nextItem = feedItems[nextIndex];
      if (!nextItem) return;
      setActiveFeedIndex(nextIndex);
      setBroadcastItem(nextItem);
      setError(null);
      navigation.setParams({
        id: nextItem.id,
        item: nextItem,
        items: feedItems,
        index: nextIndex,
      });
    },
    [feedItems, navigation],
  );

  const openNextFeed = useCallback(() => {
    if (!feedItems.length) return;
    if (nextFeedIndex >= feedItems.length) return;
    openFeedAtIndex(nextFeedIndex);
  }, [feedItems.length, nextFeedIndex, openFeedAtIndex]);

  const openPreviousFeed = useCallback(() => {
    if (previousFeedIndex < 0) return;
    openFeedAtIndex(previousFeedIndex);
  }, [openFeedAtIndex, previousFeedIndex]);

  const refreshDetailSequence = useCallback(() => {
    if (refreshingTop || feedItems.length === 0) return;
    setRefreshingTop(true);
    Animated.spring(swipeY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 210,
    }).start();
    setTimeout(() => {
      const shuffled = shuffleFeeds(feedItems, broadcastItem?.id ?? null);
      const nextItem = shuffled[0] ?? broadcastItem;
      setFeedItems(shuffled);
      setActiveFeedIndex(0);
      setBroadcastItem(nextItem);
      setError(null);
      navigation.setParams({
        id: nextItem?.id ?? route.params?.id,
        item: nextItem,
        items: shuffled,
        index: 0,
      });
      setRefreshingTop(false);
    }, 650);
  }, [
    broadcastItem,
    feedItems,
    navigation,
    refreshingTop,
    route.params?.id,
    swipeY,
  ]);

  const feedSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderGrant: () => {
          swipeY.stopAnimation();
        },
        onMoveShouldSetPanResponder: (_, gesture) => {
          const isVertical = Math.abs(gesture.dy) > 10;
          const isMostlyVertical =
            Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25;
          return isVertical && isMostlyVertical;
        },
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy < 0) {
            const resistance = nextFeedItem ? 1 : 0.28;
            swipeY.setValue(Math.max(-screenHeight, gesture.dy * resistance));
            return;
          }
          const resistance = previousFeedItem ? 1 : 0.32;
          swipeY.setValue(Math.min(screenHeight, gesture.dy * resistance));
        },
        onPanResponderRelease: (_, gesture) => {
          const threshold = screenHeight * 0.3;
          const passedThreshold =
            Math.abs(gesture.dy) >= threshold || Math.abs(gesture.vy) > 1.05;

          if (gesture.dy < 0) {
            if (!nextFeedItem) {
              if (gesture.dy < -24 || gesture.vy < -0.35) {
                Alert.alert('Feeds', 'You have reached the last item.');
              }
              Animated.spring(swipeY, {
                toValue: 0,
                useNativeDriver: true,
                damping: 18,
                stiffness: 210,
              }).start();
              return;
            }

            if (passedThreshold) {
              Animated.timing(swipeY, {
                toValue: -screenHeight,
                duration: 380,
                useNativeDriver: true,
              }).start(() => {
                openNextFeed();
                swipeY.setValue(0);
              });
              return;
            }
          } else if (gesture.dy > 0) {
            if (!previousFeedItem) {
              if (gesture.dy > 24 || gesture.vy > 0.35) {
                refreshDetailSequence();
                return;
              }
            } else if (passedThreshold) {
              Animated.timing(swipeY, {
                toValue: screenHeight,
                duration: 380,
                useNativeDriver: true,
              }).start(() => {
                openPreviousFeed();
                swipeY.setValue(0);
              });
              return;
            }
          }

          Animated.spring(swipeY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 210,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 210,
          }).start();
        },
      }),
    [
      nextFeedItem,
      openNextFeed,
      openPreviousFeed,
      previousFeedItem,
      refreshDetailSequence,
      screenHeight,
      swipeY,
    ],
  );

  const handleReact = useCallback(async () => {
    if (!broadcastItem) return;
    const previousCount = Number(
      broadcastItem?.reaction_count ??
        broadcastItem?.engagement?.reactions ??
        0,
    );
    const previousReaction = broadcastItem?.viewer_reaction ?? null;
    const hadSameReaction = previousReaction === '❤️';
    const hadDifferentReaction = Boolean(
      previousReaction && previousReaction !== '❤️',
    );
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
      const count = Number(
        response?.data?.count ?? response?.count ?? previousCount,
      );
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
      Alert.alert(
        'Comments',
        'Unable to open the comment room for this broadcast.',
      );
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
    setBroadcastItem((prev: any) =>
      prev ? { ...prev, viewer_saved: !previousSaved } : prev,
    );
    const endpoint = ROUTES.broadcasts.save(broadcastId);
    const res = previousSaved
      ? await postRequest(
          `${endpoint}?action=unsave`,
          {},
          { errorMessage: 'Unable to remove saved broadcast.' },
        )
      : await postRequest(
          endpoint,
          {},
          { errorMessage: 'Unable to save broadcast.' },
        );
    if (!res?.success) {
      setBroadcastItem((prev: any) =>
        prev ? { ...prev, viewer_saved: previousSaved } : prev,
      );
      Alert.alert('Saved posts', 'Unable to update this saved post right now.');
    }
  }, [broadcastId, broadcastItem?.viewer_saved]);

  const handleShare = useCallback(async () => {
    if (!broadcastId) return;
    const previousShareCount = Number(broadcastItem?.share_count ?? 0);
    const shareResult = await Share.share({
      title,
      message: [title?.trim(), body?.trim()].filter(Boolean).join('\n\n'),
    });
    if (!wasNativeShareCompleted(shareResult)) return;
    const res = await postRequest(
      ROUTES.broadcasts.share(broadcastId),
      { platform: 'app' },
      { errorMessage: 'Unable to log share.' },
    );
    if (res?.success) {
      setBroadcastItem((prev: any) =>
        prev ? { ...prev, share_count: previousShareCount + 1 } : prev,
      );
    } else {
      Alert.alert('Share', 'Unable to log this share right now.');
    }
  }, [body, broadcastId, broadcastItem?.share_count, title]);

  const attachments = useMemo(
    () =>
      Array.isArray(broadcastItem?.attachments)
        ? broadcastItem.attachments.filter(Boolean)
        : [],
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
  }, [attachmentUrls.length, broadcastId]);

  const attachmentUrl = attachmentUrls[activeAttachmentIndex] ?? null;
  const activeAttachment = attachments[activeAttachmentIndex] ?? null;
  const activeAttachmentIsVideo = isVideoAttachment(activeAttachment);
  const showCarousel = attachmentUrls.length > 0;
  const showControls = attachmentUrls.length > 1;
  const isTextOnlyFeed = !showCarousel;
  const handlePrevAttachment = () => {
    setActiveAttachmentIndex(prev =>
      attachmentUrls.length
        ? prev === 0
          ? attachmentUrls.length - 1
          : prev - 1
        : 0,
    );
  };
  const handleNextAttachment = () => {
    setActiveAttachmentIndex(prev =>
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
            setError(
              'Broadcast details are only available when navigating from the feed list.',
            )
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
        <Text style={[styles.error, { color: palette.text }]}>
          Broadcast not found.
        </Text>
      </View>
    );
  }

  const mutedActionColor = 'rgba(255,255,255,0.82)';
  const nextPreviewTitle = getFeedTitle(nextFeedItem);
  const nextPreviewSource = getFeedSource(nextFeedItem);
  const nextPreviewBody = getFeedBody(nextFeedItem);
  const nextPreviewUrl = getFirstFeedImageUrl(nextFeedItem);
  const previousPreviewTitle = getFeedTitle(previousFeedItem);
  const previousPreviewSource = getFeedSource(previousFeedItem);
  const previousPreviewBody = getFeedBody(previousFeedItem);
  const previousPreviewUrl = getFirstFeedImageUrl(previousFeedItem);

  return (
    <View
      style={[styles.fullscreen, { backgroundColor: '#050505' }]}
      {...feedSwipeResponder.panHandlers}
    >
      {previousFeedItem ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pageFrame,
            {
              transform: [{ translateY: Animated.add(swipeY, -screenHeight) }],
            },
          ]}
        >
          <View style={styles.mediaLayer}>
            {previousPreviewUrl ? (
              <Image
                source={{ uri: previousPreviewUrl }}
                style={styles.fullMedia}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.textOnlyVisual}>
                <Text style={styles.textOnlyTitle} numberOfLines={5}>
                  {previousPreviewTitle}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.scrimTop} pointerEvents="none" />
          <View style={styles.scrimBottom} pointerEvents="none" />
          <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
            <View style={styles.backButton}>
              <KISIcon name="arrow-left" size={22} color="#fff" />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.heading} numberOfLines={1}>
                {previousPreviewTitle}
              </Text>
              <Text style={styles.sourceName} numberOfLines={1}>
                {previousPreviewSource}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.bottomDescription,
              {
                bottom: insets.bottom + 24,
                right: 92,
              },
            ]}
          >
            <Text style={styles.body} numberOfLines={5}>
              {previousPreviewBody || previousPreviewTitle}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {nextFeedItem ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pageFrame,
            {
              transform: [{ translateY: Animated.add(swipeY, screenHeight) }],
            },
          ]}
        >
          <View style={styles.mediaLayer}>
            {nextPreviewUrl ? (
              <Image
                source={{ uri: nextPreviewUrl }}
                style={styles.fullMedia}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.textOnlyVisual}>
                <Text style={styles.textOnlyTitle} numberOfLines={5}>
                  {nextPreviewTitle}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.scrimTop} pointerEvents="none" />
          <View style={styles.scrimBottom} pointerEvents="none" />
          <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
            <View style={styles.backButton}>
              <KISIcon name="arrow-left" size={22} color="#fff" />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.heading} numberOfLines={1}>
                {nextPreviewTitle}
              </Text>
              <Text style={styles.sourceName} numberOfLines={1}>
                {nextPreviewSource}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.bottomDescription,
              {
                bottom: insets.bottom + 24,
                right: 92,
              },
            ]}
          >
            <Text style={styles.body} numberOfLines={5}>
              {nextPreviewBody || nextPreviewTitle}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.pageFrame,
          {
            transform: [{ translateY: swipeY }],
          },
        ]}
      >
        <View style={styles.mediaLayer}>
          {showCarousel ? (
            activeAttachmentIsVideo && activeAttachment ? (
              <BroadcastFeedVideoPreview
                attachment={activeAttachment}
                palette={palette as any}
                containerStyle={styles.fullMedia}
                videoStyle={styles.fullMedia}
              />
            ) : attachmentUrl ? (
              <Image
                source={{ uri: attachmentUrl }}
                style={styles.fullMedia}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.textOnlyVisual} />
            )
          ) : (
            <View style={styles.textOnlyVisual}>
              {richTextValue ? (
                <RichTextRenderer
                  value={richTextValue}
                  fallback={body || title}
                  style={styles.textOnlyRich}
                />
              ) : (
                <Text style={styles.textOnlyTitle} numberOfLines={8}>
                  {body || title}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.scrimTop} pointerEvents="none" />
        <View style={styles.scrimBottom} pointerEvents="none" />

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <KISIcon name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.heading} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.sourceName} numberOfLines={1}>
              {sourceName}
            </Text>
          </View>
        </View>

        {showControls ? (
          <>
            <Pressable
              style={[styles.navButton, styles.navLeft]}
              onPress={handlePrevAttachment}
            >
              <Text style={styles.navButtonText}>{'‹'}</Text>
            </Pressable>
            <Pressable
              style={[styles.navButton, styles.navRight]}
              onPress={handleNextAttachment}
            >
              <Text style={styles.navButtonText}>{'›'}</Text>
            </Pressable>
            <View style={[styles.dotRow, { bottom: insets.bottom + 132 }]}>
              {attachmentUrls.map((_: string, dotIndex: number) => (
                <View
                  key={`dot-${dotIndex}`}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        dotIndex === activeAttachmentIndex
                          ? '#fff'
                          : 'rgba(255,255,255,0.38)',
                    },
                  ]}
                />
              ))}
            </View>
          </>
        ) : null}

        <View style={[styles.floatingActions, { bottom: insets.bottom + 34 }]}>
          <Pressable onPress={handleToggleSaved} style={styles.floatingAction}>
            <View style={styles.iconBubble}>
              <KISIcon
                name="bookmark"
                size={22}
                color={viewerSaved ? '#fff' : mutedActionColor}
              />
            </View>
            <Text style={styles.actionCount}>
              {viewerSaved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
          <Pressable onPress={handleReact} style={styles.floatingAction}>
            <View style={styles.iconBubble}>
              <KISIcon
                name="heart"
                size={23}
                color={viewerReaction ? '#fff' : mutedActionColor}
              />
            </View>
            <Text style={styles.actionCount}>{reactionCount}</Text>
          </Pressable>
          <Pressable onPress={handleOpenComments} style={styles.floatingAction}>
            <View style={styles.iconBubble}>
              <KISIcon name="comment" size={22} color={mutedActionColor} />
            </View>
            <Text style={styles.actionCount}>{commentCount}</Text>
          </Pressable>
          <Pressable onPress={handleShare} style={styles.floatingAction}>
            <View style={styles.iconBubble}>
              <KISIcon name="share" size={22} color={mutedActionColor} />
            </View>
            <Text style={styles.actionCount}>{shareCount}</Text>
          </Pressable>
        </View>

        {!isTextOnlyFeed ? (
          <View
            style={[
              styles.bottomDescription,
              {
                bottom: insets.bottom + 24,
                right: 92,
              },
            ]}
          >
            {richTextValue ? (
              <RichTextRenderer
                value={richTextValue}
                fallback={body || title}
                style={styles.overlayRichText}
              />
            ) : body ? (
              <Text style={styles.body} numberOfLines={5}>
                {body}
              </Text>
            ) : (
              <Text style={styles.body} numberOfLines={3}>
                {title}
              </Text>
            )}
          </View>
        ) : null}
      </Animated.View>

      {refreshingTop ? (
        <View pointerEvents="none" style={styles.refreshOverlay}>
          <View style={styles.refreshPill}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.refreshText}>Refreshing feeds</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
  },
  pageFrame: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
  },
  refreshOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  refreshText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  mediaLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  sourceName: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  fullMedia: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  textOnlyVisual: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  textOnlyTitle: {
    color: '#fff',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
  },
  textOnlyRich: {
    width: '100%',
    maxHeight: '72%',
    overflow: 'hidden',
  },
  overlayRichText: {
    maxHeight: 116,
    overflow: 'hidden',
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 190,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    color: '#fff',
  },
  dotRow: {
    position: 'absolute',
    bottom: 122,
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
  body: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  floatingActions: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 16,
  },
  floatingAction: {
    alignItems: 'center',
    gap: 4,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomDescription: {
    position: 'absolute',
    left: 16,
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
