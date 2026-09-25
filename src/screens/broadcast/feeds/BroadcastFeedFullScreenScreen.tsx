// src/screens/broadcast/feeds/BroadcastFeedFullScreenScreen.tsx
//
// TikTok-style immersive viewer for the Broadcast Feeds tab (see the
// YouTube-style BroadcastFeedCard for the normal scrolling view this opens
// from). Same vertical-paging-FlatList shape as ShortsScreen.tsx, adapted
// for BroadcastFeedItem[] and Feeds' own action handlers instead of the
// shorts-specific channel content API - action callbacks are passed
// straight through via navigation params from FeedsDiscoverPage rather
// than re-fetched here, so likes/saves/etc. stay backed by the exact same
// feed-list state already loaded in the scrolling view.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import { resolveBackendAssetUrl } from '@/network';
import BroadcastFeedVideoPreview from '@/components/broadcast/BroadcastFeedVideoPreview';
import {
  dedupeAttachmentPreviews,
  getAttachmentPreviewInfo,
} from '@/components/broadcast/attachmentPreview';
import { isUserBroadcastSource } from '@/components/broadcast/authorProfileUtils';
import { getFeedPlainText } from '@/components/feeds/richTextValue';

type Item = Record<string, any>;
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'BroadcastFeedFullScreen'>;

const fallbackAvatar = require('@/assets/logo-light.png');

function getTextExcerpt(item: Item) {
  return getFeedPlainText(item).replace(/\s+/g, ' ').trim();
}

type CardProps = {
  item: Item;
  isVisible: boolean;
  shouldPreload: boolean;
  screenHeight: number;
  initialAttachmentIndex?: number;
  trueFullView: boolean;
  rotated: boolean;
  onEnterTrueFullView: () => void;
  onExitTrueFullView: () => void;
  onToggleRotate: () => void;
  onLike?: (item: Item) => void;
  onShare?: (item: Item) => void;
  onComment?: (item: Item) => void | Promise<void>;
  onSave?: (item: Item) => void;
  onSubscribe?: (item: Item) => void;
};

