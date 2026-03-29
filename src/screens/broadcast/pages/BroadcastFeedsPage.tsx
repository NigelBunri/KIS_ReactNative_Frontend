import React from 'react';
import { View } from 'react-native';
import FeedsDiscoverPage from '@/screens/broadcast/feeds/FeedsDiscoverPage';

type Props = {
  searchTerm?: string;
  searchContext?: string;
  onTrendingSeeAll?: () => void;
};

export default function BroadcastFeedsPage({ searchTerm = '', searchContext, onTrendingSeeAll }: Props) {
  return (
    <View style={{ marginTop: 10 }}>
      <FeedsDiscoverPage
        searchTerm={searchTerm}
        searchContext={searchContext}
        onTrendingSeeAll={onTrendingSeeAll}
      />
    </View>
  );
}
