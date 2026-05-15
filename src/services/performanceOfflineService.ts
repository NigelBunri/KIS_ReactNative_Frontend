import AsyncStorage from '@react-native-async-storage/async-storage';

import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { isOnline } from '@/services/networkMonitor';

const SETTINGS_KEY = 'kis.performance.offline.settings.v1';
const TELEMETRY_KEY = 'kis.performance.redacted.telemetry.v1';

export type PerformanceOfflinePolicy = {
  version: string;
  mode: {
    low_bandwidth_default: boolean;
    offline_first_enabled: boolean;
    stale_while_revalidate_enabled: boolean;
    request_deduplication_enabled: boolean;
    retry_backoff_enabled: boolean;
    telemetry_enabled: boolean;
  };
  cache_policy: Record<string, number | boolean>;
  media_policy: Record<string, boolean>;
  pagination_policy: Record<string, number | boolean>;
  retry_policy: {
    base_delay_ms: number;
    max_delay_ms: number;
    max_attempts: number;
    jitter: boolean;
    silent_background_retry: boolean;
  };
  telemetry_policy: Record<string, any>;
  domain_readiness: Record<string, Record<string, boolean>>;
  privacy: Record<string, boolean>;
};

export type PerformanceOfflineSettings = {
  lowBandwidthMode: boolean;
  offlineFirst: boolean;
  staleWhileRevalidate: boolean;
  autoplayMedia: boolean;
  lastPolicySyncAt?: string;
};

export type RedactedPerformanceEvent = {
  event: string;
  at: string;
  domain?: string;
  durationMs?: number;
  status?: string;
};

export const DEFAULT_PERFORMANCE_OFFLINE_SETTINGS: PerformanceOfflineSettings = {
  lowBandwidthMode: false,
  offlineFirst: true,
  staleWhileRevalidate: true,
  autoplayMedia: false,
};

export const fetchPerformanceOfflinePolicy = async (): Promise<PerformanceOfflinePolicy | null> => {
  const response = await getRequest(ROUTES.performance.offlinePolicy, {
    forceNetwork: true,
    errorMessage: 'Unable to load offline performance policy.',
  });
  if (!response.success) {
    throw new Error(response.message || 'Unable to load offline performance policy.');
  }
  return response.data || null;
};

export const readPerformanceOfflineSettings = async (): Promise<PerformanceOfflineSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PERFORMANCE_OFFLINE_SETTINGS;
    return {
      ...DEFAULT_PERFORMANCE_OFFLINE_SETTINGS,
      ...JSON.parse(raw),
    };
  } catch {
    return DEFAULT_PERFORMANCE_OFFLINE_SETTINGS;
  }
};

export const savePerformanceOfflineSettings = async (
  updates: Partial<PerformanceOfflineSettings>,
): Promise<PerformanceOfflineSettings> => {
  const current = await readPerformanceOfflineSettings();
  const next = { ...current, ...updates };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
};

export const syncPerformanceOfflinePolicy = async (): Promise<PerformanceOfflineSettings> => {
  const [policy, current] = await Promise.all([
    fetchPerformanceOfflinePolicy().catch(() => null),
    readPerformanceOfflineSettings(),
  ]);
  const next = {
    ...current,
    lowBandwidthMode: current.lowBandwidthMode || Boolean(policy?.mode?.low_bandwidth_default),
    offlineFirst: policy?.mode?.offline_first_enabled ?? current.offlineFirst,
    staleWhileRevalidate: policy?.mode?.stale_while_revalidate_enabled ?? current.staleWhileRevalidate,
    lastPolicySyncAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
};

export const shouldUseLowBandwidthMedia = async (): Promise<boolean> => {
  const [settings, online] = await Promise.all([
    readPerformanceOfflineSettings(),
    isOnline(),
  ]);
  return settings.lowBandwidthMode || !online;
};

export const selectBestMediaUrl = (
  source: {
    thumbnail_url?: string | null;
    thumbnailUrl?: string | null;
    low_bandwidth_url?: string | null;
    lowBandwidthUrl?: string | null;
    preview_url?: string | null;
    previewUrl?: string | null;
    url?: string | null;
    media_url?: string | null;
    mediaUrl?: string | null;
  },
  lowBandwidth: boolean,
): string | undefined => {
  if (lowBandwidth) {
    return (
      source.low_bandwidth_url ||
      source.lowBandwidthUrl ||
      source.thumbnail_url ||
      source.thumbnailUrl ||
      source.preview_url ||
      source.previewUrl ||
      source.url ||
      source.media_url ||
      source.mediaUrl ||
      undefined
    );
  }
  return (
    source.url ||
    source.media_url ||
    source.mediaUrl ||
    source.preview_url ||
    source.previewUrl ||
    source.thumbnail_url ||
    source.thumbnailUrl ||
    undefined
  );
};

export const computeRetryDelayMs = (attempt: number, baseDelayMs = 800, maxDelayMs = 10000): number => {
  const safeAttempt = Math.max(0, Number(attempt) || 0);
  const exponential = baseDelayMs * Math.pow(2, safeAttempt);
  const jitter = Math.round(Math.random() * Math.min(baseDelayMs, 1000));
  return Math.min(maxDelayMs, exponential + jitter);
};

export const recordRedactedPerformanceEvent = async (event: RedactedPerformanceEvent): Promise<void> => {
  try {
    const safeEvent = {
      event: String(event.event || 'unknown').slice(0, 80),
      at: event.at || new Date().toISOString(),
      domain: event.domain ? String(event.domain).slice(0, 80) : undefined,
      durationMs: Number.isFinite(event.durationMs) ? Math.max(0, Number(event.durationMs)) : undefined,
      status: event.status ? String(event.status).slice(0, 40) : undefined,
    };
    const raw = await AsyncStorage.getItem(TELEMETRY_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(existing) ? [...existing.slice(-49), safeEvent] : [safeEvent];
    await AsyncStorage.setItem(TELEMETRY_KEY, JSON.stringify(next));
  } catch {
    // Telemetry is best-effort and redacted; never block user flows.
  }
};