function FeedFullScreenCard({
  item,
  isVisible,
  shouldPreload,
  screenHeight,
  initialAttachmentIndex,
  trueFullView,
  rotated,
  onEnterTrueFullView,
  onExitTrueFullView,
  onToggleRotate,
  onLike,
  onShare,
  onComment,
  onSave,
  onSubscribe,
}: CardProps) {
  const { palette } = useKISTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const attachmentPreviews = useMemo(() => {
    const raw = (Array.isArray(item.attachments) ? item.attachments : []).filter(Boolean);
    const deduped = dedupeAttachmentPreviews(raw.map((a: any) => getAttachmentPreviewInfo(a))).map(
      (info, i) => ({ ...info, raw: raw[i] ?? null }),
    );
    return deduped.filter(info => Boolean(info.previewUri || info.url));
  }, [item.attachments]);

  const [activeIndex, setActiveIndex] = useState(
    Math.min(Math.max(0, initialAttachmentIndex ?? 0), Math.max(0, attachmentPreviews.length - 1)),
  );
  const activeAttachment = attachmentPreviews[activeIndex] ?? null;
  const isMultiAttachment = attachmentPreviews.length > 1;

  // Same whole-set prefetch as BroadcastFeedCard's slideshow - warms every
  // OTHER image in this item as soon as it renders, not just the one next
  // to whichever slide is active, since a one-ahead prefetch only wins if
  // the user waits at least as long as that fetch takes before tapping
  // the strip again.
  useEffect(() => {
    if (attachmentPreviews.length < 2) return;
    attachmentPreviews.forEach((preview, idx) => {
      if (idx === activeIndex || preview.isVideo) return;
      const uri = preview.previewUri ?? preview.url;
      if (uri) Image.prefetch(uri).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentPreviews]);

  // Drives a visible spinner over the current image instead of a blank
  // tile while it loads - see BroadcastFeedCard's slideImageLoading doc.
  const [slideImageLoading, setSlideImageLoading] = useState(false);

  const [commentsLoading, setCommentsLoading] = useState(false);
  const handlePressComment = useCallback(async () => {
    if (commentsLoading) return;
    setCommentsLoading(true);
    try {
      await onComment?.(item);
    } finally {
      setCommentsLoading(false);
    }
  }, [commentsLoading, onComment, item]);

  const [showHeart, setShowHeart] = useState(false);
  const handleDoubleTapLike = useCallback(() => {
    onLike?.(item);
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  }, [item, onLike]);

  const isUserSource = isUserBroadcastSource(item as any);
  const authorName = String(item.author?.display_name ?? '').trim();
  const sourceName = item.source?.name || (item.source?.type ? String(item.source.type) : '');
  const displayName = isUserSource ? authorName || 'KIS user' : authorName || sourceName || 'Broadcast';
  const caption = getTextExcerpt(item as any);
  const authorAvatarUri = resolveBackendAssetUrl(item.author?.avatar_url ?? null);
  const isSubscribed = Boolean(item.source?.is_subscribed);
  const canSubscribe = Boolean(item.source?.allow_subscribe);

  // "Fake landscape": no orientation-lock native module is installed in
  // this app, so True Full View's Rotate button simulates landscape by
  // swapping the content box's own width/height and rotating it 90°
  // inside an unrotated, screen-sized wrapper, rather than actually
  // changing the device's OS-level orientation.
  const rotatedContentStyle = rotated
    ? { width: screenHeight, height: screenWidth, transform: [{ rotate: '90deg' as const }] }
    : { width: screenWidth, height: screenHeight };

  const mediaContent = (
    <View style={StyleSheet.absoluteFillObject}>
      {activeAttachment?.isVideo && activeAttachment.raw && (isVisible || shouldPreload) ? (
        <BroadcastFeedVideoPreview
          attachment={activeAttachment.raw}
          palette={palette}
          containerStyle={StyleSheet.absoluteFillObject}
          posterOverride={activeAttachment.previewUri ?? undefined}
          autoPlay={isVisible}
          externalPause={!isVisible}
          forceTextureView
          progressBarOnly
          progressBarStyle={{ position: 'absolute', left: 12, right: 12, bottom: bottomInset + 4 }}
          onDoubleTapMiddle={handleDoubleTapLike}
        />
      ) : activeAttachment?.previewUri || activeAttachment?.url ? (
        <>
          <Image
            source={{ uri: activeAttachment.previewUri ?? activeAttachment.url! }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            onLoadStart={() => setSlideImageLoading(true)}
            onLoad={() => setSlideImageLoading(false)}
            onError={() => setSlideImageLoading(false)}
          />
          {slideImageLoading ? (
            <View style={[StyleSheet.absoluteFillObject, styles.slideLoadingOverlay]} pointerEvents="none">
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </>
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
          <KISIcon name="play" size={48} color={palette.border} />
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.card, { height: screenHeight, width: screenWidth }]}>
      {/* No wrapping Pressable around the media itself outside True Full
          View - KISVideo's own onDoubleTapMiddle needs direct, unshadowed
          touch access for double-tap-to-like to actually register (a
          Pressable ancestor claims touch-responder duties regardless of
          whether its own onPress does anything, which would otherwise
          silently swallow the video's internal tap detection). */}
      <View style={[styles.rotateOuter, { width: screenWidth, height: screenHeight }]}>
        <View style={rotatedContentStyle}>{mediaContent}</View>
      </View>

      {/* True Full View's only interactive surface: tap anywhere to exit
          back to the normal TikTok-style controls. Mounted on top of (not
          instead of) the media above, and only while True Full View is
          active - normal mode has no such layer at all. */}
      {trueFullView ? (
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onExitTrueFullView}
          accessibilityRole="button"
          accessibilityLabel="Exit Full View"
        />
      ) : null}

      {showHeart ? (
        <View style={styles.doubleTapHeart} pointerEvents="none">
          <KISIcon name="heart" size={80} color={palette.danger} />
        </View>
      ) : null}

      {!trueFullView ? (
        <View style={styles.overlayScrim} pointerEvents="none" />
      ) : null}

      {/* ── True Full View: only a Rotate button + exit-tap-anywhere. ─── */}
      {trueFullView ? (
        <Pressable
          onPress={onToggleRotate}
          style={[styles.rotateBtn, { top: 16, backgroundColor: 'rgba(0,0,0,0.5)' }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Rotate"
        >
          <KISIcon name="refresh" size={20} color={palette.ivory} />
        </Pressable>
      ) : (
        <>
          {/* ── Bottom-left caption ─────────────────────────────────── */}
          <View style={[styles.infoRow, { bottom: Math.max(60, bottomInset + 20) }]}>
            <View style={styles.metaCol}>
              {displayName ? (
                <Text style={[styles.channelName, { color: palette.ivory }]} numberOfLines={1}>
                  @{displayName}
                </Text>
              ) : null}
              {caption ? (
                <Text style={[styles.caption, { color: palette.ivory }]} numberOfLines={3}>
                  {caption}
                </Text>
              ) : null}
            </View>

            <View style={styles.actionsCol}>
              <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('ViewProfile' as any, { userId: item.author?.id, displayName } as any)}>
                <Image
                  source={authorAvatarUri ? { uri: authorAvatarUri } : fallbackAvatar}
                  style={[styles.avatar, { borderColor: palette.ivory }]}
                />
                {canSubscribe ? (
                  <Pressable
                    onPress={() => onSubscribe?.(item)}
                    style={[styles.followDot, { backgroundColor: isSubscribed ? palette.success : palette.danger }]}
                  >
                    <KISIcon name={isSubscribed ? 'check' : 'plus'} size={10} color={palette.ivory} />
                  </Pressable>
                ) : null}
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={() => onLike?.(item)}>
                <KISIcon name="heart" size={26} color={item.viewer_reaction ? palette.danger : palette.ivory} />
                <Text style={[styles.actionCount, { color: palette.ivory }]}>{item.reaction_count ?? 0}</Text>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={handlePressComment} disabled={commentsLoading}>
                {commentsLoading ? (
                  <ActivityIndicator size="small" color={palette.ivory} />
                ) : (
                  <KISIcon name="comment" size={24} color={palette.ivory} />
                )}
                <Text style={[styles.actionCount, { color: palette.ivory }]}>{item.comment_count ?? 0}</Text>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={() => onShare?.(item)}>
                <KISIcon name="share" size={24} color={palette.ivory} />
                <Text style={[styles.actionCount, { color: palette.ivory }]}>{item.share_count ?? 0}</Text>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={() => onSave?.(item)}>
                <KISIcon name="bookmark" size={24} color={item.viewer_saved ? palette.gold : palette.ivory} />
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={onEnterTrueFullView} accessibilityLabel="Full View">
                <KISIcon name="fullscreen" size={22} color={palette.ivory} />
              </Pressable>
            </View>
          </View>

          {/* ── Other uploaded items — small floating strip, noticeable
                but never covering most of the content. ────────────────── */}
          {isMultiAttachment ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.stripWrap, { bottom: Math.max(60, bottomInset + 20) + 96 }]}
              contentContainerStyle={styles.stripContent}
            >
              {attachmentPreviews.map((preview, idx) => (
                <Pressable
                  key={`${item.id}-strip-${idx}`}
                  onPress={() => setActiveIndex(idx)}
                  style={[
                    styles.stripChip,
                    { borderColor: idx === activeIndex ? palette.gold : 'rgba(255,255,255,0.4)' },
                  ]}
                >
                  {preview.previewUri || preview.url ? (
                    <Image source={{ uri: preview.previewUri ?? preview.url! }} style={styles.stripChipImage} />
                  ) : (
                    <View style={[styles.stripChipImage, { backgroundColor: palette.surfaceElevated }]} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </>
      )}
    </View>
  );
}

export default function BroadcastFeedFullScreenScreen() {
  const { palette } = useKISTheme();
  const { height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { top: topInset } = useSafeAreaInsets();

  const items = useMemo(() => route.params?.items ?? [], [route.params?.items]);
  const startIndex = Math.min(Math.max(0, route.params?.index ?? 0), Math.max(0, items.length - 1));
  const [visibleIndex, setVisibleIndex] = useState(startIndex);
  const [trueFullView, setTrueFullView] = useState(false);
  const [rotated, setRotated] = useState(false);

  const handleExitTrueFullView = useCallback(() => {
    setTrueFullView(false);
    setRotated(false);
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setVisibleIndex(viewableItems[0].index);
    }
  }, []);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 });

  const handleLike = useCallback((item: Item) => { Vibration.vibrate(20); route.params?.onLike?.(item); }, [route.params]);
  const handleShare = useCallback((item: Item) => { route.params?.onShare?.(item); }, [route.params]);
  const handleComment = useCallback((item: Item) => route.params?.onComment?.(item), [route.params]);
  const handleSave = useCallback((item: Item) => { route.params?.onSave?.(item); }, [route.params]);
  const handleSubscribe = useCallback((item: Item) => { route.params?.onSubscribe?.(item); }, [route.params]);

  if (!items.length) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.royalInk }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { top: topInset + 8 }]} hitSlop={12}>
          <KISIcon name="arrow-left" size={22} color={palette.ivory} />
        </Pressable>
        <Text style={{ color: palette.subtext, fontWeight: '700' }}>Nothing to show.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.royalInk }}>
      <FlatList
        data={items}
        keyExtractor={(item: Item) => item.id}
        initialScrollIndex={startIndex}
        getItemLayout={(_, index) => ({ length: screenHeight, offset: screenHeight * index, index })}
        renderItem={({ item, index }) => (
          <FeedFullScreenCard
            item={item}
            isVisible={index === visibleIndex}
            shouldPreload={Math.abs(index - visibleIndex) === 1}
            screenHeight={screenHeight}
            initialAttachmentIndex={index === startIndex ? route.params?.initialAttachmentIndex : undefined}
            trueFullView={trueFullView}
            rotated={rotated}
            onEnterTrueFullView={() => setTrueFullView(true)}
            onExitTrueFullView={handleExitTrueFullView}
            onToggleRotate={() => setRotated(prev => !prev)}
            onLike={handleLike}
            onShare={handleShare}
            onComment={handleComment}
            onSave={handleSave}
            onSubscribe={handleSubscribe}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={screenHeight}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        windowSize={5}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
      />

      {/* ── Back — returns to the normal YouTube-style scrolling feed. ─── */}
      {!trueFullView ? (
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { top: topInset + 8, backgroundColor: 'rgba(0,0,0,0.4)' }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <KISIcon name="arrow-left" size={22} color={palette.ivory} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { overflow: 'hidden', backgroundColor: '#000' },
  rotateOuter: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  overlayScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.06)' },
  slideLoadingOverlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' },
  doubleTapHeart: { position: 'absolute', top: '35%', left: '50%', marginLeft: -40, zIndex: 30 },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotateBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    gap: 12,
    zIndex: 5,
  },
  metaCol: { flex: 1, gap: 4 },
  channelName: { fontWeight: '900', fontSize: 14 },
  caption: { fontWeight: '600', fontSize: 13, lineHeight: 18 },
  actionsCol: { flexDirection: 'column', alignItems: 'center', gap: 16, paddingBottom: 4 },
  actionBtn: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 44, minHeight: 44 },
  actionCount: { fontSize: 11, fontWeight: '700' },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5 },
  followDot: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  stripWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 5,
  },
  stripContent: { paddingHorizontal: 14, gap: 8 },
  stripChip: {
    width: 56,
    height: 78,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
  },
  stripChipImage: { width: '100%', height: '100%' },
});
