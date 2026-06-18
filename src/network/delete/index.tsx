// src/network/deleteRequest.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import type { ApiResult, HeadersInit } from '../types';
import {
  getAccessTokenForRequest,
  refreshAccessToken,
} from '@/security/tokenRefresh';

export const deleteRequest = async (
  url: string,
  options: {
    headers?: HeadersInit;
    successMessage?: string;
    errorMessage?: string;
    /** Optional JSON body to send with the DELETE request (e.g. for account deletion requiring a password). */
    body?: Record<string, unknown>;
  } = {}
): Promise<ApiResult> => {
  try {
    const token = await getAccessTokenForRequest();
    const deviceId = await AsyncStorage.getItem('device_id');
    const baseHeaders: HeadersInit = {};
    if (token) baseHeaders.Authorization = `Bearer ${token}`;
    if (deviceId) baseHeaders['X-Device-Id'] = deviceId;
    if (options.body) (baseHeaders as any)['Content-Type'] = 'application/json';

    const headers = { ...baseHeaders, ...(options.headers ?? {}) };
    const fetchOptions: RequestInit = { method: 'DELETE', headers: headers as any };
    if (options.body) fetchOptions.body = JSON.stringify(options.body);
    const response = options.body
      ? await fetch(url, fetchOptions)
      : await apiService.delete(url, headers);
    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      return { success: true, data: responseData, message: options.successMessage || '' };
    }

    if (response.status === 401) {
      const newToken = await refreshAccessToken(token);
      if (newToken) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        };
        const retryResponse = options.body
          ? await fetch(url, { method: 'DELETE', headers: retryHeaders as any, body: JSON.stringify(options.body) })
          : await apiService.delete(url, retryHeaders);
        const retryData = await retryResponse.json().catch(() => ({}));
        if (retryResponse.ok) {
          return {
            success: true,
            data: retryData,
            message: options.successMessage || '',
          };
        }
        return {
          success: false,
          message: options.errorMessage || 'Session expired.',
          status: retryResponse.status,
          data: retryData,
        };
      }
      return {
        success: false,
        message: 'Session expired. Please log in again.',
        status: 401,
        data: responseData,
      };
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
