import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

export type AdminKPIs = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  banned_users: number;
  staff_count: number;
  total_partners: number;
  active_partners: number;
  new_partners_30d: number;
  total_pending_flags: number;
  total_critical_flags: number;
  actioned_today: number;
  revenue_30d_usd: number;
  revenue_7d_usd: number;
  posts_30d: number;
  conversations_30d: number;
  growth_series: { date: string; new_users: number }[];
  content_series: { date: string; new_flags: number; actioned: number }[];
  generated_at: string | null;
};

const EMPTY_KPIS: AdminKPIs = {
  total_users: 0,
  new_users_7d: 0,
  new_users_30d: 0,
  banned_users: 0,
  staff_count: 0,
  total_partners: 0,
  active_partners: 0,
  new_partners_30d: 0,
  total_pending_flags: 0,
  total_critical_flags: 0,
  actioned_today: 0,
  revenue_30d_usd: 0,
  revenue_7d_usd: 0,
  posts_30d: 0,
  conversations_30d: 0,
  growth_series: [],
  content_series: [],
  generated_at: null,
};

export const useAdminDashboardPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [kpis, setKpis] = useState<AdminKPIs>(EMPTY_KPIS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(900, Math.max(600, Math.round(width * 0.85)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!isOpen) panelTranslateX.setValue(panelWidth);
  }, [panelWidth, isOpen, panelTranslateX]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userStats, partnerStats, contentSummary, revenue, engagement] = await Promise.allSettled([
        getRequest((ROUTES as any).users?.platformStats ?? '', { errorMessage: '' }),
        getRequest((ROUTES as any).adminPartners?.stats ?? '', { errorMessage: '' }),
        getRequest((ROUTES as any).content?.summary ?? '', { errorMessage: '' }),
        getRequest((ROUTES as any).analytics?.revenue ?? '', { errorMessage: '' }),
        getRequest((ROUTES as any).analytics?.engagement ?? '', { errorMessage: '' }),
      ]);

      const u = userStats.status === 'fulfilled' && userStats.value?.success ? userStats.value.data : {};
      const p = partnerStats.status === 'fulfilled' && partnerStats.value?.success ? partnerStats.value.data : {};
      const c = contentSummary.status === 'fulfilled' && contentSummary.value?.success ? contentSummary.value.data : {};
      const r = revenue.status === 'fulfilled' && revenue.value?.success ? revenue.value.data : {};
      const e = engagement.status === 'fulfilled' && engagement.value?.success ? engagement.value.data : {};

      setKpis({
        total_users: u.total_users ?? 0,
        new_users_7d: u.new_users_7d ?? 0,
        new_users_30d: u.new_users_30d ?? 0,
        banned_users: u.banned_users ?? 0,
        staff_count: u.staff_count ?? 0,
        total_partners: p.total_partners ?? 0,
        active_partners: p.active_partners ?? 0,
        new_partners_30d: p.new_30d ?? 0,
        total_pending_flags: c.total_pending ?? 0,
        total_critical_flags: c.total_critical ?? 0,
        actioned_today: c.actioned_today ?? 0,
        revenue_30d_usd: r.revenue_30d_usd ?? 0,
        revenue_7d_usd: r.revenue_7d_usd ?? 0,
        posts_30d: e.posts_30d ?? 0,
        conversations_30d: e.conversations_30d ?? 0,
        growth_series: u.growth_series_30d ?? [],
        content_series: [],
        generated_at: u.generated_at ?? null,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load dashboard stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  const open = () => {
    setIsOpen(true);
    void load();
    requestAnimationFrame(() => {
      panelTranslateX.setValue(panelWidth);
      Animated.timing(panelTranslateX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    });
  };

  const close = () => {
    Animated.timing(panelTranslateX, { toValue: panelWidth, duration: 220, useNativeDriver: true }).start(() => {
      setIsOpen(false);
    });
  };

  return { panelWidth, panelTranslateX, isOpen, open, close, kpis, loading, error, refresh: load };
};
