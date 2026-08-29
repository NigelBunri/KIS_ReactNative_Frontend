// network/routes/index.ts
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken, getAccessTokenCached } from '@/security/authStorage';

import authRoutes from './routes/authRoutes';
import broadcastRoutes from './routes/broadcastRoutes';
import healthRoutes from './routes/healthRoutes';
import miscRoutes from './routes/miscRoutes';
import socialRoutes from './routes/socialRoutes';
import adminRoutes from './routes/adminRoutes';
import personalizationRoutes from './routes/personalizationRoutes';
import billingRoutes from './routes/billingRoutes';
import rewardsRoutes from './routes/rewardsRoutes';
import referralsRoutes from './routes/referralsRoutes';
import testimonyRoutes from './routes/testimonyRoutes';
import churchRoutes from './routes/churchRoutes';
import familyRoutes from './routes/familyRoutes';
import governmentRoutes from './routes/governmentRoutes';
import businessRoutes from './routes/businessRoutes';
import mediaExtendedRoutes from './routes/mediaExtendedRoutes';
import healthExtendedRoutes from './routes/healthExtendedRoutes';
import localizationRoutes from './routes/localizationRoutes';
import {
  API_BASE_URL,
  BG_REMOVAL_START_URL,
  BG_REMOVAL_STATUS_URL,
  CHAT_BASE_URL,
  CHAT_UPLOAD_URL,
  CHAT_UPLOAD_INITIATE_URL,
  CHAT_UPLOAD_CONFIRM_URL,
  CHAT_WS_PATH,
  CHAT_WS_URL,
  DEV_BACKEND_HOST,
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
  rewards: rewardsRoutes,
  referrals: referralsRoutes,
  ...testimonyRoutes,
  ...churchRoutes,
  ...familyRoutes,
  ...governmentRoutes,
  ...businessRoutes,
  ...mediaExtendedRoutes,
  ...healthExtendedRoutes,
  ...localizationRoutes,
};

// authRoutes owns the current-user profile endpoints while socialRoutes adds
// discovery and social profile actions. A shallow spread replaces the entire
// nested object, which previously removed profiles.me/view/update at runtime.
ROUTES.profiles = {
  ...((authRoutes as any).profiles || {}),
  ...((socialRoutes as any).profiles || {}),
};

ROUTES.events = {
  ...((adminRoutes as any).events || {}),
  ...((socialRoutes as any).events || {}),
};

ROUTES.surveys = {
  ...((adminRoutes as any).surveys || {}),
  ...((miscRoutes as any).surveys || {}),
};

ROUTES.notifications = {
  ...((authRoutes as any).notifications || {}),
  ...((adminRoutes as any).notifications || {}),
};

ROUTES.moderation = {
  ...((socialRoutes as any).moderation || {}),
  ...((miscRoutes as any).moderation || {}),
};

ROUTES.content = {
  ...((socialRoutes as any).content || {}),
  ...((adminRoutes as any).content || {}),
};

ROUTES.jobs = {
  ...((authRoutes as any).jobs || {}),
  ...((socialRoutes as any).jobs || {}),
};

ROUTES.connections = {
  ...((authRoutes as any).connections || {}),
  ...((socialRoutes as any).connections || {}),
};

// Keep health analytics endpoints and admin analytics endpoints under one key.
ROUTES.analytics = {
  ...((healthRoutes as any).analytics || {}),
  ...((adminRoutes as any).analytics || {}),
};

ROUTES.tiers = {
  plans: billingRoutes.tierPlans,
  plan: billingRoutes.tierPlan,
  subscriptions: billingRoutes.tierSubscriptions,
  subscription: billingRoutes.tierSubscription,
  entitlements: billingRoutes.tierEntitlements,
  usage: billingRoutes.tierUsage,
  campaigns: billingRoutes.tierCampaigns,
  campaign: billingRoutes.tierCampaign,
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

// Local mirror of AsyncStorage['device_id'], same reasoning as
// getAccessTokenCached in authStorage.ts: useMediaHeaders below builds the
// headers object react-native-video's `source` prop carries, and that
// object's identity changing shortly after mount (once an async read
// resolves) makes the native player tear down and restart mid-load, not
// just re-render. Populated opportunistically the first time anything in
// this hook actually reads the value, so only the very first video opened
// in a session can still hit the async gap - every one after is synchronous.
let cachedDeviceId: string | null = null;

export const useMediaHeaders = (): MediaHeaders => {
  const [headers, setHeaders] = useState<MediaHeaders>(() => {
    const next: MediaHeaders = {};
    const cachedToken = getAccessTokenCached();
    if (cachedToken) next.Authorization = `Bearer ${cachedToken}`;
    if (cachedDeviceId) next['X-Device-Id'] = cachedDeviceId;
    return next;
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getAccessToken();
      const deviceId = (await AsyncStorage.getItem('device_id')) ?? cachedDeviceId;
      cachedDeviceId = deviceId;
      if (!active) return;
      const next: MediaHeaders = {};
      if (token) next.Authorization = `Bearer ${token}`;
      if (deviceId) next['X-Device-Id'] = deviceId;
      // Skip the setState (and the source-object-identity change a caller
      // like useVideoPlayer's videoSource memo would see from it) entirely
      // when nothing actually changed from the synchronous seed above -
      // the common case once both caches are warm.
      setHeaders((prev) => {
        if (prev.Authorization === next.Authorization && prev['X-Device-Id'] === next['X-Device-Id']) {
          return prev;
        }
        return next;
      });
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
  // Relative media paths are issued by Django's upload/media endpoints.
  // Nest URLs are already absolute and are preserved by the branch above.
  return `${API_BASE_URL.replace(/\/$/, '')}${normalized}`;
};

export {
  API_BASE_URL,
  CHAT_BASE_URL,
  CHAT_WS_URL,
  CHAT_WS_PATH,
  CHAT_UPLOAD_URL,
  CHAT_UPLOAD_INITIATE_URL,
  CHAT_UPLOAD_CONFIRM_URL,
  WEBSOCKET_URL,
  FEEDS_ENDPOINT,
  BG_REMOVAL_START_URL,
  BG_REMOVAL_STATUS_URL,
  NEST_API_BASE_URL,
};
