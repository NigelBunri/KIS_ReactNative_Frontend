import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import type {
  CampaignInsightItem,
  InsightBreakdownItem,
  InsightKpi,
  InsightPayload,
  InsightSeries,
  InsightTopItem,
  ProductInsightItem,
  TimeRange,
} from './types';

type ApiResponse = Record<string, any>;

const arrayize = <T = any>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value === undefined || value === null) return [];
  if (typeof value === 'object') {
    return [value as T];
  }
  return [];
};

const mapKpis = (items: any[]): InsightKpi[] =>
  items.map((item, idx) => ({
    id: String(item.id ?? item.key ?? `kpi-${idx}`),
    label: item.label ?? item.title ?? item.name ?? 'Metric',
    value: item.value ?? item.total ?? item.count ?? item.amount ?? 0,
    change: typeof item.change === 'number' ? item.change : item.delta,
    unit: item.unit ?? (typeof item.value === 'number' ? item.prefix ?? '' : undefined),
    icon: item.icon,
    trend: item.trend,
  }));

const mapSeries = (entries: any[]): InsightSeries[] =>
  entries
    .filter((entry) => Array.isArray(entry.data))
    .map((entry, idx) => ({
      id: String(entry.id ?? entry.key ?? `series-${idx}`),
      name: entry.name ?? entry.label ?? `Series ${idx + 1}`,
      color: entry.color,
      data: entry.data.map((point: any, pointIdx: number) => ({
        x: point.x ?? point.date ?? String(pointIdx + 1),
        y: Number(point.y ?? point.value ?? 0),
      })),
    }))
    .filter((series) => series.data.length > 0);

const mapBreakdown = (entries: any[]): InsightBreakdownItem[] =>
  entries
    .map((entry, idx) => ({
      label: entry.label ?? entry.name ?? `Slice ${idx + 1}`,
      value: Number(entry.value ?? entry.count ?? entry.total ?? 0),
      color: entry.color,
    }))
    .filter((item) => item.value > 0);

const mapTopItems = (entries: any[]): InsightTopItem[] =>
  entries.map((entry, idx) => ({
    id: String(entry.id ?? entry.key ?? `item-${idx}`),
    title: entry.title ?? entry.name ?? `Item ${idx + 1}`,
    subtitle: entry.subtitle ?? entry.description ?? entry.summary,
    metric: entry.metric ?? entry.kpi ?? entry.value,
    avatar: entry.avatar ?? entry.image_url,
  }));

const normalizeInsights = (payload: ApiResponse): InsightPayload => {
  const data = payload?.data ?? payload ?? {};
  const kpis = mapKpis(arrayize(data.kpis ?? data.metrics ?? data.summary));
  const candidateSeries = mapSeries(arrayize(data.series ?? data.trends ?? data.timeline));
  const series = candidateSeries.length > 0 ? candidateSeries : [];
  const breakdown = mapBreakdown(arrayize(data.breakdown ?? data.categories ?? data.views));
  const distribution = mapBreakdown(arrayize(data.distribution ?? data.segments ?? data.types));
  const topItems = mapTopItems(arrayize(data.top_items ?? data.top_posts ?? data.items));

  return {
    kpis,
    series,
    breakdown,
    distribution,
    topItems,
  };
};

export const fetchDashboardInsights = async (
  target: string,
  timeframe: TimeRange = '7d',
): Promise<InsightPayload> => {
  try {
    const res = await getRequest(ROUTES.analytics.dashboards, {
      params: { target, timeframe },
    });
    return normalizeInsights(res?.data ?? res ?? {});
  } catch (err) {
    console.warn('[insights] dashboard fetch failed', err);
    return normalizeInsights({});
  }
};

export type NotificationSummaryItem = {
  id: string;
  title: string;
  status: string;
  deliveredAt?: string;
};

