import React from 'react';
import { View } from 'react-native';
import FeedsDiscoverPage from '@/screens/broadcast/feeds/FeedsDiscoverPage';

type FeedCategory = 'for_you' | 'following' | 'trending' | 'live' | 'channels' | 'community' | 'market' | 'education';

type Props = {
  searchTerm?: string;
  searchContext?: string;
  onTrendingSeeAll?: () => void;
  // Filter controls lifted to BroadcastScreen so the filter panel owns them
  activeCategory?: FeedCategory;
  onCategoryChange?: (cat: FeedCategory) => void;
  filterSort?: 'new' | 'top' | 'oldest';
  filterDatePreset?: 'today' | 'week' | 'month' | 'all';
  filterDuration?: 'short' | 'medium' | 'long' | 'any';
};

export default function BroadcastFeedsPage({
  searchTerm = '',
  searchContext,
  onTrendingSeeAll,
  activeCategory,
  onCategoryChange,
  filterSort,
  filterDatePreset,
  filterDuration,
}: Props) {
  return (
    <View style={{ marginTop: 10 }}>
      <FeedsDiscoverPage
        searchTerm={searchTerm}
        searchContext={searchContext}
        onTrendingSeeAll={onTrendingSeeAll}
        activeCategory={activeCategory}
        onCategoryChange={onCategoryChange}
        filterSort={filterSort}
        filterDatePreset={filterDatePreset}
        filterDuration={filterDuration}
      />
    </View>
  );
}
