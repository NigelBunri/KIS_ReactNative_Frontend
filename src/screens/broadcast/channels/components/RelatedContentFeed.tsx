// src/screens/broadcast/channels/components/RelatedContentFeed.tsx
//
// YouTube-style "related content" feed rendered below the main video info
// on LiveWatchPage.tsx. Fetches from ChannelLiveStreamRelatedView (backend),
// which ranks primarily by topic relevance - see that view's own docstring
// for the scoring approach. Grouped into sections ("Live now", "Related
// topics", "More from this creator", "Recommended") only when a section
// actually has eligible items.
//
// Fully supplementary: a failed/empty/slow backend never blocks or breaks
// video playback above it - see fetchLiveStreamRelated's own error handling.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { fetchLiveStreamRelated } from '../hooks/useChannelsData';
import type { BroadcastChannelContent } from '../api/channels.types';
import RelatedContentCard from './RelatedContentCard';

const SECTION_TITLES: Record<string, string> = {
  live_now: 'Live now',
  related_topic: 'Related to this stream',
  more_from_creator: 'More from this creator',
  recommended: 'Recommended for you',
};

const SECTION_ORDER = ['live_now', 'related_topic', 'more_from_creator', 'recommended'];

export default function RelatedContentFeed({
  streamId,
  palette,
}: {
  streamId: string;
  palette: any;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<BroadcastChannelContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!streamId) { setLoading(false); return; }
    setLoading(true);
    setItems([]);
    setCursor(null);
    fetchLiveStreamRelated(streamId).then(page => {
      if (cancelled) return;
      setItems(page.results);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [streamId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchLiveStreamRelated(streamId, cursor);
      setItems(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...page.results.filter(r => !seen.has(r.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, streamId]);

  const openItem = useCallback((item: BroadcastChannelContent) => {
    // Same rule ChannelHomePage.tsx's openContent already establishes:
    // content_type === 'live_stream' means this row's own id is a
    // ChannelContent id, not the ChannelLiveStream id the watch screen
    // actually fetches by - live_stream_id is the correct identifier for
    // that case (see ChannelContentListSerializer.get_live_stream_id).
    if (item.content_type === 'live_stream') {
      navigation.navigate('LiveWatch', { streamId: item.live_stream_id || item.id, stream: item as any });
    } else {
      navigation.navigate('ChannelContentDetail', { contentId: item.id, item, channel: item.channel });
    }
  }, [navigation]);

  if (!loading && items.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={palette.subtext} />
      </View>
    );
  }

  const bySection: Record<string, BroadcastChannelContent[]> = {};
  for (const item of items) {
    const key = item.section && SECTION_TITLES[item.section] ? item.section : 'recommended';
    (bySection[key] ||= []).push(item);
  }
  const sections = SECTION_ORDER.filter(key => bySection[key]?.length);

  return (
    <View style={styles.container}>
      {sections.map(key => (
        <View key={key} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{SECTION_TITLES[key]}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              if (key !== sections[sections.length - 1]) return;
              if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 200) {
                void loadMore();
              }
            }}
            scrollEventThrottle={200}
          >
            {bySection[key].map(item => (
              <RelatedContentCard
                key={item.id}
                content={item}
                palette={palette}
                onPress={() => openItem(item)}
              />
            ))}
            {loadingMore && key === sections[sections.length - 1] && (
              <View style={styles.trailingLoader}>
                <ActivityIndicator color={palette.subtext} />
              </View>
            )}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 18,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  rail: {
    paddingRight: 4,
  },
  trailingLoader: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
