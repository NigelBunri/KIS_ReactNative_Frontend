import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import MarketTabPills, { MarketTabId } from '@/screens/broadcast/market/components/MarketTabPills';
import MarketHomePage from '@/screens/broadcast/market/pages/MarketHomePage';
import MarketDropsPage from '@/screens/broadcast/market/pages/MarketDropsPage';
import MarketShopsPage from '@/screens/broadcast/market/pages/MarketShopsPage';
import MarketProductsPage from '@/screens/broadcast/market/pages/MarketProductsPage';
import MarketInsightsPage from '@/screens/broadcast/market/pages/MarketInsightsPage';

type Props = {
  ownerId?: string | null;
  searchTerm?: string;

  canUseMarket?: boolean;
  onUpgrade?: () => void;

  hasAnalyticsAccess?: boolean;
  isMarketPro?: boolean;
};

export default function MarketSection({
  ownerId = null,
  searchTerm = '',
  canUseMarket = false,
  onUpgrade,
  hasAnalyticsAccess = false,
  isMarketPro = false,
}: Props) {
  const [tab, setTab] = useState<MarketTabId>('home');

  const body = useMemo(() => {
    if (tab === 'home') return <MarketHomePage ownerId={ownerId} searchTerm={searchTerm} />;
    if (tab === 'drops') return <MarketDropsPage ownerId={ownerId} searchTerm={searchTerm} />;
    if (tab === 'shops') return <MarketShopsPage ownerId={ownerId} canUseMarket={canUseMarket} onUpgrade={onUpgrade} />;
    if (tab === 'products') return <MarketProductsPage ownerId={ownerId} />;
    return <MarketInsightsPage hasAnalyticsAccess={hasAnalyticsAccess} isMarketPro={isMarketPro} onUpgrade={onUpgrade} />;
  }, [tab, ownerId, searchTerm, canUseMarket, onUpgrade, hasAnalyticsAccess, isMarketPro]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}>
        <MarketTabPills value={tab} onChange={setTab} />
      </View>
      {body}
    </View>
  );
}
