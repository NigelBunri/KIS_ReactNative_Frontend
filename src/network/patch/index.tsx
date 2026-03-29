// src/network/patchRequest.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { CacheTypes } from '../cacheKeys';
import { setCache } from '../cache';
import type { ApiResult, HeadersInit } from '../types';
import { getAccessToken } from '@/security/authStorage';

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

export const patchRequest = async (
  url: string,
  data: any,
  options: {
    headers?: HeadersInit;
    cacheKey?: string;
    cacheType?: string;
    successMessage?: string;
    errorMessage?: string;
  } = {}
): Promise<ApiResult> => {
  try {
    const token = await getAccessToken();
    const deviceId = await AsyncStorage.getItem('device_id');

    const isFormData =
      typeof FormData !== 'undefined' &&
      (data instanceof FormData ||
        (data &&
          typeof data === 'object' &&
          typeof (data as any).append === 'function' &&
          Array.isArray((data as any)._parts)));

    const baseHeaders: HeadersInit = {};
    if (!isFormData) {
      baseHeaders['Content-Type'] = 'application/json';
    }
    if (token) baseHeaders.Authorization = `Bearer ${token}`;
    if (deviceId) baseHeaders['X-Device-Id'] = deviceId;

    const headers = { ...baseHeaders, ...(options.headers ?? {}) };
    const payload = isFormData ? data : sanitizeFileData(data);

    const response = await apiService.patch(url, payload, headers);
    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      if (options.cacheKey) {
        const cType = options.cacheType || CacheTypes.DEFAULT;
        await setCache(cType, options.cacheKey, responseData);
      }
      return { success: true, data: responseData, message: options.successMessage || '' };
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
