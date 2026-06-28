import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import type { RootStackParamList } from '@/navigation/types';
import { wasNativeShareCompleted } from '@/utils/shareCompletion';

import FeedsMainListSection from '@/screens/broadcast/feeds/sections/FeedsMainListSection';
import TrendingClipsSection from '@/screens/broadcast/feeds/sections/TrendingClipsSection';

import useFeedsData from '@/screens/broadcast/feeds/hooks/useFeedsData';
import type { BroadcastFeedItem } from '@/screens/broadcast/feeds/api/feeds.types';
import { resolveBroadcastPosterUserId } from '@/components/broadcast/resolveBroadcastPosterId';
import { KISIcon } from '@/constants/kisIcons';
import AddToPlaylistSheet from '@/screens/broadcast/playlists/AddToPlaylistSheet';
import { getPlaylistsState, subscribeToPlaylists } from '@/screens/broadcast/playlists/playlistManager';

type FeedCategory = 'for_you' | 'following' | 'trending' | 'live' | 'channels' | 'community' | 'market' | 'education';

const CATEGORIES: Array<{ id: FeedCategory; label: string; icon?: string }> = [
  { id: 'for_you', label: 'For You', icon: 'star' },
  { id: 'following', label: 'Following', icon: 'person' },
  { id: 'trending', label: 'Trending', icon: 'fire' },
  { id: 'live', label: 'Live', icon: 'broadcast' },
  { id: 'channels', label: 'Channels', icon: 'play' },
  { id: 'community', label: 'Community', icon: 'people' },
  { id: 'market', label: 'Market', icon: 'bag' },
  { id: 'education', label: 'Education', icon: 'book' },
];

type Props = {
  searchTerm?: string;
  searchContext?: string;
  code?: string | null;
  onTrendingSeeAll?: () => void;
  // Controlled filter props — passed from BroadcastScreen via the filter panel
  activeCategory?: FeedCategory;
  onCategoryChange?: (cat: FeedCategory) => void;
  filterSort?: 'new' | 'top' | 'oldest';
  filterDatePreset?: 'today' | 'week' | 'month' | 'all';
  filterDuration?: 'short' | 'medium' | 'long' | 'any';
};

