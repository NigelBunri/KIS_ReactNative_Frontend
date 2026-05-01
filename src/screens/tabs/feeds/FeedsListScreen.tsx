import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
    ({ item, index }: { item: any; index: number }) => (
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
      />
    ),
    [handleReact, items, navigation],
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
      contentContainerStyle={styles.list}
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
