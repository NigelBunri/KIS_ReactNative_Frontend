import React from 'react';
import { Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import InsightLayout from './components/InsightLayout';
import {
  useMarketplaceProducts,
  usePartnerCampaigns,
  usePartnerInsights,
  useTiersSummary,
} from './useInsightsHooks';
import type { CampaignInsightItem, ProductInsightItem, TiersSummary } from '@/api/insights/types';

export default function PartnerInsightsScreen() {
  const insights = usePartnerInsights();
  const tiers = useTiersSummary();
  const { palette } = useKISTheme();

  const campaigns = usePartnerCampaigns();
  const products = useMarketplaceProducts();
  const footer = (
    <View style={{ marginTop: 18, gap: 18 }}>
      <TierHealthPanel summary={tiers.summary} loading={tiers.loading} />
      <CampaignsSection
        campaigns={campaigns.items}
        loading={campaigns.loading}
        error={campaigns.error}
      />
      <TopProductsSection
        products={products.items}
        loading={products.loading}
        error={products.error}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <InsightLayout
        title="Partner insights"
        data={insights.data}
        loading={insights.loading}
        error={insights.error}
        timeRange={insights.timeRange}
        onTimeRangeChange={insights.setTimeRange}
        onRefresh={insights.reload}
        footer={footer}
      />
    </View>
  );
}

type TierHealthPanelProps = {
  summary: TiersSummary | null;
  loading: boolean;
};

function TierHealthPanel({ summary, loading }: TierHealthPanelProps) {
  const { palette } = useKISTheme();
  if (loading) {
    return <Text style={{ color: palette.subtext }}>Loading tier health…</Text>;
  }
  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
        Tier health
      </Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: 16,
          padding: 14,
          backgroundColor: palette.surface,
          gap: 8,
        }}
      >
        <Text style={{ color: palette.text }}>Plans: {summary?.planCount ?? '—'}</Text>
        <Text style={{ color: palette.text }}>Campaigns: {summary?.campaignCount ?? '—'}</Text>
        {summary?.upcomingPlans.length ? (
          <View>
            <Text style={{ color: palette.subtext, marginBottom: 4 }}>Upcoming plans</Text>
            {summary.upcomingPlans.map((plan) => (
              <Text key={plan} style={{ color: palette.text, fontWeight: '600' }}>
                • {plan}
              </Text>
            ))}
          </View>
        ) : null}
        {summary?.featuredCampaigns.length ? (
          <View>
            <Text style={{ color: palette.subtext, marginTop: 8, marginBottom: 4 }}>
              Featured campaigns
            </Text>
            {summary.featuredCampaigns.map((campaign) => (
              <Text key={campaign} style={{ color: palette.text, fontWeight: '600' }}>
                • {campaign}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

type CampaignsSectionProps = {
  campaigns: CampaignInsightItem[];
  loading: boolean;
  error: string | null;
};

function CampaignsSection({ campaigns, loading, error }: CampaignsSectionProps) {
  const { palette } = useKISTheme();
  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
        Campaigns performance
      </Text>
      {loading ? (
        <Text style={{ color: palette.subtext }}>Loading campaigns…</Text>
      ) : error ? (
        <Text style={{ color: palette.error }}>{error}</Text>
      ) : campaigns.length ? (
        campaigns.map((item) => (
          <View
            key={item.id}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 14,
              padding: 12,
              marginBottom: 10,
              backgroundColor: palette.surface,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>{item.status}</Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 6,
              }}
            >
              <Text style={{ color: palette.subtext }}>
                Conversions: {item.conversions ?? '—'}
              </Text>
              <Text style={{ color: palette.subtext }}>
                Revenue: {formatCurrency(item.revenue)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={{ color: palette.subtext }}>No campaigns tracked yet.</Text>
      )}
    </View>
  );
}

type TopProductsSectionProps = {
  products: ProductInsightItem[];
  loading: boolean;
  error: string | null;
};

function TopProductsSection({ products, loading, error }: TopProductsSectionProps) {
  const { palette } = useKISTheme();
  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
        Top products
      </Text>
      {loading ? (
        <Text style={{ color: palette.subtext }}>Loading products…</Text>
      ) : error ? (
        <Text style={{ color: palette.error }}>{error}</Text>
      ) : products.length ? (
        products.map((product) => (
          <View
            key={product.id}
            style={{
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: 14,
              padding: 12,
              marginBottom: 10,
              backgroundColor: palette.surface,
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '700' }}>{product.name}</Text>
            {product.shop ? (
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                {product.shop}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 6,
              }}
            >
              <Text style={{ color: palette.subtext }}>Orders: {product.orders ?? '—'}</Text>
              <Text style={{ color: palette.subtext }}>
                Revenue: {formatCurrency(product.revenue)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={{ color: palette.subtext }}>No marketplace products yet.</Text>
      )}
    </View>
  );
}

const formatCurrency = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '—';
  }
  return `$${Number(value).toFixed(2)}`;
};