export default function FeedsDiscoverPage({
  searchTerm = '',
  searchContext = '',
  code = null,
  onTrendingSeeAll,
  activeCategory: activeCategoryProp,
  onCategoryChange,
  filterSort: filterSortProp,
  filterDatePreset: filterDatePresetProp,
  filterDuration: filterDurationProp,
}: Props) {
  const { palette } = useKISTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [showTrendingOnly, setShowTrendingOnly] = useState(false);
  // Use controlled props when provided, else fall back to local state
  const [activeCategoryLocal, setActiveCategoryLocal] = useState<FeedCategory>('for_you');
  const activeCategory = activeCategoryProp ?? activeCategoryLocal;
  const setActiveCategory = (cat: FeedCategory) => {
    setActiveCategoryLocal(cat);
    onCategoryChange?.(cat);
  };
  const [playlistSheetItem, setPlaylistSheetItem] = useState<BroadcastFeedItem | null>(null);
  // Filter state — controlled from parent when props are provided
  const filterSort = filterSortProp ?? 'new';
  const filterDatePreset = filterDatePresetProp ?? 'all';
  const filterDuration = filterDurationProp ?? 'any';
  const [playlistCount, setPlaylistCount] = useState(
    () => getPlaylistsState().playlists.length,
  );

  useEffect(() => {
    return subscribeToPlaylists(s => setPlaylistCount(s.playlists.length));
  }, []);

  const {
    items,
    trending,
    trendingFeeds,
    loading,
    loadingMore,
    refreshing,
    refreshAll,
    loadMore,
    toggleSubscribe,
    reactToItem,
    recordShare,
    hideItem,
    toggleSaved,
  } = useFeedsData({ q: searchTerm, code });

  const filteredFeed = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const nonHealthcare = items.filter(
      item =>
        String(item.source_type || '').toLowerCase() !== 'healthcare' &&
        String(item.source?.type || '').toLowerCase() !== 'healthcare',
    );
    if (q) {
      return nonHealthcare.filter(it => {
        const hay = `${it.title ?? ''} ${it.text_plain ?? ''} ${
          it.source?.name ?? ''
        } ${it.author?.display_name ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return nonHealthcare;
  }, [items, searchTerm]);

  const displayItems = useMemo(() => {
    const context = (searchContext ?? '').trim().toLowerCase();
    const category = showTrendingOnly ? 'trending' : activeCategory;

    // Apply search context first
    let base = filteredFeed;
    if (context === 'saved') return base.filter(item => Boolean(item.viewer_saved));

    // Date range filter
    if (filterDatePreset !== 'all') {
      const now = Date.now();
      const cutoff =
        filterDatePreset === 'today'
          ? new Date().setHours(0, 0, 0, 0)
          : filterDatePreset === 'week'
          ? now - 7 * 24 * 60 * 60 * 1000
          : now - 30 * 24 * 60 * 60 * 1000;
      base = base.filter(item => {
        const ts = new Date(item.broadcasted_at ?? item.created_at ?? '').getTime();
        return ts >= cutoff;
      });
    }

    // Duration filter
    if (filterDuration !== 'any') {
      base = base.filter(item => {
        const dur = (item as any).video_duration_seconds as number | undefined;
        if (filterDuration === 'short') return !dur || dur < 240;
        if (filterDuration === 'medium') return dur !== undefined && dur >= 240 && dur <= 1200;
        if (filterDuration === 'long') return dur !== undefined && dur > 1200;
        return true;
      });
    }

    switch (category) {
      case 'trending':
        return [...base].sort(
          (a, b) =>
            (b.reaction_count ?? 0) + (b.comment_count ?? 0) * 2 -
            ((a.reaction_count ?? 0) + (a.comment_count ?? 0) * 2),
        ).sort(filterSort === 'oldest'
          ? (a, b) => new Date(a.broadcasted_at ?? a.created_at ?? '').getTime() - new Date(b.broadcasted_at ?? b.created_at ?? '').getTime()
          : filterSort === 'top'
          ? (a, b) => (b.reaction_count ?? 0) - (a.reaction_count ?? 0)
          : () => 0);
      case 'live':
        return base.filter(item => Boolean(item.is_live));
      case 'channels':
        return base.filter(item =>
          ['channel', 'channel_content', 'broadcast_channel'].includes(
            String(item.source_type || '').toLowerCase(),
          ),
        );
      case 'community':
        return base.filter(item =>
          String(item.source_type || '').toLowerCase() === 'community',
        );
      case 'market':
        return base.filter(item =>
          ['market', 'market_product', 'market_service'].includes(
            String(item.source_type || '').toLowerCase(),
          ),
        );
      case 'education':
        return base.filter(item =>
          ['education', 'lesson', 'broadcast_education'].includes(
            String(item.source_type || '').toLowerCase(),
          ),
        );
      case 'following':
        return base.filter(item => Boolean(item.source?.is_subscribed || item.source?.is_member));
      case 'for_you':
      default:
        if (filterSort === 'oldest') {
          return [...base].sort((a, b) => new Date(a.broadcasted_at ?? a.created_at ?? '').getTime() - new Date(b.broadcasted_at ?? b.created_at ?? '').getTime());
        }
        if (filterSort === 'top') {
          return [...base].sort((a, b) => (b.reaction_count ?? 0) - (a.reaction_count ?? 0));
        }
        return base;
    }
  }, [filteredFeed, searchContext, showTrendingOnly, activeCategory, filterSort, filterDatePreset, filterDuration]);

  const liveItems = useMemo(
    () => filteredFeed.filter(item => Boolean(item.is_live)),
    [filteredFeed],
  );

  const handleTrendingSeeAll = () => {
    setShowTrendingOnly(true);
    setActiveCategory('trending');
    if (typeof onTrendingSeeAll === 'function') {
      onTrendingSeeAll();
    }
  };

  const handleTrendingBack = () => {
    setShowTrendingOnly(false);
    setActiveCategory('for_you');
  };

  const activeFeedItems = showTrendingOnly ? trendingFeeds : displayItems;
  const buildBroadcastPermalink = useCallback((item: BroadcastFeedItem) => {
    return (
      (item as any).permalink ??
      (item as any).link ??
      (item as any).url ??
      `https://kis.app/broadcasts/${item.id}`
    );
  }, []);

  const handleOpenItem = useCallback(
    (item: BroadcastFeedItem) => {
      navigation.navigate('BroadcastDetail', {
        id: item.id,
        item,
        items: activeFeedItems,
        index: activeFeedItems.findIndex(feed => feed.id === item.id),
      });
    },
    [activeFeedItems, navigation],
  );

  const handleLike = useCallback(
    async (item: BroadcastFeedItem) => {
      const result = await reactToItem(item.id);
      if (!result?.ok) {
        Alert.alert('Reaction', 'Unable to react to this broadcast right now.');
      }
    },
    [reactToItem],
  );

  const handleShare = useCallback(
    async (item: BroadcastFeedItem) => {
      const permalink = buildBroadcastPermalink(item);
      const message = [
        item.title?.trim(),
        item.text_plain?.trim() || item.text?.trim(),
        permalink,
      ]
        .filter(Boolean)
        .join('\n\n');
      const shareResult = await Share.share({
        message,
        url: permalink,
        title: item.title ?? 'Broadcast',
      });
      if (!wasNativeShareCompleted(shareResult)) return;
      const result = await recordShare(item.id);
      if (!result?.ok) {
        Alert.alert('Share', 'Unable to log this share right now.');
      }
    },
    [buildBroadcastPermalink, recordShare],
  );

  const handleOpenComments = useCallback(async (item: BroadcastFeedItem) => {
    const res = await postRequest(
      ROUTES.broadcasts.commentRoom(item.id),
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
      name: item.title ?? item.source?.name ?? 'Broadcast comments',
      kind: 'broadcast_comments',
    });
  }, []);

  const handleMenu = useCallback(
    (item: BroadcastFeedItem) => {
      const authorId = resolveBroadcastPosterUserId(item);
      const permalink = buildBroadcastPermalink(item);
      const saveLabel = item.viewer_saved ? 'Remove saved post' : 'Save post';
      Alert.alert(item.title ?? 'Broadcast actions', undefined, [
        {
          text: 'Open',
          onPress: () => handleOpenItem(item),
        },
        {
          text: 'Comments',
          onPress: () => {
            void handleOpenComments(item);
          },
        },
        {
          text: saveLabel,
          onPress: async () => {
            const res = await toggleSaved(item.id, Boolean(item.viewer_saved));
            if (!res?.ok) {
              Alert.alert(
                'Saved posts',
                'Unable to update this saved post right now.',
              );
            }
          },
        },
        {
          text: 'Add to playlist',
          onPress: () => setPlaylistSheetItem(item),
        },
        {
          text: 'Copy link',
          onPress: () => {
            Clipboard.setString(permalink);
            Alert.alert('Link copied', 'Broadcast link saved to clipboard.');
          },
        },
        {
          text: 'Report',
          onPress: async () => {
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
            if (!res?.success) {
              Alert.alert('Report', res?.message || 'Unable to submit report.');
            }
          },
        },
        {
          text: 'Mute broadcaster',
          onPress: () => {
            if (!authorId) {
              Alert.alert('Mute poster', 'Unable to find this poster.');
              return;
            }
            Alert.alert(
              'Mute poster',
              'You will never see posts from this poster again.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, mute',
                  style: 'destructive',
                  onPress: async () => {
                    const res = await postRequest(
                      ROUTES.moderation.userBlocks,
                      { blocked: authorId, reason: 'broadcast_mute' },
                      { errorMessage: 'Unable to mute poster.' },
                    );
                    if (!res?.success) {
                      Alert.alert(
                        'Mute poster',
                        res?.message || 'Unable to mute this poster.',
                      );
                      return;
                    }
                    Alert.alert(
                      'Muted',
                      'You will no longer see posts from this poster.',
                    );
                    void refreshAll();
                  },
                },
              ],
            );
          },
        },
        {
          text: 'Hide',
          onPress: () => {
            Alert.alert('Hide post', 'You will never see this post again.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, hide',
                style: 'destructive',
                onPress: async () => {
                  const res = await hideItem(item.id);
                  if (!res?.ok) {
                    Alert.alert(
                      'Hide post',
                      'Unable to hide this post right now.',
                    );
                  }
                },
              },
            ]);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]);
    },
    [
      buildBroadcastPermalink,
      handleOpenComments,
      handleOpenItem,
      hideItem,
      refreshAll,
      toggleSaved,
      setPlaylistSheetItem,
    ],
  );

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshAll}
          tintColor={palette.primaryStrong}
          colors={[palette.primaryStrong]}
        />
      }
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const pad = 220;
        if (
          layoutMeasurement.height + contentOffset.y >=
          contentSize.height - pad
        ) {
          loadMore();
        }
      }}
      scrollEventThrottle={16}
    >
      {/* Active-filter chip strip — shows which filters are active so the user
          can see at a glance without opening the filter panel */}
      {(activeCategory !== 'for_you' || filterSort !== 'new' || filterDatePreset !== 'all' || filterDuration !== 'any') && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 6, paddingBottom: 4 }}
          style={{ flexShrink: 0, marginBottom: 4 }}
        >
          {activeCategory !== 'for_you' && (
            <View style={[styles.activeChip, { backgroundColor: palette.primarySoft, borderColor: palette.primaryStrong }]}>
              <Text style={[styles.activeChipText, { color: palette.primaryStrong }]}>
                {CATEGORIES.find(c => c.id === activeCategory)?.label ?? activeCategory}
              </Text>
            </View>
          )}
          {filterSort !== 'new' && (
            <View style={[styles.activeChip, { backgroundColor: palette.primarySoft, borderColor: palette.primaryStrong }]}>
              <Text style={[styles.activeChipText, { color: palette.primaryStrong }]}>
                {filterSort === 'top' ? 'Top' : 'Oldest'}
              </Text>
            </View>
          )}
          {filterDatePreset !== 'all' && (
            <View style={[styles.activeChip, { backgroundColor: palette.primarySoft, borderColor: palette.primaryStrong }]}>
              <Text style={[styles.activeChipText, { color: palette.primaryStrong }]}>
                {filterDatePreset === 'today' ? 'Today' : filterDatePreset === 'week' ? 'This week' : 'This month'}
              </Text>
            </View>
          )}
          {filterDuration !== 'any' && (
            <View style={[styles.activeChip, { backgroundColor: palette.primarySoft, borderColor: palette.primaryStrong }]}>
              <Text style={[styles.activeChipText, { color: palette.primaryStrong }]}>
                {filterDuration === 'short' ? 'Short' : filterDuration === 'medium' ? 'Medium' : 'Long'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={{ paddingHorizontal: 12, gap: 12 }}>
        {/* Feed settings row — quick access to blocked users management */}
        <Pressable
          onPress={() => navigation.navigate('BlockedContacts')}
          style={({ pressed }) => [
            styles.blockedRow,
            {
              backgroundColor: pressed ? palette.primarySoft : palette.surface,
              borderColor: palette.divider,
            },
          ]}
        >
          <View
            style={[
              styles.blockedRowIcon,
              { borderColor: palette.divider, backgroundColor: palette.card },
            ]}
          >
            <KISIcon name="shield" size={16} color={palette.primaryStrong} />
          </View>
          <Text style={[styles.blockedRowText, { color: palette.text }]}>
            Manage blocked users
          </Text>
          <KISIcon name="chevron-right" size={14} color={palette.subtext} />
        </Pressable>

        {/* Live items banner */}
        {liveItems.length > 0 && activeCategory !== 'live' && !showTrendingOnly && (
          <Pressable
            onPress={() => setActiveCategory('live')}
            style={({ pressed }) => [
              styles.liveBanner,
              {
                backgroundColor: pressed ? palette.primarySoft : palette.surface,
                borderColor: palette.danger,
              },
            ]}
          >
            <View style={[styles.livePulse, { backgroundColor: palette.danger }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.liveBannerText, { color: palette.danger }]}>
                {liveItems.length} live {liveItems.length === 1 ? 'broadcast' : 'broadcasts'} now
              </Text>
              <Text style={[styles.liveBannerSub, { color: palette.subtext }]}>
                Tap to watch
              </Text>
            </View>
            <KISIcon name="chevron-right" size={14} color={palette.danger} />
          </Pressable>
        )}

        {!showTrendingOnly && activeCategory === 'for_you' ? (
          <TrendingClipsSection
            items={trending}
            onSeeAll={handleTrendingSeeAll}
            onOpen={item => handleOpenItem(item as any)}
            onReact={item => { void handleLike(item as any); }}
          />
        ) : showTrendingOnly ? (
          <View style={styles.trendingButtonRow}>
            <Pressable
              onPress={handleTrendingBack}
              style={[
                styles.trendingButton,
                {
                  backgroundColor: palette.primarySoft,
                  borderColor: palette.primary,
                },
              ]}
            >
              <KISIcon name="arrow-left" size={14} color={palette.primaryStrong} />
              <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
                Back to feed
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Empty state for filtered categories */}
        {!loading && activeFeedItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              {activeCategory === 'live'
                ? 'No live broadcasts right now'
                : activeCategory === 'following'
                ? 'Follow channels and communities to see their posts here'
                : activeCategory === 'market'
                ? 'No market broadcasts in your feed'
                : 'Nothing here yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: palette.subtext }]}>
              {activeCategory === 'live'
                ? 'Check back soon — live sessions will appear when they start'
                : activeCategory === 'following'
                ? 'Subscribe to channels and join communities to build your feed'
                : 'Pull down to refresh'}
            </Text>
          </View>
        )}

        <FeedsMainListSection
          items={activeFeedItems}
          loading={loading}
          loadingMore={loadingMore}
          onRefresh={refreshAll}
          onOpenItem={handleOpenItem}
          onShare={item => {
            void handleShare(item);
          }}
          onLike={item => {
            void handleLike(item);
          }}
          onSave={item => {
            void toggleSaved(item.id, Boolean(item.viewer_saved));
          }}
          onComment={item => {
            void handleOpenComments(item);
          }}
          onMenu={handleMenu}
          onSubscribe={async (source, isSubscribed) => {
            const runToggle = async () => {
              const result = await toggleSubscribe(source, isSubscribed);
              if (!result?.ok) {
                Alert.alert(
                  isSubscribed ? 'Unsubscribe' : 'Subscribe',
                  isSubscribed
                    ? 'Unable to update this subscription right now.'
                    : 'Unable to subscribe to this source right now.',
                );
              }
            };

            if (isSubscribed) {
              Alert.alert(
                'Unsubscribe',
                `Stop following ${source.name ?? 'this source'}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Unsubscribe',
                    style: 'destructive',
                    onPress: () => {
                      void runToggle();
                    },
                  },
                ],
              );
              return;
            }

            await runToggle();
          }}
        />
      </View>

      <AddToPlaylistSheet
        item={playlistSheetItem}
        visible={Boolean(playlistSheetItem)}
        onClose={() => setPlaylistSheetItem(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  quickAccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 44,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  blockedRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedRowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  activeChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  filterTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  playlistsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  playlistsRowLeft: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistsRowText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  playlistsBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  playlistsBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  categoryRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
    minHeight: 44,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  livePulse: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  liveBannerText: {
    fontSize: 13,
    fontWeight: '900',
  },
  liveBannerSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  trendingButtonRow: {
    alignItems: 'center',
    marginVertical: 6,
  },
  trendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
  },
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
});
