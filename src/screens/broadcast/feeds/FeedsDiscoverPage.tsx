import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

import FeedsMainListSection from '@/screens/broadcast/feeds/sections/FeedsMainListSection';
import TrendingClipsSection from '@/screens/broadcast/feeds/sections/TrendingClipsSection';

import useFeedsData from '@/screens/broadcast/feeds/hooks/useFeedsData';

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
  } = useFeedsData({ q: searchTerm, code });

  const filteredFeed = useMemo(() => {
    // backend already filters by q, but keep safety for local quick filtering
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay =
        `${it.title ?? ''} ${it.text_plain ?? ''} ${it.source?.name ?? ''} ${it.author?.display_name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, searchTerm]);

  const displayItems = useMemo(() => {
    const nonHealthcare = filteredFeed.filter(
      (item) =>
        String(item.source_type || '').toLowerCase() !== 'healthcare' &&
        String(item.source?.type || '').toLowerCase() !== 'healthcare',
    );
    const context = (searchContext ?? '').trim().toLowerCase();
    if (!context || context === 'latest') {
      return nonHealthcare;
    }

    if (context === 'saved') {
      return nonHealthcare.filter((item) => Boolean(item.source?.is_subscribed));
    }

    if (context === 'trending') {
      return [...nonHealthcare].sort((a, b) => (b.reaction_count ?? 0) - (a.reaction_count ?? 0));
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
  console.log('FeedsDiscoverPage render: items count:',activeFeedItems);

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
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - pad) {
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
                style={[styles.trendingButton, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}
              >
                <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>Trending feeds</Text>
              </Pressable>
            </View>
          )}

        <FeedsMainListSection
          items={activeFeedItems}
          loading={loading}
          loadingMore={loadingMore}
          onRefresh={refreshAll}
          onOpenItem={() => {}}
          onShare={() => {}}
          onLike={() => {}}
          onSubscribe={async (source, isSubscribed) => {
            await toggleSubscribe(source, isSubscribed);
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
