import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import OfflineDataBadge from '@/components/offline/OfflineDataBadge';

import useMarketData from '@/screens/broadcast/market/hooks/useMarketData';
import MarketProductCard from '@/screens/broadcast/market/components/MarketProductCard';
import MarketShopCard from '@/screens/broadcast/market/components/MarketShopCard';
import { MarketDrop, MarketProduct } from '@/screens/broadcast/market/api/market.types';

const fallbackCover = require('@/assets/logo-light.png');

type CategoryId = 'all' | 'trending' | 'drops' | 'electronics' | 'fashion' | 'home' | 'services';

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'drops', label: '⚡ Drops' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'home', label: 'Home' },
  { id: 'services', label: 'Services' },
];

function useCountdown(endsAt?: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const target = new Date(endsAt).getTime();
    const tick = () => {
      const diff = target - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

function DropCountdownBadge({ drop }: { drop: MarketDrop }) {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const remaining = useCountdown(drop.ends_at);
  const imgSource = drop.cover_url ? { uri: drop.cover_url } : fallbackCover;

  return (
    <Pressable
      onPress={() => drop.shop_id ? navigation.navigate('ShopProducts', { shopId: drop.shop_id, shopName: drop.shop_name ?? undefined }) : undefined}
      style={{
        width: 200,
        borderWidth: 1.5,
        borderColor: drop.is_live ? '#e74c3c' : palette.primary,
        backgroundColor: palette.surface,
        borderRadius: 18,
        overflow: 'hidden',
        marginRight: 12,
      }}
    >
      <View style={{ height: 100 }}>
        <Image source={imgSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
        {drop.is_live && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: '#e74c3c',
              borderRadius: 6,
              paddingHorizontal: 7,
              paddingVertical: 3,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>LIVE</Text>
          </View>
        )}
      </View>
      <View style={{ padding: 10, gap: 4 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 13 }} numberOfLines={1}>
          {drop.title ?? 'Drop'}
        </Text>
        {drop.shop_name && (
          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 11 }} numberOfLines={1}>
            {drop.shop_name}
          </Text>
        )}
        {remaining !== null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <KISIcon name="time-outline" size={12} color={remaining < 3600000 ? '#e74c3c' : palette.subtext} />
            <Text
              style={{
                color: remaining < 3600000 ? '#e74c3c' : palette.subtext,
                fontWeight: '800',
                fontSize: 12,
                fontVariant: ['tabular-nums'],
              }}
            >
              {remaining === 0 ? 'Ended' : formatCountdown(remaining)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const { palette } = useKISTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>See all ›</Text>
        </Pressable>
      )}
    </View>
  );
}

function PulseDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#e74c3c',
        transform: [{ scale: anim }],
      }}
    />
  );
}

type Props = {
  ownerId?: string | null;
  searchTerm?: string;
  onSeeAllProducts?: () => void;
  onSeeAllShops?: () => void;
};

