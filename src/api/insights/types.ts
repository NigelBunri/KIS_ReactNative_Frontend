export type TimeRange = '7d' | '30d' | '90d' | 'all';

export type InsightKpi = {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
  icon?: string;
  trend?: number;
};

export type InsightSeriesPoint = {
  x: string;
  y: number;
};

export type InsightSeries = {
  id: string;
  name: string;
  data: InsightSeriesPoint[];
  color?: string;
};

export type InsightBreakdownItem = {
  label: string;
  value: number;
  color?: string;
};

export type InsightTopItem = {
  id: string;
  title: string;
  subtitle?: string;
  metric?: string;
  avatar?: string;
};

export type CampaignInsightItem = {
  id: string;
  title: string;
  status?: string;
  conversions?: number;
  revenue?: number;
};

export type ProductInsightItem = {
  id: string;
  name: string;
  shop?: string;
  orders?: number;
  revenue?: number;
};

export type NotificationSummaryItem = {
  id: string;
  title: string;
  status: string;
  deliveredAt?: string;
};

export type TiersSummary = {
  planCount: number;
  campaignCount: number;
  upcomingPlans: string[];
  featuredCampaigns: string[];
};

export type InsightPayload = {
  kpis: InsightKpi[];
  series: InsightSeries[];
  breakdown: InsightBreakdownItem[];
  distribution: InsightBreakdownItem[];
  topItems: InsightTopItem[];
};
