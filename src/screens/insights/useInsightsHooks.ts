import { useCallback, useEffect, useState } from 'react';
import {
  fetchDashboardInsights,
  fetchNotificationsSummary,
  fetchPartnerCampaigns,
  fetchMarketplaceProducts,
  fetchTiersSummary,
} from '@/api/insights/insights.api';
import type {
  CampaignInsightItem,
  InsightPayload,
  NotificationSummaryItem,
  ProductInsightItem,
  TimeRange,
  TiersSummary,
} from '@/api/insights/types';

export const useInsights = (target: string) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [data, setData] = useState<InsightPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchDashboardInsights(target, timeRange);
      setData(payload);
    } catch {
      setError('Unable to load insights.');
    } finally {
      setLoading(false);
    }
  }, [target, timeRange]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    error,
    timeRange,
    setTimeRange,
    reload: load,
  };
};

export const useProfileInsights = () => useInsights('profile');
export const usePartnerInsights = () => useInsights('partner');

export const useNotificationsSummary = () => {
  const [items, setItems] = useState<NotificationSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await fetchNotificationsSummary(10);
      setItems(summary);
    } catch {
      setError('Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    items,
    loading,
    error,
    reload: load,
  };
};

export const useTiersSummary = () => {
  const [summary, setSummary] = useState<TiersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchTiersSummary();
      setSummary(payload);
    } catch {
      setError('Unable to load tiers summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    summary,
    loading,
    error,
    reload: load,
  };
};

export const usePartnerCampaigns = () => {
  const [items, setItems] = useState<CampaignInsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const campaigns = await fetchPartnerCampaigns();
      setItems(campaigns);
    } catch {
      setError('Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    items,
    loading,
    error,
    reload: load,
  };
};

export const useMarketplaceProducts = () => {
  const [items, setItems] = useState<ProductInsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const products = await fetchMarketplaceProducts();
      setItems(products);
    } catch {
      setError('Unable to load marketplace products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    items,
    loading,
    error,
    reload: load,
  };
};
