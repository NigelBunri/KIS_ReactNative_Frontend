// src/network/postRequest.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { setCache } from '../cache';
import { CacheTypes } from '../cacheKeys';
import type { ApiResult, HeadersInit } from '../types';
import {
  getAccessTokenForRequest,
  refreshAccessToken,
} from '@/security/tokenRefresh';
import { clearAuthSession, isUnrecoverableDeviceAuthError } from '@/security/authStorage';
import { computeRetryDelayMs } from '@/services/performanceOfflineService';
import { formatApiError } from '../formatApiError';

const MAX_POST_RETRIES = 2;

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

const fetchPostWithRetry = async (
  execute: () => Promise<Response>,
): Promise<Response> => {
  let lastError: any;
  for (let attempt = 0; attempt <= MAX_POST_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, computeRetryDelayMs(attempt - 1, 800, 8000)));
    }
    try {
      return await execute();
    } catch (err: any) {
      lastError = err;
      // Only retry transient network errors — NOT 5xx (server may have processed already)
      if (!isTransientError(err) || attempt >= MAX_POST_RETRIES) throw err;
    }
  }
  throw lastError;
};

const sanitizeFileData = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sanitizeFileData);
  if (obj && typeof obj === 'object') {
    if ((obj as any).uri && (obj as any).name && (obj as any).type) return (obj as any).uri;
    const out: any = {};
    for (const k of Object.keys(obj)) out[k] = sanitizeFileData(obj[k]);
    return out;
  }
  return obj;
};

/**
 * Generate a stable idempotency key for a namespace.
 * Reuse the same key on retries to let the server deduplicate.
 */
export const generateIdempotencyKey = (namespace: string): string =>
  `${namespace}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const postRequest = async (
  url: string,
  data: any,
  options: {
    headers?: HeadersInit;
    cacheKey?: string;
    cacheType?: string;
    successMessage?: string;
    errorMessage?: string;
    /** If provided, sent as X-Idempotency-Key header */
    idempotencyKey?: string;
  } = {}
): Promise<ApiResult> => {
  try {
    // if (!(await isOnline())) throw new Error('No internet connection.');

    const token = await getAccessTokenForRequest();
    const deviceId = await AsyncStorage.getItem('device_id');

    // 🔑 Robust FormData detection for React Native
    const isFormData =
      typeof FormData !== 'undefined' &&
      (data instanceof FormData ||
        // RN FormData polyfill check
        (data &&
          typeof data === 'object' &&
          typeof (data as any).append === 'function' &&
          Array.isArray((data as any)._parts)));

    const baseHeaders: HeadersInit = {};
    // ❗ Only set JSON content-type if NOT FormData
    if (!isFormData) {
      baseHeaders['Content-Type'] = 'application/json';
    }
    if (token) baseHeaders.Authorization = `Bearer ${token}`;
    if (deviceId) baseHeaders['X-Device-Id'] = deviceId;

    if (options.idempotencyKey) {
      baseHeaders['X-Idempotency-Key'] = options.idempotencyKey;
    }
    const headers = { ...baseHeaders, ...(options.headers ?? {}) };

    // ❗ Do NOT sanitize FormData or convert it
    const payload = isFormData ? data : sanitizeFileData(data);

    const response = await fetchPostWithRetry(() => apiService.post(url, payload, headers));
    const responseData = await response.json().catch(() => ({}));
    const unwrapPayload = (payload: any) => {
      if (
        payload &&
        typeof payload === 'object' &&
        'success' in payload &&
        payload.success === true &&
        'data' in payload
      ) {
        return payload.data ?? null;
      }
      return payload;
    };
    const successMessage = options.successMessage ?? responseData?.message ?? '';

    if (response.ok) {
      const payload = unwrapPayload(responseData);
      if (options.cacheKey) {
        const cType = options.cacheType || CacheTypes.DEFAULT;
        await setCache(cType, options.cacheKey, payload);
      }
      return {
        success: true,
        data: payload,
        message: successMessage,
      };
    }

    // Attempt a silent token refresh on 401, then retry once.
    if (response.status === 401) {
      const newToken = await refreshAccessToken(token);
      if (newToken) {
        const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retryResponse = await fetchPostWithRetry(() => apiService.post(url, payload, retryHeaders));
        const retryData = await retryResponse.json().catch(() => ({}));
        if (retryResponse.ok) {
          return { success: true, data: unwrapPayload(retryData), message: successMessage };
        }
        console.error('[postRequest] retry after token refresh still failed', {
          url,
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
      console.error('[postRequest] 401 and token refresh failed', {
        url,
        detail: responseData?.detail,
      });
      return {
        success: false,
        message: options.errorMessage || responseData?.detail || 'Session expired. Please log in again.',
        status: 401,
        data: responseData,
      };
    }

    const msg = formatApiError(
      responseData,
      options.errorMessage || 'Request failed.',
    );
    return {
      success: false,
      message: msg,
      status: response.status,
      data: responseData,
    };
  } catch (error: any) {
    return {
      success: false,
      message:
        error?.message || options.errorMessage || 'An error occurred.',
    };
  }
};
