import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import type { KISPalette } from '@/theme/constants';
import { marketStyles } from '@/screens/market/market.styles';
import { resolveShopImageUri } from '@/utils/shopAssets';

type MarketManagementModalProps = {
  palette: KISPalette;
  title: string;
  subtitle: string;
  shops: any[];
  loading?: boolean;
  onCreateShop: () => void;
  onEditShop: (shop: any) => void;
  onViewDashboard: (shop: any) => void;
  onOpenLandingBuilder?: (shop?: any) => void;
  onRefresh?: () => void;
};

const formatCurrency = (value: number, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency === 'USD' ? '$' : ''}${value.toFixed(0)}`;
  }
};

export function MarketManagementModal(props: MarketManagementModalProps) {
  const { palette, title, subtitle, shops, loading, onCreateShop, onEditShop, onViewDashboard, onOpenLandingBuilder, onRefresh } = props;

  const totalProducts = useMemo(
    () =>
      shops.reduce((sum, shop) => {
        const count = Array.isArray(shop?.products) ? shop.products.length : Number(shop?.products ?? 0);
        return sum + (Number.isFinite(count) ? count : 0);
      }, 0),
    [shops],
  );

  const totalServices = useMemo(
    () =>
      shops.reduce((sum, shop) => sum + Number(shop?.services?.length ?? shop?.service_slots ?? 0), 0),
    [shops],
  );

  const totalMembers = useMemo(
    () =>
      shops.reduce((sum, shop) => sum + Number(shop?.members_count ?? shop?.members ?? 0), 0),
    [shops],
  );

  const totalRevenue = useMemo(
    () =>
      shops.reduce((sum, shop) => sum + Number(shop?.revenue_total ?? shop?.live_revenue ?? 0), 0),
    [shops],
  );

  const heroAnalytics = useMemo(
    () => [
      { label: 'Total shops', value: shops.length },
      { label: 'Products', value: totalProducts },
      { label: 'Services', value: totalServices },
      { label: 'Members', value: totalMembers },
      { label: 'Revenue', value: formatCurrency(totalRevenue) },
    ],
    [shops.length, totalProducts, totalServices, totalMembers, totalRevenue],
  );

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, gap: 16 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(loading)} onRefresh={onRefresh} tintColor={palette.primaryStrong} />
        ) : undefined
      }
    >
      <View
        style={[
          marketStyles.heroCard,
          { backgroundColor: palette.primarySoft, borderColor: palette.primaryStrong, borderWidth: 1 },
        ]}
      >
        <View style={marketStyles.heroCTA}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: palette.text }}>Your Market Empire</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>{subtitle}</Text>
          </View>
          <KISButton title="Create shop" onPress={onCreateShop} />
        </View>
      </View>
      {loading && (
        <View
          style={[
            marketStyles.heroCard,
            {
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.divider,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            },
          ]}
        >
          <ActivityIndicator size="small" color={palette.primaryStrong} />
          <Text style={[marketStyles.meta, { color: palette.subtext }]}>Refreshing shops…</Text>
        </View>
      )}

      <View style={marketStyles.analyticsRow}>
        {heroAnalytics.map((metric) => (
          <View
            key={metric.label}
            style={[
              marketStyles.analyticsCard,
              { borderColor: palette.divider, backgroundColor: palette.surface },
            ]}
          >
            <Text style={[marketStyles.analyticsValue, { color: palette.text }]}>{metric.value}</Text>
            <Text style={[marketStyles.analyticsLabel, { color: palette.subtext }]}>{metric.label}</Text>
          </View>
        ))}
      </View>

      {shops.length === 0 ? (
        <View
          style={[
            marketStyles.emptyState,
            { borderColor: palette.divider, backgroundColor: palette.card, borderWidth: 1 },
          ]}
        >
          <KISIcon name="sparkles" size={28} color={palette.primaryStrong} />
          <Text style={[marketStyles.emptyTitle, { color: palette.text }]}>Build your first global shop</Text>
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>
            Launch a storefront for products, services, or both—with advanced analytics, member discounts, and a public landing page.
          </Text>
          <KISButton title="Create Shop" onPress={onCreateShop} />
        </View>
      ) : (
        <View style={marketStyles.shopGrid}>
          {shops.map((shop) => {
            const status = shop?.status ?? 'active';
            const tagline = shop?.tagline || 'Premium storefront';
            const category = shop?.category || 'Global commerce';
            const bannerImageUri = resolveShopImageUri(shop);

            return (
              <View
                key={shop.id ?? shop.name}
                style={[
                  marketStyles.shopCard,
                  {
                    backgroundColor: palette.background,
                    borderColor: `${palette.primaryStrong}40`,
                    borderWidth: 1.5,
                    width: '100%',
                    shadowColor: palette.primaryStrong,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  },
                ]}
              >
                <View
                  style={[
                    marketStyles.shopCardBanner,
                    { backgroundColor: palette.primarySoft },
                  ]}
                >
                  {bannerImageUri ? (
                    <Image source={{ uri: bannerImageUri }} style={marketStyles.shopCardBannerImage} />
                  ) : null}
                  <View style={marketStyles.shopCardBannerContent}>
                    <Text style={[marketStyles.shopCardBannerTitle, { color: palette.primaryStrong }]}>
                      {shop.name}
                    </Text>
                    <Text style={{ color: 'white', fontSize: 12 }}>{category}</Text>
                  </View>
                </View>
                <View style={marketStyles.shopCardBody}>
                  <View style={marketStyles.shopMetaRow}>
                    <View
                      style={[
                        marketStyles.statusBadge,
                        {
                          borderColor: palette.primaryStrong,
                          backgroundColor: status === 'active' ? `${palette.primaryStrong}22` : palette.inputBg,
                        },
                      ]}
                    >
                      <Text style={{ color: palette.primaryStrong, fontSize: 12, fontWeight: '600' }}>{status}</Text>
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>{tagline}</Text>
                  </View>

                  <View style={marketStyles.cardFooter}>
                    <KISButton
                      title="View Dashboard"
                      size="xs"
                      onPress={() => onViewDashboard(shop)}
                    />
                    {shop.canEdit ? (
                      <KISButton
                        title="Edit"
                        size="xs"
                        variant="outline"
                        onPress={() => onEditShop(shop)}
                      />
                    ) : null}
                  </View>
                  {onOpenLandingBuilder ? (
                    <Text
                      style={{ color: palette.primaryStrong, fontSize: 12, marginTop: 4 }}
                      onPress={() => onOpenLandingBuilder(shop)}
                    >
                      Manage landing page
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