export default function MarketHomePage({ ownerId = null, searchTerm = '', onSeeAllProducts, onSeeAllShops }: Props) {
  const { palette } = useKISTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { home, loadingHome, homeCacheMeta, subscribeProduct, joinShop, reloadAll } = useMarketData({
    ownerId,
    q: searchTerm,
  });

  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const featuredCountdown = useCountdown(home.featured_drop?.ends_at);

  const filteredProducts = useMemo<MarketProduct[]>(() => {
    const products = home.trending_products ?? [];
    if (activeCategory === 'all' || activeCategory === 'trending') return products;
    if (activeCategory === 'drops') {
      return products.filter((p) => p.badge === 'drop' || p.badge === 'limited' || p.badge === 'exclusive');
    }
    return products.filter(
      (p) =>
        p.category?.slug === activeCategory ||
        p.categories?.includes(activeCategory) ||
        p.catalog_categories?.some((c) => c.slug === activeCategory),
    );
  }, [home.trending_products, activeCategory]);

  const liveDrops = useMemo(() => (home.drops ?? []).filter((d) => d.is_live), [home.drops]);
  const upcomingDrops = useMemo(() => (home.drops ?? []).filter((d) => !d.is_live), [home.drops]);
  const allDrops = useMemo(() => [...liveDrops, ...upcomingDrops], [liveDrops, upcomingDrops]);

  const featuredDrop = home.featured_drop;
  const featuredImgSource = featuredDrop?.cover_url ? { uri: featuredDrop.cover_url } : fallbackCover;

  const handleSubscribeProduct = useCallback(
    async (id: string) => {
      const r = await subscribeProduct(id);
      if (r.ok) Alert.alert('Market', 'Subscribed! You\'ll be notified of updates.');
    },
    [subscribeProduct],
  );

  const handleJoinShop = useCallback(
    async (id: string) => {
      const r = await joinShop(id);
      if (r.ok) Alert.alert('Market', 'Shop joined! Welcome aboard.');
    },
    [joinShop],
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ gap: 20 }}>
        <OfflineDataBadge meta={homeCacheMeta} style={{ marginHorizontal: 12, marginTop: 12 }} />

        {/* Hero Banner */}
        <Pressable onPress={reloadAll} style={{ marginHorizontal: 12 }}>
          <View style={{ borderRadius: 24, overflow: 'hidden', height: 200 }}>
            <Image source={featuredImgSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {featuredDrop?.is_live ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: '#e74c3c',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <PulseDot />
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>LIVE DROP</Text>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.5)',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>
                    {loadingHome ? 'Loading…' : 'Featured Drop'}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, gap: 6 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}>
                {featuredDrop?.title ?? 'Market Drops'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 13 }}>
                {featuredDrop?.shop_name
                  ? `By ${featuredDrop.shop_name}`
                  : 'Limited items · Verified shops · USD checkout'}
              </Text>
              {featuredCountdown !== null && featuredCountdown > 0 && (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: featuredCountdown < 3600000 ? '#e74c3c' : 'rgba(0,0,0,0.5)',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <KISIcon name="time-outline" size={13} color="#fff" />
                  <Text
                    style={{ color: '#fff', fontWeight: '900', fontSize: 13, fontVariant: ['tabular-nums'] }}
                  >
                    {formatCountdown(featuredCountdown)} left
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8, flexDirection: 'row' }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                style={{
                  borderWidth: 1.5,
                  borderColor: isActive ? palette.primary : palette.divider,
                  backgroundColor: isActive ? palette.primarySoft : palette.surface,
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: isActive ? palette.primaryStrong : palette.subtext,
                    fontWeight: '800',
                    fontSize: 13,
                  }}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Flash Deals / Drops section */}
        {allDrops.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>⚡ Flash Drops</Text>
              {liveDrops.length > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#e74c3c',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <PulseDot />
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>
                    {liveDrops.length} LIVE
                  </Text>
                </View>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12 }}
            >
              {allDrops.slice(0, 8).map((d) => (
                <DropCountdownBadge key={d.id} drop={d} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Trending Products 2-column grid */}
        <View style={{ paddingHorizontal: 12, gap: 10 }}>
          <SectionHeader
            title={activeCategory === 'all' ? 'Trending Products' : `${CATEGORIES.find((c) => c.id === activeCategory)?.label ?? ''} Products`}
            onSeeAll={onSeeAllProducts}
          />

          {filteredProducts.length > 0 ? (
            <View style={{ gap: 10 }}>
              {chunkArray(filteredProducts.slice(0, 6), 2).map((row, rowIdx) => (
                <View key={rowIdx} style={{ flexDirection: 'row', gap: 10 }}>
                  {row.map((p) => {
                    const rating = p.review_summary?.average;
                    const reviewCount = p.review_summary?.count;
                    const badge = p.badge ? String(p.badge).toUpperCase() : p.is_trending ? 'TREND' : undefined;

                    return (
                      <MarketProductCard
                        key={p.id}
                        title={p.name ?? 'Product'}
                        subtitle={p.shop_name ?? p.description}
                        price={p.price !== undefined && p.price !== null ? String(p.price) : undefined}
                        salePrice={p.sale_price !== undefined && p.sale_price !== null ? String(p.sale_price) : undefined}
                        compareAtPrice={p.compare_at_price !== undefined && p.compare_at_price !== null ? String(p.compare_at_price) : undefined}
                        coverUrl={p.image_url ?? null}
                        badgeText={badge}
                        stockQty={p.stock_qty}
                        stockStatus={p.fulfillment_summary?.stock_status}
                        rating={rating}
                        reviewCount={reviewCount}
                        ctaLabel="View"
                        compact
                        onCTA={() => handleSubscribeProduct(p.id)}
                        onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                      />
                    );
                  })}
                  {row.length === 1 && <View style={{ flex: 1 }} />}
                </View>
              ))}
            </View>
          ) : (
            <View
              style={{
                borderWidth: 1.5,
                borderColor: palette.divider,
                backgroundColor: palette.card,
                borderRadius: 18,
                padding: 24,
                alignItems: 'center',
                gap: 8,
              }}
            >
              <KISIcon name="cube-outline" size={32} color={palette.subtext} />
              <Text style={{ color: palette.subtext, fontWeight: '700', textAlign: 'center' }}>
                No products in this category yet.
              </Text>
            </View>
          )}
        </View>

        {/* Popular Shops horizontal scroll */}
        {(home.popular_shops ?? []).length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Popular Shops</Text>
              <Pressable onPress={onSeeAllShops}>
                <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 13 }}>See all ›</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 12, flexDirection: 'row' }}
            >
              {home.popular_shops!.slice(0, 6).map((s) => (
                <View key={s.id} style={{ width: 220 }}>
                  <MarketShopCard
                    name={s.name ?? 'Shop'}
                    description={s.description}
                    coverUrl={s.image_url ?? null}
                    verified={Boolean(s.verified || s.is_verified || s.seller_trust?.verified)}
                    trustLabel={s.seller_trust?.label}
                    trustBadges={s.seller_trust?.badges ?? s.trust_badges}
                    isMember={Boolean(s.is_member)}
                    ctaLabel={s.join_policy === 'request' ? 'Request to join' : 'Join shop'}
                    onCTA={() => handleJoinShop(s.id)}
                    onPress={() => navigation.navigate('ShopProducts', { shopId: s.id, shopName: s.name ?? undefined })}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Market perks strip */}
        <View style={{ marginHorizontal: 12 }}>
          <View
            style={{
              borderWidth: 1.5,
              borderColor: palette.divider,
              backgroundColor: palette.card,
              borderRadius: 20,
              padding: 16,
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}
          >
            {[
              { icon: 'shield-checkmark-outline', label: 'Buyer\nProtection' },
              { icon: 'flash-outline', label: 'Fast\nDelivery' },
              { icon: 'card-outline', label: 'USD\nCheckout' },
              { icon: 'headset-outline', label: '24/7\nSupport' },
            ].map((item) => (
              <View key={item.label} style={{ alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: palette.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <KISIcon name={item.icon as any} size={20} color={palette.primaryStrong} />
                </View>
                <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 10, textAlign: 'center' }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
