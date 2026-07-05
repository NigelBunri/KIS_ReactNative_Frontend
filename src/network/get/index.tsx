// src/network/routes/get/index.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { getOfflineCache, setCache, setOfflineCache } from '../cache';
import { CacheTypes } from '../cacheKeys';
import type { ApiResult, HeadersInit } from '../types';
import {
  getAccessTokenForRequest,
  refreshAccessToken,
} from '@/security/tokenRefresh';
import { clearAuthSession, isUnrecoverableDeviceAuthError } from '@/security/authStorage';
import { recordRedactedPerformanceEvent, computeRetryDelayMs } from '@/services/performanceOfflineService';

export type GetResponse<T = any> = ApiResult<T>;

const getCachedDeviceId = async (): Promise<string | null> => {
  // Device id can rotate during QR secondary-device login. Read the current
  // value for each GET so device-bound headers never use a stale primary id.
  return AsyncStorage.getItem('device_id');
};

const inflightGetRequests = new Map<string, Promise<GetResponse>>();
const blockedUntilByUrl = new Map<string, number>();
const blockedUntilByPath = new Map<string, number>();
const recentSuccessByUrl = new Map<string, { at: number; payload: any }>();
const GET_429_COOLDOWN_MS = 15000;
// Never block longer than 5 minutes regardless of what the server says.
// A Django throttle of "Expected available in 68092 seconds" (~19 hours) would
// otherwise lock the endpoint for the entire app session.
const GET_429_MAX_COOLDOWN_MS = 5 * 60 * 1000;
const GET_HOT_SUCCESS_TTL_MS = 10000;

/* ── Retry helpers ────────────────────────────────────────────────────────── */

const MAX_GET_RETRIES = 3; // up to 4 total attempts on poor networks
const AUTO_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes automatic fallback TTL
const AUTO_CACHE_PREFIX = 'KIS_GET_AUTO_V1:';
const AUTO_CACHE_MAX_BYTES = 1_000_000; // skip caching very large payloads

const isTransientError = (err: any): boolean => {
  const name = String(err?.name ?? '');
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    name === 'AbortError' ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('timeout')
  );
};

const isRetryableStatus = (status: number) =>
  status === 502 || status === 503 || status === 504;

const autoKey = (url: string) => `${AUTO_CACHE_PREFIX}${url.slice(0, 200)}`;

const readAutoCache = async (url: string): Promise<{ data: any; stale: boolean } | null> => {
  try {
    const raw = await AsyncStorage.getItem(autoKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.data == null) return null;
    return {
      data: parsed.data,
      stale: parsed.expiresAt ? Date.now() > parsed.expiresAt : true,
    };
  } catch { return null; }
};

const writeAutoCache = (url: string, data: any): void => {
  try {
    const serialized = JSON.stringify({ data, expiresAt: Date.now() + AUTO_CACHE_TTL_MS });
    if (serialized.length > AUTO_CACHE_MAX_BYTES) return;
    void AsyncStorage.setItem(autoKey(url), serialized);
  } catch {}
};

const fetchGetWithRetry = async (
  finalUrl: string,
  headers: HeadersInit,
): Promise<{ response: Response; responseData: any }> => {
  let lastError: any;
  for (let attempt = 0; attempt <= MAX_GET_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, computeRetryDelayMs(attempt - 1, 900, 12000)));
    }
    try {
      const response = await apiService.get(finalUrl, headers);
      const responseData = await response.json().catch(() => ({}));
      // 5xx responses are retryable — try again unless we've exhausted retries
      if (isRetryableStatus(response.status) && attempt < MAX_GET_RETRIES) {
        lastError = new Error(`Retryable status ${response.status}`);
        continue;
      }
      return { response, responseData };
    } catch (err: any) {
      lastError = err;
      if (!isTransientError(err) || attempt >= MAX_GET_RETRIES) throw err;
      // Transient error — loop continues to next attempt
    }
  }
  throw lastError;
};

/* ── Existing helpers ─────────────────────────────────────────────────────── */

const getPathname = (value: unknown): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return '';
  try {
    return new URL(normalized).pathname;
  } catch {
    return normalized.split('?')[0] ?? normalized;
  }
};

