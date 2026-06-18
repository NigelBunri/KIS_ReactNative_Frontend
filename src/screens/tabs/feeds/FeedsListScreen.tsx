import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import FeedItemCard from '@/components/broadcast/FeedItemCard';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { useBroadcastFeed } from '@/hooks/useBroadcastFeed';
import { useKISTheme } from '@/theme/useTheme';

import type { FeedsStackParamList } from './FeedsNavigator';

const REACTION_EVENT = 'broadcast.reaction';

export default function FeedsListScreen() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<FeedsStackParamList, 'FeedsList'>
    >();

  const {
    items,
    loading,
    loadingMore,
    hasMore,
    refresh,
    loadMore,
    updateItem,
  } = useBroadcastFeed();

  // Track locally-subscribed channel IDs for optimistic UI.
  const [subscribedChannels, setSubscribedChannels] = useState<Set<string>>(
    new Set(),
  );

  const handleSubscribe = useCallback(
    async (item: any) => {
      const channelId: string | undefined =
        item?.metadata?.channel_id ??
        item?.metadata?.channel?.id ??
        item?.channel_id ??
        item?.channel?.id;
      if (!channelId) return;

      // Optimistic update — mark subscribed immediately.
      setSubscribedChannels(prev => {
        const next = new Set(prev);
        next.add(channelId);
        return next;
      });

      try {
        const response = await postRequest(
          ROUTES.broadcasts.channelSubscribe(channelId),
          {},
          { errorMessage: 'Unable to subscribe to channel.' },
        );
        if (!response?.success) {
          throw new Error(response?.message ?? 'Subscribe failed');
        }
      } catch {
        // Rollback on failure.
        setSubscribedChannels(prev => {
          const next = new Set(prev);
          next.delete(channelId);
          return next;
        });
      }
    },
    [],
  );

  const handleReact = useCallback(
    async (broadcastId: string) => {
      updateItem(broadcastId, item => ({
        ...item,
        engagement: {
          ...item.engagement,
          reactions: item.engagement.reactions + 1,
        },
      }));
      try {
        const response = await postRequest(
          ROUTES.broadcasts.react(broadcastId),
          { type: 'like' },
          { errorMessage: 'Unable to register reaction.' },
        );
        if (!response?.success) {
          throw new Error(response?.message ?? 'Reaction failed');
        }
        DeviceEventEmitter.emit(REACTION_EVENT, { id: broadcastId, delta: 1 });
      } catch {
        updateItem(broadcastId, item => ({
          ...item,
          engagement: {
            ...item.engagement,
            reactions: Math.max(item.engagement.reactions - 1, 0),
          },
        }));
      }
    },
    [updateItem],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const channelId: string | undefined =
        item?.metadata?.channel_id ??
        item?.metadata?.channel?.id ??
        item?.channel_id ??
        item?.channel?.id;
      const isSubscribed =
        item?.metadata?.channel?.is_subscribed === true ||
        item?.channel?.is_subscribed === true ||
        (channelId != null && subscribedChannels.has(channelId));

      return (
        <FeedItemCard
          item={item}
          onPress={() =>
            navigation.navigate('BroadcastDetail', {
              id: item.id,
              item,
              items,
              index,
            })
          }
          onReact={() => handleReact(item.id)}
          isSubscribed={isSubscribed}
          onSubscribe={channelId ? () => handleSubscribe(item) : undefined}
        />
      );
    },
    [handleReact, handleSubscribe, items, navigation, subscribedChannels],
  );

  const listEmpty = (
    <View style={styles.empty}>
      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : (
        <Text style={[styles.emptyText, { color: palette.subtext }]}>
          No feeds yet.
        </Text>
      )}
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {loadingMore ? <ActivityIndicator color={palette.primary} /> : null}
      {!hasMore && items.length > 0 ? (
        <Text style={[styles.footerText, { color: palette.subtext }]}>
          You’re all caught up
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={footer}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasMore && !loadingMore) {
          loadMore();
        }
      }}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={palette.primary}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: 10,
  },
  empty: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  },
});
