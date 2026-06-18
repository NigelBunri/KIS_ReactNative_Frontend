import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

export type RevenueStats = {
  revenue_30d_usd: number;
  revenue_7d_usd: number;
  revenue_today_usd: number;
  total_transactions: number;
  avg_transaction_usd: number;
  top_tier: string | null;
  series_30d: { date: string; amount_usd: number; transactions: number }[];
};

export type EngagementStats = {
  posts_30d: number;
  posts_7d: number;
  conversations_30d: number;
  active_users_30d: number;
  active_users_7d: number;
  new_users_30d: number;
  new_users_7d: number;
  growth_series_30d: { date: string; new_users: number; active_users: number }[];
  content_series_30d: { date: string; posts: number; conversations: number }[];
};

export type AnalyticsDashboard = {
  id: string | number;
  title: string;
  description?: string;
  target?: string;
  widget_count?: number;
  is_active?: boolean;
  created_at?: string;
  [key: string]: unknown;
};

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export const useAdminAnalyticsPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  const [engagement, setEngagement] = useState<EngagementStats | null>(null);
  const [dashboards, setDashboards] = useState<AnalyticsDashboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');

  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(920, Math.max(640, Math.round(width * 0.88)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  const load = useCallback(async (opts?: { period?: AnalyticsPeriod }) => {
    setLoading(true);
    setError(null);
    const p = opts?.period ?? period;
    const params = new URLSearchParams({ period: p });
    try {
      const [rev, eng, dash] = await Promise.allSettled([
        getRequest(`${(ROUTES as any).analytics?.revenue ?? ''}?${params}`, { errorMessage: '' }),
        getRequest(`${(ROUTES as any).analytics?.engagement ?? ''}?${params}`, { errorMessage: '' }),
        getRequest((ROUTES as any).analytics?.adminDashboards ?? '', { errorMessage: '' }),
      ]);
      if (rev.status === 'fulfilled' && rev.value?.success) setRevenue(rev.value.data);
      if (eng.status === 'fulfilled' && eng.value?.success) setEngagement(eng.value.data);
      if (dash.status === 'fulfilled' && dash.value?.success) {
        const raw = dash.value.data;
        setDashboards(
          Array.isArray(raw?.results) ? raw.results :
          Array.isArray(raw) ? raw : [],
        );
      }
      if (rev.status === 'rejected' && eng.status === 'rejected') {
        setError('Failed to load analytics data.');
      }
    } catch {
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const changePeriod = useCallback((p: AnalyticsPeriod) => {
    setPeriod(p);
    void load({ period: p });
  }, [load]);

  const open = () => {
    setIsOpen(true);
    void load();
    requestAnimationFrame(() => {
      panelTranslateX.setValue(panelWidth);
      Animated.timing(panelTranslateX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    });
  };

  const close = () => {
    Animated.timing(panelTranslateX, { toValue: panelWidth, duration: 220, useNativeDriver: true }).start(() =>
      setIsOpen(false),
    );
  };

  return {
    panelWidth, panelTranslateX, isOpen, open, close,
    revenue, engagement, dashboards, loading, error, period, changePeriod, refresh: load,
  };
};
