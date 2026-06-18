import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  Vibration,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import type { RootStackParamList } from '@/navigation/types';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { FEEDS_ENDPOINT } from '@/network';
import { KISVideo } from '@/Module/vieo';
import { resolveBackendAssetUrl } from '@/network';
import type { BroadcastChannelContent } from '@/screens/broadcast/channels/api/channels.types';
import { reactToChannelContent, shareChannelContent, toggleChannelSubscription } from '@/screens/broadcast/channels/hooks/useChannelsData';
import ChannelCommentsPanel from '@/screens/broadcast/channels/components/ChannelCommentsPanel';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type ShortsItem = BroadcastChannelContent & {
  videoUrl?: string;
  thumbUrl?: string;
  localLikeCount?: number;
  localLiked?: boolean;
};

function normalizeShort(item: any): ShortsItem {
  const asset = item?.first_asset || item?.assets?.[0] || null;
  const videoUrl = resolveBackendAssetUrl(asset?.url || '');
  const thumbUrl = resolveBackendAssetUrl(
    item?.thumbnail_url || asset?.thumbnail_url || asset?.url || '',
  );
  return { ...item, videoUrl, thumbUrl };
}

type ShortCardProps = {
  item: ShortsItem;
  isVisible: boolean;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onShare: (item: ShortsItem) => void;
  onCommentPress: (id: string) => void;
  onSubscribe: (channelId: string) => void;
  subscribedChannels: Set<string>;
};

