// src/network/deleteRequest.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import type { ApiResult, HeadersInit } from '../types';
import { getAccessToken } from '@/security/authStorage';

export const deleteRequest = async (
  url: string,
  options: {
    headers?: HeadersInit;
    successMessage?: string;
    errorMessage?: string;
  } = {}
): Promise<ApiResult> => {
  try {
    const token = await getAccessToken();
    const deviceId = await AsyncStorage.getItem('device_id');
    const baseHeaders: HeadersInit = {};
    if (token) baseHeaders.Authorization = `Bearer ${token}`;
    if (deviceId) baseHeaders['X-Device-Id'] = deviceId;

    const headers = { ...baseHeaders, ...(options.headers ?? {}) };
    const response = await apiService.delete(url, headers);
    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
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
