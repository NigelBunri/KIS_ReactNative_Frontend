// src/network/routes/get/index.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { setCache } from '../cache';
import { CacheTypes } from '../cacheKeys';
import type { ApiResult, HeadersInit } from '../types';
import { getAccessToken } from '@/security/authStorage';

export type GetResponse<T = any> = ApiResult<T>;

const inflightGetRequests = new Map<string, Promise<GetResponse>>();
const blockedUntilByUrl = new Map<string, number>();
const blockedUntilByPath = new Map<string, number>();
const recentSuccessByUrl = new Map<string, { at: number; payload: any }>();
const GET_429_COOLDOWN_MS = 15000;
const GET_HOT_SUCCESS_TTL_MS = 10000;

const getPathname = (value: string): string => {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split('?')[0] ?? value;
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
      return Math.max(GET_429_COOLDOWN_MS, seconds * 1000);
    }
  }
  return GET_429_COOLDOWN_MS;
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
  } = {}
) => {
  const execute = async (): Promise<GetResponse> => {
  try {
    // if (!(await isOnline())) throw new Error('No internet connection.');

    // const token = await resolveBearerToken();
    const token = await getAccessToken();
    const deviceId = await AsyncStorage.getItem('device_id');
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
          message: 'Too many requests. Retrying shortly.',
        };
      }
      if (now < blockedUntilPath) {
        return {
          success: false,
          status: 429,
          message: 'Too many requests on this endpoint. Retrying shortly.',
        };
      }
    }
    const response = await apiService.get(finalUrl, headers);
    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      recentSuccessByUrl.set(finalUrl, { at: Date.now(), payload: responseData });
      if (options.cacheKey) {
        const cType = options.cacheType || CacheTypes.DEFAULT;
        await setCache(cType, options.cacheKey, responseData);
      }
      return { success: true, data: responseData, message: options.successMessage || '' };
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
