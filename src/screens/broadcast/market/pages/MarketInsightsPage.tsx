import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import useMarketData from '@/screens/broadcast/market/hooks/useMarketData';
import { MarketProduct } from '@/screens/broadcast/market/api/market.types';

type Props = {
  ownerId?: string | null;
  hasAnalyticsAccess?: boolean;
  isMarketPro?: boolean;
  onUpgrade?: () => void;
};

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

function categoryLabel(p: MarketProduct): string {
  return p.category?.name ?? 'Uncategorized';
}

type CategoryStat = { name: string; count: number; avgPrice: number };

function buildCategoryStats(products: MarketProduct[]): CategoryStat[] {
  const byCategory = new Map<string, { count: number; total: number }>();
  for (const p of products) {
    const name = categoryLabel(p);
    const price = toNumber(p.price) ?? 0;
    const entry = byCategory.get(name) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += price;
    byCategory.set(name, entry);
  }
  return Array.from(byCategory.entries())
    .map(([name, { count, total }]) => ({ name, count, avgPrice: count > 0 ? total / count : 0 }))
    .sort((a, b) => b.count - a.count);
}

function buildDiscountedProducts(products: MarketProduct[]): MarketProduct[] {
  return products.filter((p) => {
    const price = toNumber(p.price);
    const sale = toNumber(p.sale_price);
    return price !== null && sale !== null && sale < price;
  });
}

export default function MarketInsightsPage({ ownerId = null, hasAnalyticsAccess, isMarketPro, onUpgrade }: Props) {
  const { palette } = useKISTheme();
  const { home, loadingHome } = useMarketData({ ownerId });
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const trending = home.trending_products ?? [];
  const categoryStats = useMemo(() => buildCategoryStats(trending), [trending]);
  const discounted = useMemo(() => buildDiscountedProducts(trending), [trending]);
  const showUpgrade = !hasAnalyticsAccess && !isMarketPro;

  if (loadingHome && trending.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primaryStrong} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: palette.card }]}>
          <KISIcon name="bar-chart-outline" size={36} color={palette.primaryStrong} />
        </View>
        <Text style={styles.title}>Market Insights</Text>
        <Text style={styles.subtitle}>
          A live snapshot of what's trending and discounted across the Market right now.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending by category</Text>
        {categoryStats.length === 0 ? (
          <Text style={styles.emptyText}>No trending data yet.</Text>
        ) : (
          categoryStats.map((c) => (
            <View key={c.name} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {c.count} trending item{c.count !== 1 ? 's' : ''} · avg ${c.avgPrice.toFixed(2)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active discounts</Text>
        {discounted.length === 0 ? (
          <Text style={styles.emptyText}>No active discounts among trending products.</Text>
        ) : (
          discounted.slice(0, 10).map((p) => {
            const price = toNumber(p.price) ?? 0;
            const sale = toNumber(p.sale_price) ?? 0;
            const pct = price > 0 ? Math.round(((price - sale) / price) * 100) : 0;
            return (
              <View key={p.id} style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{p.name ?? 'Product'}</Text>
                  <Text style={styles.rowSubtitle}>
                    ${sale.toFixed(2)} (was ${price.toFixed(2)}) · {p.shop_name ?? 'Shop'}
                  </Text>
                </View>
                <View style={[styles.discountBadge, { backgroundColor: palette.danger }]}>
                  <Text style={styles.discountBadgeText}>-{pct}%</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {showUpgrade && onUpgrade ? (
        <Pressable onPress={onUpgrade} style={[styles.upgradeBtn, { borderColor: palette.primary, backgroundColor: palette.primarySoft }]}>
          <Text style={[styles.upgradeBtnText, { color: palette.primaryStrong }]}>
            Upgrade for deeper revenue &amp; campaign analytics
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(palette: any) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 80, gap: 24 },
    header: { alignItems: 'center', gap: 10, paddingBottom: 4 },
    iconWrap: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '900', color: palette.text, textAlign: 'center' },
    subtitle: { fontSize: 14, fontWeight: '600', color: palette.subtext, textAlign: 'center', lineHeight: 20 },
    section: { gap: 10 },
    sectionTitle: { fontSize: 15, fontWeight: '900', color: palette.text },
    emptyText: { fontSize: 13, color: palette.subtext, fontStyle: 'italic' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      backgroundColor: palette.card,
      borderColor: palette.divider,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },
    rowInfo: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 14, fontWeight: '800', color: palette.text },
    rowSubtitle: { fontSize: 12, color: palette.subtext },
    discountBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    discountBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
    upgradeBtn: {
      borderWidth: 2,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 12,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    upgradeBtnText: { fontSize: 14, fontWeight: '900' },
  });
}
