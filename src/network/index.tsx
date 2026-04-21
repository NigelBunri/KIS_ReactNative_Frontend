// network/routes/index.ts
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from '@/security/authStorage';

import authRoutes from './routes/authRoutes';
import broadcastRoutes from './routes/broadcastRoutes';
import healthRoutes from './routes/healthRoutes';
import miscRoutes from './routes/miscRoutes';
import socialRoutes from './routes/socialRoutes';
import adminRoutes from './routes/adminRoutes';
import personalizationRoutes from './routes/personalizationRoutes';
import billingRoutes from './routes/billingRoutes';
import {
  API_BASE_URL,
  BG_REMOVAL_START_URL,
  BG_REMOVAL_STATUS_URL,
  CHAT_BASE_URL,
  CHAT_UPLOAD_URL,
  CHAT_WS_PATH,
  CHAT_WS_URL,
  DEV_BACKEND_HOST,
  EDUCATION_COURSES_ENDPOINT,
  EDUCATION_ENROLL_ENDPOINT,
  EDUCATION_HOME_ENDPOINT,
  EDUCATION_LESSONS_ENDPOINT,
  FEEDS_ENDPOINT,
  NEST_API_BASE_URL,
  WEBSOCKET_URL,
} from './config';

const ROUTES: any = {
  ...authRoutes,
  ...socialRoutes,
  ...broadcastRoutes,
  ...healthRoutes,
  ...miscRoutes,
  ...adminRoutes,
  ...personalizationRoutes,
  billing: billingRoutes,
};

// Keep health analytics endpoints and admin analytics endpoints under one key.
ROUTES.analytics = {
  ...((healthRoutes as any).analytics || {}),
  ...((adminRoutes as any).analytics || {}),
};

export default ROUTES;

export type MediaHeaders = Record<string, string>;
export type MediaSource = { uri: string; headers?: MediaHeaders };

export const buildMediaSource = (
  uri?: string | null,
  headers?: MediaHeaders,
): MediaSource | undefined => {
  if (!uri) return undefined;
  if (headers && Object.keys(headers).length > 0) {
    return { uri, headers };
  }
  return { uri };
};

export const useMediaHeaders = (): MediaHeaders => {
  const [headers, setHeaders] = useState<MediaHeaders>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getAccessToken();
      const deviceId = await AsyncStorage.getItem('device_id');
      if (!active) return;
      const next: MediaHeaders = {};
      if (token) next.Authorization = `Bearer ${token}`;
      if (deviceId) next['X-Device-Id'] = deviceId;
      setHeaders(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  return headers;
};

const NEST_API_HOST = (() => {
  try {
    return new URL(NEST_API_BASE_URL).host;
  } catch {
    return undefined;
  }
})();

export const resolveBackendAssetUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^file:/i.test(trimmed)) {
    return undefined;
  }
  if (/^(?:https?:)?\/\//i.test(trimmed)) {
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }
    try {
      const parsed = new URL(trimmed);
      const pathAndSearch = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      const hostIsLocal =
        parsed.hostname === DEV_BACKEND_HOST ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1' ||
        parsed.hostname === 'localhost';
      if (hostIsLocal) {
        const normalizedBase = API_BASE_URL.replace(/\/$/, '');
        return `${normalizedBase}${pathAndSearch}`;
      }
      if (NEST_API_HOST && parsed.host === NEST_API_HOST) {
        return trimmed;
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${NEST_API_BASE_URL}${normalized}`;
};

export {
  API_BASE_URL,
  CHAT_BASE_URL,
  CHAT_WS_URL,
  CHAT_WS_PATH,
  CHAT_UPLOAD_URL,
  WEBSOCKET_URL,
  FEEDS_ENDPOINT,
  BG_REMOVAL_START_URL,
  BG_REMOVAL_STATUS_URL,
  NEST_API_BASE_URL,
  EDUCATION_HOME_ENDPOINT,
  EDUCATION_LESSONS_ENDPOINT,
  EDUCATION_COURSES_ENDPOINT,
  EDUCATION_ENROLL_ENDPOINT,
};