const isHotReadEndpoint = (path: string): boolean =>
  path.includes('/api/v1/profiles/me/') ||
  path.includes('/api/v1/channels/') ||
  path.includes('/api/v1/statuses/') ||
  path.includes('/api/v1/users/check-contacts/');

const resolve429CooldownMs = (payload: any): number => {
  const text = String(payload?.detail || payload?.message || payload?.error || '');
  const secMatch = text.match(/available in\s+(\d+)\s+seconds?/i) || text.match(/(\d+)\s*seconds?/i);
  if (secMatch) {
    const seconds = Number(secMatch[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      // Cap at GET_429_MAX_COOLDOWN_MS so a server-side throttle of 68000+ seconds
      // doesn't block the endpoint for the whole app session.
      return Math.min(GET_429_MAX_COOLDOWN_MS, Math.max(GET_429_COOLDOWN_MS, seconds * 1000));
    }
  }
  return GET_429_COOLDOWN_MS;
};

const describe429Wait = (blockedUntilMs: number): string => {
  const remainMs = blockedUntilMs - Date.now();
  if (remainMs <= 0) return '';
  const remainSec = Math.ceil(remainMs / 1000);
  if (remainSec < 60) return ` Try again in ${remainSec}s.`;
  const mins = Math.ceil(remainSec / 60);
  return ` Try again in ${mins} min.`;
};

export const getRequest = async (
  url: string,
  options: {
    headers?: HeadersInit;
    cacheKey?: string;
    cacheType?: string;
    successMessage?: string;
    errorMessage?: string;
    params?: Record<string, any>;
    forceNetwork?: boolean;
    offlineTtlSeconds?: number;
    staleWhileRevalidate?: boolean;
  } = {}
) => {
  if (typeof url !== 'string' || !url.trim()) {
    console.warn('[getRequest] Request endpoint is not configured.', {
      url,
    });
    return {
      success: false,
      message: 'Request endpoint is not configured.',
    };
  }

  const execute = async (): Promise<GetResponse> => {
  try {
    const token = await getAccessTokenForRequest();
    const deviceId = await getCachedDeviceId();
    const baseHeaders: HeadersInit = {};
    if (token) baseHeaders.Authorization = `Bearer ${token}`;
    if (deviceId) baseHeaders['X-Device-Id'] = deviceId;

    const headers = { ...baseHeaders, ...(options.headers ?? {}) };

    const queryParams = new URLSearchParams();
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        queryParams.set(key, String(value));
      });
    }
    const queryString = queryParams.toString();
    const finalUrl = queryString ? `${url}?${queryString}` : url;
    const pathname = getPathname(finalUrl);
    const now = Date.now();

    if (!options.forceNetwork) {
      const recentSuccess = recentSuccessByUrl.get(finalUrl);
      if (
        recentSuccess &&
        isHotReadEndpoint(pathname) &&
        now - recentSuccess.at < GET_HOT_SUCCESS_TTL_MS
      ) {
        return { success: true, data: recentSuccess.payload, message: options.successMessage || '' };
      }

      const blockedUntilUrl = blockedUntilByUrl.get(finalUrl) ?? 0;
      const blockedUntilPath = blockedUntilByPath.get(pathname) ?? 0;
      if (now < blockedUntilUrl) {
        return {
          success: false,
          status: 429,
          message: `Too many requests.${describe429Wait(blockedUntilUrl)}`,
        };
      }
      if (now < blockedUntilPath) {
        return {
          success: false,
          status: 429,
          message: `Too many requests.${describe429Wait(blockedUntilPath)}`,
        };
      }
    }

    const startedAt = Date.now();
    const { response, responseData } = await fetchGetWithRetry(finalUrl, headers);

    void recordRedactedPerformanceEvent({
      event: 'request_completed',
      at: new Date().toISOString(),
      domain: pathname,
      durationMs: Date.now() - startedAt,
      status: String(response.status),
    });

    if (response.ok) {
      recentSuccessByUrl.set(finalUrl, { at: Date.now(), payload: responseData });
      // Auto-cache every successful response for offline fallback
      writeAutoCache(finalUrl, responseData);
      if (options.cacheKey) {
        const cType = options.cacheType || CacheTypes.DEFAULT;
        if (options.offlineTtlSeconds) {
          await setOfflineCache(cType, options.cacheKey, responseData, options.offlineTtlSeconds);
        } else {
          await setCache(cType, options.cacheKey, responseData);
        }
      }
      return { success: true, data: responseData, message: options.successMessage || '' };
    }

    // Silent token refresh on 401, then retry once.
    if (response.status === 401) {
      const newToken = await refreshAccessToken(token);
      if (newToken) {
        const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retryResponse = await apiService.get(finalUrl, retryHeaders);
        const retryData = await retryResponse.json().catch(() => ({}));
        if (retryResponse.ok) {
          recentSuccessByUrl.set(finalUrl, { at: Date.now(), payload: retryData });
          writeAutoCache(finalUrl, retryData);
          return { success: true, data: retryData, message: options.successMessage || '' };
        }
        console.error('[getRequest] retry after token refresh still failed', {
          url: finalUrl,
          status: retryResponse.status,
          detail: retryData?.detail,
        });
        if (isUnrecoverableDeviceAuthError(retryData?.detail)) {
          void clearAuthSession();
        }
        return {
          success: false,
          message: options.errorMessage || retryData?.detail || 'Session expired.',
          status: retryResponse.status,
          data: retryData,
        };
      }
      console.error('[getRequest] 401 and token refresh failed', {
        url: finalUrl,
        detail: responseData?.detail,
      });
      return {
        success: false,
        message: options.errorMessage || responseData?.detail || 'Session expired. Please log in again.',
        status: 401,
        data: responseData,
      };
    }

    if (response.status === 429) {
      const cooldownMs = resolve429CooldownMs(responseData);
      const blockedUntil = Date.now() + cooldownMs;
      blockedUntilByUrl.set(finalUrl, blockedUntil);
      blockedUntilByPath.set(pathname, blockedUntil);
    }

    const msg =
      (responseData && (responseData.message || responseData.detail)) ||
      options.errorMessage ||
      'Request failed.';

    return { success: false, message: msg, status: response.status, data: responseData };
  } catch (error: any) {
    // Explicit cacheKey offline fallback (file-based, longer TTL)
    if (options.cacheKey) {
      const cached = await getOfflineCache(
        options.cacheType || CacheTypes.DEFAULT,
        options.cacheKey,
        { allowExpired: Boolean(options.staleWhileRevalidate) },
      );
      if (cached) {
        void recordRedactedPerformanceEvent({
          event: cached.stale ? 'offline_cache_stale_hit' : 'offline_cache_hit',
          at: new Date().toISOString(),
          domain: getPathname(url),
          status: 'cache',
        });
        return {
          success: true,
          data: cached.value,
          message: options.successMessage || 'Showing saved data.',
          offline: true,
          stale: cached.stale,
        };
      }
    }

    // Auto-cache fallback — serves any previously successful response
    const queryParams = new URLSearchParams();
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        queryParams.set(key, String(value));
      });
    }
    const qs = queryParams.toString();
    const resolvedUrl = qs ? `${url}?${qs}` : url;
    const autoCached = await readAutoCache(resolvedUrl);
    if (autoCached) {
      return {
        success: true,
        data: autoCached.data,
        message: options.successMessage || 'Showing saved data.',
        offline: true,
        stale: autoCached.stale,
      };
    }

    return { success: false, message: error?.message || options.errorMessage || 'An error occurred.' };
  }
  };

  const queryParams = new URLSearchParams();
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      queryParams.set(key, String(value));
    });
  }
  const queryString = queryParams.toString();
  const finalUrl = queryString ? `${url}?${queryString}` : url;

  if (!options.forceNetwork) {
    const existing = inflightGetRequests.get(finalUrl);
    if (existing) return existing;
  }

  const requestPromise: Promise<GetResponse> = execute().finally(() => {
    inflightGetRequests.delete(finalUrl);
  });
  if (!options.forceNetwork) {
    inflightGetRequests.set(finalUrl, requestPromise);
  }
  return requestPromise;
};
