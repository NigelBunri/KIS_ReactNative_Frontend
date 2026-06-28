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
import { getCurrentAuthUserId, writeScopedProfileCache } from '@/storage/userScopedProfileCache';

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

export async function prefetchNow(currentUserId?: string | null): Promise<void> {
  await runPrefetch(currentUserId, true);
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
      safe('profile', () => prefetchProfile(currentUserId)),
    ]);

    await delay(TASK_GROUP_PAUSE_MS);
    await Promise.allSettled([
      safe('partners', () => prefetchPartners(currentUserId)),
      safe('bible', prefetchBible),
      safe('feeds', () => prefetchFeeds(currentUserId)),
    ]);

    await delay(TASK_GROUP_PAUSE_MS);
    await Promise.allSettled([
      safe('education', prefetchEducation),
      safe('commerce', prefetchCommerce),
      safe('broadcast', () => prefetchBroadcast(currentUserId)),
    ]);
  } finally {
    prefetchInFlight = false;
  }
}

async function prefetchMessages(currentUserId?: string | null): Promise<void> {
  const effectiveUserId = currentUserId ? String(currentUserId).trim() : await getCurrentAuthUserId().catch(() => null);
  if (!effectiveUserId) return;
  const res = await getRequest(ROUTES.chat.listConversations, {
    cacheKey: `${CONVERSATION_CACHE_KEY}:${effectiveUserId}`,
    cacheType: CONVERSATION_CACHE_TYPE,
    offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
    staleWhileRevalidate: true,
  });
  const rawList = Array.isArray(res?.data?.results) ? res.data.results : [];
  if (!rawList.length) return;
  const normalized = rawList.map((item: any) => normalizeConversation(item, effectiveUserId));
  const normalizedCacheKey = `kis.conversations_cache:${effectiveUserId}`;
  let existing: any[] = [];
  try {
    const raw = await AsyncStorage.getItem(normalizedCacheKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) existing = parsed;
  } catch {}
  const byId = new Map<string, any>();
  [...existing, ...normalized].forEach((conversation) => {
    const id = String(conversation?.conversationId ?? conversation?.id ?? '').trim();
    if (id) byId.set(id, { ...(byId.get(id) ?? {}), ...conversation });
  });
  await AsyncStorage.setItem(normalizedCacheKey, JSON.stringify(Array.from(byId.values())));
  await setCache(
    CONVERSATION_CACHE_TYPE,
    `${CONVERSATION_CACHE_KEY}:${effectiveUserId}`,
    rawList,
  );
}

async function prefetchProfile(currentUserId?: string | null): Promise<void> {
  const effectiveUserId = currentUserId ? String(currentUserId).trim() : await getCurrentAuthUserId().catch(() => null);
  if (!effectiveUserId) return;
  const res = await getRequest(ROUTES.profiles.me, {
    cacheKey: `user_profile:${effectiveUserId}`,
    offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
    staleWhileRevalidate: true,
  });
  if (res?.data) {
    await writeScopedProfileCache(res.data, effectiveUserId);
  }
}

async function prefetchPartners(currentUserId?: string | null): Promise<void> {
  const effectiveUserId = currentUserId ? String(currentUserId).trim() : await getCurrentAuthUserId().catch(() => null);
  if (!effectiveUserId) return;
  await Promise.allSettled([
    getRequest(ROUTES.partners.list, {
      cacheKey: `partners_list_v1:${effectiveUserId}`,
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.partners.discover, {
      cacheKey: `partners_discover_v1:${effectiveUserId}`,
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

async function prefetchFeeds(currentUserId?: string | null): Promise<void> {
  const effectiveUserId = currentUserId ? String(currentUserId).trim() : await getCurrentAuthUserId().catch(() => null);
  if (!effectiveUserId) return;
  await Promise.allSettled([
    getRequest(`${FEEDS_ENDPOINT}?category=for_you&page=1`, {
      cacheKey: `feeds_for_you_page_1_v1:${effectiveUserId}`,
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(`${FEEDS_ENDPOINT}?category=following&page=1`, {
      cacheKey: `feeds_following_page_1_v1:${effectiveUserId}`,
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

async function prefetchBroadcast(currentUserId?: string | null): Promise<void> {
  const effectiveUserId = currentUserId ? String(currentUserId).trim() : await getCurrentAuthUserId().catch(() => null);
  if (!effectiveUserId) return;
  await Promise.allSettled([
    getRequest(ROUTES.broadcasts.channels, {
      cacheKey: `broadcast_channels_v1:${effectiveUserId}`,
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.broadcasts.watchHistory, {
      cacheKey: `broadcast_watch_history_v1:${effectiveUserId}`,
      offlineTtlSeconds: DEFAULT_OFFLINE_TTL_SECONDS,
      staleWhileRevalidate: true,
    }),
    getRequest(ROUTES.broadcasts.userPlaylists, {
      cacheKey: `broadcast_user_playlists_v1:${effectiveUserId}`,
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
