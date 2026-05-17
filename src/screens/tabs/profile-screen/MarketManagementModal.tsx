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
import { formatUsdAmount } from '@/utils/currency';
import { VerificationBadgeRow, VerificationStatusCard } from '@/components/verification';
import { getVerificationSummary } from '@/services/verificationService';
import CommerceRevenuePreviewCard from '@/components/profitability/CommerceRevenuePreviewCard';
import InstitutionMonetizationPreviewCard from '@/components/profitability/InstitutionMonetizationPreviewCard';
import TrustPromotionRevenuePreviewCard from '@/components/profitability/TrustPromotionRevenuePreviewCard';
import NotificationRetentionPreviewCard from '@/components/profitability/NotificationRetentionPreviewCard';
import EnterpriseKcanRevenuePreviewCard from '@/components/profitability/EnterpriseKcanRevenuePreviewCard';

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
  onOpenVerificationCenter?: (shop: any) => void;
  onRefresh?: () => void;
};

const pickNumeric = (...values: any[]) => {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
};

const countItems = (...values: any[]) => {
  for (const value of values) {
    if (Array.isArray(value)) return value.length;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return 0;
};

export function MarketManagementModal(props: MarketManagementModalProps) {
  const {
    palette,
    subtitle,
    shops,
    loading,
    onCreateShop,
    onEditShop,
    onViewDashboard,
    onOpenLandingBuilder,
    onOpenVerificationCenter,
    onRefresh,
  } = props;

  const totalProducts = useMemo(
    () =>
      shops.reduce(
        (sum, shop) =>
          sum +
          countItems(
            shop?.products_count,
            shop?.product_count,
            shop?.products,
            shop?.metrics?.products_count,
            shop?.metrics?.product_count,
            shop?.metrics?.products,
          ),
        0,
      ),
    [shops],
  );

  const totalServices = useMemo(
    () =>
      shops.reduce(
        (sum, shop) =>
          sum +
          countItems(
            shop?.services_count,
            shop?.service_count,
            shop?.services,
            shop?.service_slots,
            shop?.metrics?.services_count,
            shop?.metrics?.service_count,
            shop?.metrics?.services,
          ),
        0,
      ),
    [shops],
  );

  const totalMembers = useMemo(
    () =>
      shops.reduce(
        (sum, shop) =>
          sum +
          countItems(
            shop?.team_members,
            shop?.members,
            shop?.members_count,
            shop?.member_count,
            shop?.metrics?.members_count,
            shop?.metrics?.member_count,
            shop?.metrics?.members,
          ),
        0,
      ),
    [shops],
  );

  const totalRevenue = useMemo(
    () =>
      shops.reduce(
        (sum, shop) =>
          sum +
          pickNumeric(
            shop?.revenue_total,
            shop?.revenue,
            shop?.live_revenue,
            shop?.metrics?.revenue_total,
            shop?.metrics?.revenue,
            shop?.metrics?.gross_revenue,
          ),
        0,
      ),
    [shops],
  );

  const heroAnalytics = useMemo(
    () => [
      { label: 'Total shops', value: shops.length },
      { label: 'Products', value: totalProducts },
      { label: 'Services', value: totalServices },
      { label: 'Members', value: totalMembers },
      {
        label: 'Revenue',
        value: formatUsdAmount(totalRevenue, { decimals: 2 }),
      },
    ],
    [shops.length, totalProducts, totalServices, totalMembers, totalRevenue],
  );

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, gap: 16 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(loading)}
            onRefresh={onRefresh}
            tintColor={palette.primaryStrong}
          />
        ) : undefined
      }
    >
      <View
        style={[
          marketStyles.heroCard,
          {
            backgroundColor: palette.primarySoft,
            borderColor: palette.primaryStrong,
            borderWidth: 1,
          },
        ]}
      >
        <View style={marketStyles.heroCTA}>
          <View>
            <Text
              style={{ fontSize: 24, fontWeight: '800', color: palette.text }}
            >
              Your Market Empire
            </Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>
              {subtitle}
            </Text>
          </View>
          <KISButton title="Create shop" onPress={onCreateShop} />
        </View>
      </View>
      {shops.length ? (
        <VerificationStatusCard
          palette={palette}
          summary={getVerificationSummary(shops[0])}
          title="Shop verification center"
          subtitle="Open a shop card below to submit private business evidence metadata."
          onOpen={() => onOpenVerificationCenter?.(shops[0])}
        />
      ) : null}
      <InstitutionMonetizationPreviewCard
        palette={palette}
        kind="shop"
        title="Seller growth preview"
        subtitle="Seller Pro and institution growth tools are preview-only until pricing is approved."
      />
      <CommerceRevenuePreviewCard
        palette={palette}
        kind="seller_dashboard"
        title="Seller revenue preview"
        subtitle="Featured listings, promotion packages, seller analytics, and fee reporting are prepared but not chargeable."
      />
      <TrustPromotionRevenuePreviewCard
        palette={palette}
        kind="shop_verification"
        title="Shop verification and promotion preview"
        subtitle="Seller verification fees, badge renewals, trust boosts, and sponsored placements are visible for planning only."
      />
      <NotificationRetentionPreviewCard
        palette={palette}
        kind="commerce"
        title="Commerce reminder preview"
        subtitle="Saved-product, order, stock, fulfillment, and campaign-safe seller alerts are preview-only."
      />
      <EnterpriseKcanRevenuePreviewCard
        palette={palette}
        kind="shop_network"
        title="Commerce network packaging preview"
        subtitle="Verified seller networks, regional commerce chapters, support tiers, and operational evidence are preview-only."
      />

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
          <Text style={[marketStyles.meta, { color: palette.subtext }]}>
            Refreshing shops…
          </Text>
        </View>
      )}

      <View style={marketStyles.analyticsRow}>
        {heroAnalytics.map(metric => (
          <View
            key={metric.label}
            style={[
              marketStyles.analyticsCard,
              {
                borderColor: palette.divider,
                backgroundColor: palette.surface,
              },
            ]}
          >
            <Text
              style={[marketStyles.analyticsValue, { color: palette.text }]}
            >
              {metric.value}
            </Text>
            <Text
              style={[marketStyles.analyticsLabel, { color: palette.subtext }]}
            >
              {metric.label}
            </Text>
          </View>
        ))}
      </View>

      {shops.length === 0 ? (
        <View
          style={[
            marketStyles.emptyState,
            {
              borderColor: palette.divider,
              backgroundColor: palette.card,
              borderWidth: 1,
            },
          ]}
        >
          <KISIcon name="sparkles" size={28} color={palette.primaryStrong} />
          <Text style={[marketStyles.emptyTitle, { color: palette.text }]}>
            Build your first global shop
          </Text>
          <Text style={{ color: palette.subtext, textAlign: 'center' }}>
            Launch a storefront for products, services, or both—with advanced
            analytics, member discounts, and a public landing page.
          </Text>
          <KISButton title="Create Shop" onPress={onCreateShop} />
        </View>
      ) : (
        <View style={marketStyles.shopGrid}>
          {shops.map(shop => {
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
                    <Image
                      source={{ uri: bannerImageUri }}
                      style={marketStyles.shopCardBannerImage}
                    />
                  ) : null}
                  <View style={marketStyles.shopCardBannerContent}>
                    <Text
                      style={[
                        marketStyles.shopCardBannerTitle,
                        { color: palette.primaryStrong },
                      ]}
                    >
                      {shop.name}
                    </Text>
                    <Text style={{ color: 'white', fontSize: 12 }}>
                      {category}
                    </Text>
                  </View>
                </View>
                <View style={marketStyles.shopCardBody}>
                  <View style={marketStyles.shopMetaRow}>
                    <View
                      style={[
                        marketStyles.statusBadge,
                        {
                          borderColor: palette.primaryStrong,
                          backgroundColor:
                            status === 'active'
                              ? `${palette.primaryStrong}22`
                              : palette.inputBg,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: palette.primaryStrong,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {status}
                      </Text>
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {tagline}
                    </Text>
                    <VerificationBadgeRow
                      palette={palette}
                      summary={getVerificationSummary(shop)}
                      compact
                    />
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
                    <KISButton
                      title="Verification"
                      size="xs"
                      variant="outline"
                      onPress={() => onOpenVerificationCenter?.(shop)}
                    />
                  </View>
                  {onOpenLandingBuilder ? (
                    <Text
                      style={{
                        color: palette.primaryStrong,
                        fontSize: 12,
                        marginTop: 4,
                      }}
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
