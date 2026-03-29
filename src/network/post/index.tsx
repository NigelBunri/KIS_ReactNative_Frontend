// src/network/postRequest.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { setCache } from '../cache';
import { CacheTypes } from '../cacheKeys';
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

export const postRequest = async (
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
    // if (!(await isOnline())) throw new Error('No internet connection.');

    const token = await getAccessToken();
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

    const headers = { ...baseHeaders, ...(options.headers ?? {}) };

    // ❗ Do NOT sanitize FormData or convert it
    const payload = isFormData ? data : sanitizeFileData(data);

    const response = await apiService.post(url, payload, headers);
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

    const msg =
      (responseData && (responseData.message || responseData.detail)) ||
      options.errorMessage ||
      'Request failed.';
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