export const fetchNotificationsSummary = async (
  limit = 8,
): Promise<NotificationSummaryItem[]> => {
  try {
    const res = await getRequest(ROUTES.notifications.notifications, {
      params: { limit },
    });
    const entries = arrayize(res?.data?.results ?? res?.data ?? res ?? []).slice(0, limit);
    return entries.map((entry, idx) => ({
      id: String(entry.id ?? entry.key ?? `notif-${idx}`),
      title: entry.title ?? entry.name ?? entry.subject ?? 'Notification',
      status: entry.status ?? entry.state ?? 'draft',
      deliveredAt: entry.delivered_at ?? entry.sent_at ?? entry.created_at,
    }));
  } catch (err) {
    console.warn('[insights] notifications fetch failed', err);
    return [];
  }
};

export type TiersSummary = {
  planCount: number;
  campaignCount: number;
  upcomingPlans: string[];
  featuredCampaigns: string[];
};

export const fetchTiersSummary = async (): Promise<TiersSummary> => {
  try {
    const [plansRes, campaignsRes] = await Promise.all([
      getRequest(ROUTES.tiers.plans),
      getRequest(ROUTES.tiers.campaigns),
    ]);
    const plans = arrayize(plansRes?.data ?? plansRes ?? []);
    const campaigns = arrayize(campaignsRes?.data ?? campaignsRes ?? []);
    return {
      planCount: plans.length,
      campaignCount: campaigns.length,
      upcomingPlans: plans.slice(0, 3).map((plan) => plan.name ?? plan.title ?? 'Plan'),
      featuredCampaigns: campaigns
        .slice(0, 3)
        .map((campaign) => campaign.title ?? campaign.name ?? 'Campaign'),
    };
  } catch (err) {
    console.warn('[insights] tiers fetch failed', err);
    return {
      planCount: 0,
      campaignCount: 0,
      upcomingPlans: [],
      featuredCampaigns: [],
    };
  }
};

const mapCampaignEntries = (entries: any[]): CampaignInsightItem[] =>
  entries.map((entry, idx) => ({
    id: String(entry?.id ?? entry?.key ?? `campaign-${idx}`),
    title: entry?.title ?? entry?.name ?? `Campaign ${idx + 1}`,
    status: entry?.status ?? entry?.state ?? 'draft',
    conversions: Number(
      entry?.conversions ?? entry?.metrics?.conversions ?? entry?.conversion ?? entry?.completed ?? 0,
    ),
    revenue: Number(
      entry?.revenue ?? entry?.metrics?.revenue ?? entry?.amount ?? entry?.earnings ?? 0,
    ),
  }));

const mapProductEntries = (entries: any[]): ProductInsightItem[] =>
  entries.map((entry, idx) => ({
    id: String(entry?.id ?? entry?.key ?? `product-${idx}`),
    name: entry?.name ?? entry?.title ?? `Product ${idx + 1}`,
    shop: entry?.shop?.name ?? entry?.shop_name ?? entry?.shop ?? entry?.vendor ?? null,
    orders: Number(
      entry?.orders ?? entry?.sales_count ?? entry?.metrics?.orders ?? entry?.purchases ?? 0,
    ),
    revenue: Number(
      entry?.revenue ?? entry?.metrics?.revenue ?? entry?.price_total ?? entry?.gross ?? 0,
    ),
  }));

export const fetchPartnerCampaigns = async (limit = 6): Promise<CampaignInsightItem[]> => {
  try {
    const res = await getRequest(ROUTES.tiers.campaigns, { params: { limit } });
    const list = arrayize(res?.data?.results ?? res?.data ?? res ?? []);
    return mapCampaignEntries(list);
  } catch (err) {
    console.warn('[insights] partner campaigns fetch failed', err);
    return [];
  }
};

export const fetchMarketplaceProducts = async (limit = 6): Promise<ProductInsightItem[]> => {
  try {
    const res = await getRequest(ROUTES.commerce.products, { params: { limit } });
    const list = arrayize(res?.data?.results ?? res?.data ?? res ?? []);
    return mapProductEntries(list);
  } catch (err) {
    console.warn('[insights] marketplace products fetch failed', err);
    return [];
  }
};
