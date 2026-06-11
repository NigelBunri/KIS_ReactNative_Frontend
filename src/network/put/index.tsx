// src/network/putRequest.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import type { ApiResult, HeadersInit } from '../types';
import {
  getAccessTokenForRequest,
  refreshAccessToken,
} from '@/security/tokenRefresh';
import { computeRetryDelayMs } from '@/services/performanceOfflineService';

const MAX_PUT_RETRIES = 2;

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

const fetchPutWithRetry = async (execute: () => Promise<Response>): Promise<Response> => {
  let lastError: any;
  for (let attempt = 0; attempt <= MAX_PUT_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, computeRetryDelayMs(attempt - 1, 800, 8000)));
    }
    try {
      return await execute();
    } catch (err: any) {
      lastError = err;
      if (!isTransientError(err) || attempt >= MAX_PUT_RETRIES) throw err;
    }
  }
  throw lastError;
};

export interface PutDataOptions {
  headers?: HeadersInit;
  successMessage?: string;
  errorMessage?: string;
  messages?: {
    success?: string;
    error?: string;
  };
}

export const putData = async (
  url: string,
  data: any,
  options: PutDataOptions = {}
): Promise<ApiResult> => {
  const successMsg = options.successMessage ?? options.messages?.success ?? 'Data updated successfully.';
  const errorMsg = options.errorMessage ?? options.messages?.error ?? 'Failed to update data.';

  try {
    const token = await getAccessTokenForRequest();
    const deviceId = await AsyncStorage.getItem('device_id');

    const isFormData =
      typeof FormData !== 'undefined' &&
      (data instanceof FormData ||
        (data &&
          typeof data === 'object' &&
          typeof (data as any).append === 'function' &&
          Array.isArray((data as any)._parts)));

    const baseHeaders: HeadersInit = { ...(options.headers ?? {}) };
    if (!isFormData) baseHeaders['Content-Type'] = 'application/json';
    if (token) baseHeaders.Authorization = `Bearer ${token}`;
    if (deviceId) baseHeaders['X-Device-Id'] = deviceId;

    const payload = isFormData ? data : sanitizeFileData(data);

    const response = await fetchPutWithRetry(() => apiService.put(url, payload, baseHeaders));
    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      return { success: true, data: responseData, message: successMsg };
    }

    // Silent token refresh on 401
    if (response.status === 401) {
      const newToken = await refreshAccessToken(token);
      if (newToken) {
        const retryHeaders = { ...baseHeaders, Authorization: `Bearer ${newToken}` };
        const retryResponse = await fetchPutWithRetry(() => apiService.put(url, payload, retryHeaders));
        const retryData = await retryResponse.json().catch(() => ({}));
        if (retryResponse.ok) {
          return { success: true, data: retryData, message: successMsg };
        }
        return { success: false, message: errorMsg, status: retryResponse.status, data: retryData };
      }
      return { success: false, message: 'Session expired. Please log in again.', status: 401, data: responseData };
    }

    const msg =
      (responseData && (responseData.message || responseData.detail)) ||
      errorMsg;
    return { success: false, message: msg, status: response.status, data: responseData };
  } catch (error: any) {
    return { success: false, message: error?.message || errorMsg };
  }
};
