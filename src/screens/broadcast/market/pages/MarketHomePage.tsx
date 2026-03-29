import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

import useMarketData from '@/screens/broadcast/market/hooks/useMarketData';
import MarketProductCard from '@/screens/broadcast/market/components/MarketProductCard';
import MarketShopCard from '@/screens/broadcast/market/components/MarketShopCard';
import FeaturedLessonHero from '@/screens/broadcast/education/sections/FeaturedLessonHero';

type Props = {
  ownerId?: string | null;
  searchTerm?: string;
};

export default function MarketHomePage({ ownerId = null, searchTerm = '' }: Props) {
  const { palette } = useKISTheme();
  const { home, loadingHome, subscribeProduct, joinShop, reloadAll } = useMarketData({
    ownerId,
    q: searchTerm,
  });

  const featuredTitle = home.featured_drop?.title ?? 'Market Drops';
  const featuredSubtitle =
    home.featured_drop?.shop_name
      ? `Featured drop by ${home.featured_drop.shop_name}`
      : 'Limited items · Verified shops · Credits checkout';

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ paddingHorizontal: 12, gap: 12 }}>
        <FeaturedLessonHero
          title={featuredTitle}
          subtitle={featuredSubtitle}
          coverUrl={home.featured_drop?.cover_url ?? null}
          badgeLeft={home.featured_drop?.is_live ? 'LIVE Drop' : 'Featured drop'}
          badgeRight={loadingHome ? 'Loading…' : 'Refresh'}
          onPress={reloadAll}
        />

        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 22,
            padding: 12,
            gap: 10,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Trending Products</Text>

          {home.trending_products?.length ? (
            <View style={{ gap: 12 }}>
              {home.trending_products.slice(0, 2).map((p) => {
                const price = p.price !== undefined && p.price !== null ? String(p.price) : '';
                const currency = p.currency ?? '';
                const priceLabel = price ? `Price ${currency ? `${currency} ` : ''}${price}` : '';
                const badge = p.badge ? String(p.badge).toUpperCase() : p.is_trending ? 'TREND' : undefined;

                return (
                  <MarketProductCard
                    key={p.id}
                    title={p.name ?? 'Product'}
                    subtitle={p.shop_name ?? p.description}
                    priceLabel={priceLabel}
                    coverUrl={p.image_url ?? null}
                    badgeText={badge}
                    ctaLabel="Subscribe"
                    onCTA={async () => {
                      const r = await subscribeProduct(p.id);
                      if (r.ok) Alert.alert('Market', 'Subscribed for updates.');
                    }}
                    onPress={() => {}}
                  />
                );
              })}
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>
              No trending products yet.
            </Text>
          )}
        </View>

        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 22,
            padding: 12,
            gap: 10,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Popular Shops</Text>

          {home.popular_shops?.length ? (
            <View style={{ gap: 12 }}>
              {home.popular_shops.slice(0, 2).map((s) => (
                <MarketShopCard
                  key={s.id}
                  name={s.name ?? 'Shop'}
                  description={s.description}
                  coverUrl={s.image_url ?? null}
                  verified={Boolean(s.verified)}
                  ctaLabel="Join shop"
                  onCTA={async () => {
                    const r = await joinShop(s.id);
                    if (r.ok) Alert.alert('Market', 'Shop joined.');
                  }}
                  onPress={() => {}}
                />
              ))}
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontWeight: '700' }}>
              No shops yet.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
