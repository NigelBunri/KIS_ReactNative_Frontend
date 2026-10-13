import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';

export type LiveMetrics = {
  active_connections: number;
  requests_per_minute: number;
  avg_response_ms: number;
  error_rate_pct: number;
  memory_usage_pct: number;
  cpu_usage_pct: number;
  queue_depth: number;
  cache_hit_rate_pct: number;
  generated_at: string | null;
};

export type MonitoringAlert = {
  id: string;
  severity: string;
  title: string;
  description: string;
  service: string;
  triggered_at: string;
  resolved_at: string | null;
  is_resolved: boolean;
};

export type PerformanceInsight = {
  endpoint: string;
  avg_ms: number;
  p95_ms: number;
  p99_ms: number;
  call_count: number;
  error_count: number;
};

export const useAdminSystemHealthPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [performance, setPerformance] = useState<PerformanceInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(920, Math.max(640, Math.round(width * 0.88)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, alertsRes, perfRes] = await Promise.allSettled([
        getRequest((ROUTES as any).control?.liveMetrics ?? '', { errorMessage: '' }),
        getRequest((ROUTES as any).control?.monitoringAlerts ?? '', { errorMessage: '' }),
        getRequest((ROUTES as any).control?.performance ?? '', { errorMessage: '' }),
      ]);
      // getRequest never rejects — it catches internally and always resolves
      // with { success: false } — so `.status === 'rejected'` below was dead
      // code. On a full outage this silently left `error` unset and the
      // panel just showed its "no data" placeholder with no indication of a
      // failure. Check `.value?.success` instead, which actually reflects
      // whether the request succeeded.
      const metricsOk = metricsRes.status === 'fulfilled' && !!metricsRes.value?.success;
      const alertsOk = alertsRes.status === 'fulfilled' && !!alertsRes.value?.success;
      const perfOk = perfRes.status === 'fulfilled' && !!perfRes.value?.success;
      if (metricsOk) setMetrics(metricsRes.value.data);
      if (alertsOk) {
        setAlerts(alertsRes.value.data?.alerts ?? alertsRes.value.data?.results ?? []);
      }
      if (perfOk) {
        setPerformance(perfRes.value.data?.endpoints ?? perfRes.value.data?.results ?? []);
      }
      if (!metricsOk && !alertsOk && !perfOk) {
        setError('Failed to load system health data.');
      }
    } catch {
      setError('Failed to load system health data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds while the panel is open.
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(timer);
  }, [isOpen, load]);

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
    metrics, alerts, performance, loading, error, refresh: load,
  };
};