function ShortCard({ item, isVisible, onLike, onDislike, onShare, onCommentPress, onSubscribe, subscribedChannels }: ShortCardProps) {
  const { palette } = useKISTheme();
  const { minTouchTarget } = useResponsiveLayout();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const liked = Boolean(item.localLiked);
  const likeCount = item.localLikeCount ?? item.engagement_counts?.reactions ?? 0;
  const channelId = item.channel?.id;
  const isSubscribed = channelId ? subscribedChannels.has(channelId) : false;

  // Double-tap like detection
  const lastTapRef = useRef<number>(0);
  const [showHeart, setShowHeart] = useState(false);

  const handleVideoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onLike(item.id);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    }
    lastTapRef.current = now;
  }, [item.id, onLike]);

  return (
    <View style={[styles.card, { height: SCREEN_HEIGHT }]}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handleVideoTap}>
        {item.videoUrl ? (
          <KISVideo
            sourceUrl={item.videoUrl}
            poster={item.thumbUrl}
            autoPlay={isVisible}
            loop
            muted={false}
            containerStyle={StyleSheet.absoluteFillObject}
            videoStyle={{ borderRadius: 0 }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
            <KISIcon name="play" size={48} color={palette.border} />
          </View>
        )}
      </Pressable>

      {/* Double-tap heart flash */}
      {showHeart && (
        <View style={styles.doubleTapHeart} pointerEvents="none">
          <KISIcon name="heart" size={80} color={palette.danger} />
        </View>
      )}

      <View style={styles.overlay} />

      <View style={[styles.infoRow, { bottom: Math.max(60, bottomInset + 20) }]}>
        <View style={styles.metaCol}>
          {item.channel?.display_name ? (
            <Pressable
              onPress={() => navigation.navigate('ChannelHome', { channelId: item.channel?.id })}
              style={styles.channelRow}
            >
              <Text style={[styles.channelName, { color: palette.ivory }]}>@{item.channel.handle || item.channel.display_name}</Text>
              {channelId && (
                <Pressable
                  onPress={() => onSubscribe(channelId)}
                  style={[styles.followPill, { borderColor: isSubscribed ? palette.success : palette.ivory, backgroundColor: isSubscribed ? palette.success : 'transparent', minHeight: minTouchTarget }]}
                >
                  <Text style={{ color: palette.ivory, fontWeight: '900', fontSize: 11 }}>{isSubscribed ? '✓' : 'Follow'}</Text>
                </Pressable>
              )}
            </Pressable>
          ) : null}
          <Text style={[styles.shortTitle, { color: palette.ivory }]} numberOfLines={2}>{item.title || (item as any).text_plain || ''}</Text>
        </View>

        <View style={styles.actionsCol}>
          <Pressable style={styles.actionBtn} onPress={() => onLike(item.id)}>
            <KISIcon name="heart" size={26} color={liked ? palette.danger : palette.ivory} />
            {likeCount > 0 && <Text style={[styles.actionCount, { color: palette.ivory }]}>{likeCount}</Text>}
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onDislike(item.id)}>
            <KISIcon name="warning" size={24} color={palette.ivory} />
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onCommentPress(item.id)}>
            <KISIcon name="comment" size={24} color={palette.ivory} />
            <Text style={[styles.actionCount, { color: palette.ivory }]}>{item.engagement_counts?.comments ?? ''}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onShare(item)}>
            <KISIcon name="share" size={24} color={palette.ivory} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ShortsScreen() {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<ShortsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleIndex, setVisibleIndex] = useState(0);

  // Comments bottom sheet
  const [commentsContentId, setCommentsContentId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const commentsAnim = useRef(new Animated.Value(0)).current;

  // Subscribe state
  const [subscribedChannels, setSubscribedChannels] = useState<Set<string>>(new Set());

  const openComments = useCallback((id: string) => {
    setCommentsContentId(id);
    setCommentsOpen(true);
    Animated.spring(commentsAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [commentsAnim]);

  const closeComments = useCallback(() => {
    Animated.timing(commentsAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setCommentsOpen(false);
      setCommentsContentId(null);
    });
  }, [commentsAnim]);

  const handleDislike = useCallback((id: string) => {
    Vibration.vibrate(15);
    void reactToChannelContent(id, 'dislike');
  }, []);

  const handleLike = useCallback((id: string) => {
    Vibration.vibrate(25);
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const nowLiked = !it.localLiked;
      const base = it.localLikeCount ?? it.engagement_counts?.reactions ?? 0;
      void reactToChannelContent(id);
      return { ...it, localLiked: nowLiked, localLikeCount: Math.max(0, base + (nowLiked ? 1 : -1)) };
    }));
  }, []);

  const handleShare = useCallback(async (item: ShortsItem) => {
    const url = `https://kis.app/shorts/${item.id}`;
    await Share.share({ message: item.title || 'Check out this short!', url, title: item.title || 'KIS Short' });
    void shareChannelContent(item.id, true);
  }, []);

  const handleSubscribe = useCallback((channelId: string) => {
    setSubscribedChannels(prev => {
      const next = new Set(prev);
      const nowSubscribed = !next.has(channelId);
      if (nowSubscribed) {
        next.add(channelId);
      } else {
        next.delete(channelId);
      }
      void toggleChannelSubscription(channelId, nowSubscribed);
      return next;
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    getRequest(`${FEEDS_ENDPOINT}?content_type=short_video&limit=30`, { errorMessage: 'Unable to load shorts.' })
      .then(res => {
        const raw = res?.data?.results ?? res?.data ?? [];
        setItems(Array.isArray(raw) ? raw.map(normalizeShort) : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setVisibleIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 });

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.royalInk }]}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  if (!items.length) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.royalInk }]} edges={['top']}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <KISIcon name="close" size={22} color={palette.ivory} />
        </Pressable>
        <KISIcon name="play" size={48} color={palette.divider} />
        <Text style={{ color: palette.subtext, marginTop: 12, fontWeight: '700' }}>No shorts yet</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.royalInk }}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <KISIcon name="arrow-left" size={22} color={palette.ivory} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.ivory }]}>Shorts</Text>
      </SafeAreaView>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={[styles.centered, { backgroundColor: palette.royalInk, flex: 1 }]}>
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>No shorts available.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <ShortCard
            item={item}
            isVisible={index === visibleIndex}
            onLike={handleLike}
            onDislike={handleDislike}
            onShare={handleShare}
            onCommentPress={openComments}
            onSubscribe={handleSubscribe}
            subscribedChannels={subscribedChannels}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        getItemLayout={(_, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
      />

      {/* Comments bottom sheet */}
      {commentsOpen && (
        <Modal
          visible={commentsOpen}
          transparent
          animationType="none"
          onRequestClose={closeComments}
        >
          <Pressable
            style={styles.commentsBackdrop}
            onPress={closeComments}
          />
          <Animated.View
            style={[
              styles.commentsSheet,
              { backgroundColor: palette.surface },
              {
                transform: [{
                  translateY: commentsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [SCREEN_HEIGHT * 0.65, 0],
                  }),
                }],
              },
            ]}
          >
            {/* Drag handle */}
            <View style={styles.sheetHandle}>
              <View style={[styles.handleBar, { backgroundColor: palette.border }]} />
            </View>
            <View style={[styles.sheetHeader, { borderBottomColor: palette.border }]}>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>Comments</Text>
              <Pressable onPress={closeComments} hitSlop={12}>
                <KISIcon name="close" size={20} color={palette.subtext} />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {commentsContentId ? (
                <ChannelCommentsPanel contentId={commentsContentId} />
              ) : null}
            </ScrollView>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  closeBtn: { position: 'absolute', top: 56, left: 16, zIndex: 20 },
  card: { width: '100%', overflow: 'hidden' },
  doubleTapHeart: { position: 'absolute', top: '35%', left: '50%', marginLeft: -40, zIndex: 30 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  infoRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    gap: 12,
  },
  metaCol: { flex: 1 },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  channelName: { fontWeight: '900', fontSize: 14 },
  followPill: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  shortTitle: { fontWeight: '700', fontSize: 13, lineHeight: 18 },
  actionsCol: { flexDirection: 'column', alignItems: 'center', gap: 18, paddingBottom: 4 },
  actionBtn: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 44, minHeight: 44 },
  actionCount: { fontSize: 11, fontWeight: '700' },
  commentsBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  commentsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetHandle: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 16, fontWeight: '900' },
});
