// src/services/backgroundPrefetch.ts
// Fire-and-forget background data loader. Called after successful auth.
// It warms the same caches the main tabs read from so navigation feels instant.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { FEEDS_ENDPOINT } from '@/screens/broadcast/feeds/api/feeds.endpoints';
import { setCache } from '@/network/cache';
import {
  CONVERSATION_CACHE_KEY,
  CONVERSATION_CACHE_TYPE,
  normalizeConversation,
} from '@/Module/ChatRoom/normalizeConversation';
import { isOnline } from '@/services/networkMonitor';

let prefetchStarted = false;
let appStateListenerStarted = false;
let currentUserIdRef: string | null | undefined;
let prefetchInFlight = false;
let lastPrefetchStartedAt = 0;

const STARTUP_PREFETCH_DELAY_MS = 1500;
const RESUME_PREFETCH_DELAY_MS = 2500;
const MIN_PREFETCH_INTERVAL_MS = 8 * 60 * 1000;
const TASK_GROUP_PAUSE_MS = 900;
const DEFAULT_OFFLINE_TTL_SECONDS = 30 * 60;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function safe(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error: any) {
    if (__DEV__) {
      console.log(`[backgroundPrefetch] ${label} skipped:`, error?.message || error);
    }
  }
}

export function startBackgroundPrefetch(currentUserId?: string | null): void {
  currentUserIdRef = currentUserId;
  if (!appStateListenerStarted) {
    appStateListenerStarted = true;
    AppState.addEventListener('change', state => {
      if (state === 'active') {
        schedulePrefetch('resume', RESUME_PREFETCH_DELAY_MS);
      }
    });
  }

  if (prefetchStarted) return;
  prefetchStarted = true;
  schedulePrefetch('startup', STARTUP_PREFETCH_DELAY_MS, true);
}

export function resetPrefetchFlag(): void {
  prefetchStarted = false;
  prefetchInFlight = false;
  lastPrefetchStartedAt = 0;
}

function schedulePrefetch(_reason: 'startup' | 'resume', delayMs: number, ignoreInterval = false): void {
  setTimeout(() => {
    void runPrefetch(currentUserIdRef, ignoreInterval);
  }, delayMs);
}

async function runPrefetch(currentUserId?: string | null, ignoreInterval = false): Promise<void> {
  const now = Date.now();
  if (prefetchInFlight) return;
  if (!ignoreInterval && now - lastPrefetchStartedAt < MIN_PREFETCH_INTERVAL_MS) return;

  const online = await isOnline().catch(() => true);
  if (!online) return;

  prefetchInFlight = true;
  lastPrefetchStartedAt = now;
  try {
    await Promise.allSettled([
      safe('messages', () => prefetchMessages(currentUserId)),
      safe('profile', prefetchProfile),
    ]);

    await delay(TASK_GROUP_PAUSE_MS);
    await Promise.allSettled([
      safe('partners', prefetchPartners),
      safe('bible', prefetchBible),
      safe('feeds', prefetchFeeds),
    ]);

    await delay(TASK_GROUP_PAUSE_MS);
    await Promise.allSettled([
      safe('education', prefetchEducation),
      safe('commerce', prefetchCommerce),
      safe('broadcast', prefetchBroadcast),
    ]);
  } finally {
    prefetchInFlight = false;
  }
}

async function prefetchMessages(currentUserId?: string | null): Promise<void> {
  const res = await getRequest(ROUTES.chat.listConversations, {
    cacheKey: `${CONVERSATION_CACHE_KEY}:${currentUserId ? String(currentUserId).trim() : 'anon'}`,
    cacheType: CONVERSATION_CACHE_TYPE,
    offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
    staleWhileRevalidate: true,
  });
  const rawList = Array.isArray(res?.data?.results) ? res.data.results : [];
  if (!rawList.length) return;
  const normalized = rawList.map((item: any) => normalizeConversation(item, currentUserId ?? undefined));
  await AsyncStorage.setItem('kis.conversations_cache', JSON.stringify(normalized));
  await setCache(
    CONVERSATION_CACHE_TYPE,
    `${CONVERSATION_CACHE_KEY}:${currentUserId ? String(currentUserId).trim() : 'anon'}`,
    rawList,
  );
}

async function prefetchProfile(): Promise<void> {
  const res = await getRequest(ROUTES.profiles.me, {
    cacheKey: 'user_profile',
    offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
    staleWhileRevalidate: true,
  });
  if (res?.data) {
    await AsyncStorage.setItem('kis_profile_cache_v1', JSON.stringify(res.data));
  }
}

async function prefetchPartners(): Promise<void> {
  await Promise.allSettled([
    getRequest(ROUTES.partners.list, {
      cacheKey: 'partners_list_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.partners.discover, {
      cacheKey: 'partners_discover_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
  ]);
}

async function prefetchBible(): Promise<void> {
  await Promise.allSettled([
    getRequest(ROUTES.bible.translations, {
      cacheKey: 'bible_translations_v1',
      offlineTtlSeconds: 24 * 60 * 60,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.bible.books, {
      cacheKey: 'bible_books_v1',
      offlineTtlSeconds: 24 * 60 * 60,
      staleWhileRevalidate: true,
    }),
    getRequest(`${ROUTES.bible.dailyToday}?language=en`, {
      cacheKey: 'bible_daily_today_en_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.bible.topics, {
      cacheKey: 'bible_topics_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
  ]);
}

async function prefetchFeeds(): Promise<void> {
  await Promise.allSettled([
    getRequest(`${FEEDS_ENDPOINT}?category=for_you&page=1`, {
      cacheKey: 'feeds_for_you_page_1_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(`${FEEDS_ENDPOINT}?category=following&page=1`, {
      cacheKey: 'feeds_following_page_1_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
  ]);
}

async function prefetchEducation(): Promise<void> {
  await Promise.allSettled([
    getRequest(ROUTES.broadcasts.educationHub, {
      cacheKey: 'education_hub_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.broadcasts.educationInstitutions, {
      cacheKey: 'education_institutions_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.education.discovery, {
      cacheKey: 'education_courses_discovery_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
  ]);
}

async function prefetchCommerce(): Promise<void> {
  const [shopsResponse, ordersResponse] = await Promise.allSettled([
    getRequest(ROUTES.commerce.shops, {
      cacheKey: 'commerce_shops_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.commerce.marketplaceOrders, {
      cacheKey: 'commerce_marketplace_orders_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.commerce.discovery, {
      cacheKey: 'commerce_discovery_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
  ]);

  const shops = shopsResponse.status === 'fulfilled' ? unwrapList(shopsResponse.value?.data) : [];
  if (shops.length) {
    await AsyncStorage.setItem('kis_shops_cache_v1', JSON.stringify(shops));
  }

  const orders = ordersResponse.status === 'fulfilled' ? unwrapList(ordersResponse.value?.data) : [];
  if (orders.length) {
    await AsyncStorage.setItem('kis_orders_cache_v1', JSON.stringify(orders));
  }
}

async function prefetchBroadcast(): Promise<void> {
  await Promise.allSettled([
    getRequest(ROUTES.broadcasts.channels, {
      cacheKey: 'broadcast_channels_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.broadcasts.watchHistory, {
      cacheKey: 'broadcast_watch_history_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.broadcasts.userPlaylists, {
      cacheKey: 'broadcast_user_playlists_v1',
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
  ]);
}

function unwrapList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.shops)) return payload.shops;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}
