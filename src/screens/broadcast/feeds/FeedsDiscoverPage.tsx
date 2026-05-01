import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
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

type Props = {
  searchTerm?: string;
  searchContext?: string;
  code?: string | null;
  onTrendingSeeAll?: () => void;
};

export default function FeedsDiscoverPage({
  searchTerm = '',
  searchContext = '',
  code = null,
  onTrendingSeeAll,
}: Props) {
  const { palette } = useKISTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [showTrendingOnly, setShowTrendingOnly] = useState(false);
  const styles = useMemo(() => makeStyles(), []);

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
    // backend already filters by q, but keep safety for local quick filtering
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => {
      const hay = `${it.title ?? ''} ${it.text_plain ?? ''} ${
        it.source?.name ?? ''
      } ${it.author?.display_name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, searchTerm]);

  const displayItems = useMemo(() => {
    const nonHealthcare = filteredFeed.filter(
      item =>
        String(item.source_type || '').toLowerCase() !== 'healthcare' &&
        String(item.source?.type || '').toLowerCase() !== 'healthcare',
    );
    const context = (searchContext ?? '').trim().toLowerCase();
    if (!context || context === 'latest') {
      return nonHealthcare;
    }

    if (context === 'saved') {
      return nonHealthcare.filter(item => Boolean(item.viewer_saved));
    }

    if (context === 'trending') {
      return [...nonHealthcare].sort(
        (a, b) => (b.reaction_count ?? 0) - (a.reaction_count ?? 0),
      );
    }

    return nonHealthcare;
  }, [filteredFeed, searchContext]);

  const handleTrendingSeeAll = () => {
    setShowTrendingOnly(true);
    if (typeof onTrendingSeeAll === 'function') {
      onTrendingSeeAll();
    }
  };

  const handleTrendingBack = () => {
    setShowTrendingOnly(false);
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
      <View style={{ paddingHorizontal: 12, gap: 12 }}>
        {!showTrendingOnly ? (
          <TrendingClipsSection
            items={trending}
            onSeeAll={handleTrendingSeeAll}
            onOpen={() => {}}
            onReact={() => {}}
          />
        ) : (
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
              <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
                Trending feeds
              </Text>
            </Pressable>
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
    </ScrollView>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    trendingButtonRow: {
      alignItems: 'center',
      marginVertical: 12,
    },
    trendingButton: {
      paddingHorizontal: 28,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 2,
    },
  });
