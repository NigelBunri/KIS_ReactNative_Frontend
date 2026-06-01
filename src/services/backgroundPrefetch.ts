// src/services/backgroundPrefetch.ts
// Fire-and-forget background data loader. Called once after successful auth.
// Writes to the same AsyncStorage cache keys the tab hooks already read from,
// so when users navigate to those tabs the data is already warm.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { FEEDS_ENDPOINT } from '@/screens/broadcast/feeds/api/feeds.endpoints';

let prefetchStarted = false;

async function safe(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch {
    // Never surface errors — this is best-effort background work
  }
}

export function startBackgroundPrefetch(currentUserId?: string | null): void {
  if (prefetchStarted) return;
  prefetchStarted = true;

  // Delay slightly so the messages tab (first screen) gets priority network access
  setTimeout(() => {
    void runPrefetch(currentUserId);
  }, 2000);
}

export function resetPrefetchFlag(): void {
  prefetchStarted = false;
}

async function runPrefetch(currentUserId?: string | null): Promise<void> {
  await Promise.allSettled([
    safe('profile', prefetchProfile),
    safe('partners', prefetchPartners),
    safe('bible', prefetchBible),
    safe('feeds', prefetchFeeds),
  ]);
}

async function prefetchProfile(): Promise<void> {
  const res = await getRequest(ROUTES.profiles.me, {
    cacheKey: 'user_profile',
    forceNetwork: true,
  });
  if (res?.data) {
    await AsyncStorage.setItem('kis_profile_cache_v1', JSON.stringify(res.data));
  }
}

async function prefetchPartners(): Promise<void> {
  await getRequest(ROUTES.partners.list, {
    cacheKey: 'partners_list_v1',
    forceNetwork: true,
  });
}

async function prefetchBible(): Promise<void> {
  await Promise.all([
    getRequest(ROUTES.bible.translations, {
      cacheKey: 'bible_translations_v1',
      forceNetwork: true,
    }),
    getRequest(ROUTES.bible.books, {
      cacheKey: 'bible_books_v1',
      forceNetwork: true,
    }),
    getRequest(`${ROUTES.bible.dailyToday}?language=en`, {
      forceNetwork: true,
    }),
  ]);
}

async function prefetchFeeds(): Promise<void> {
  await getRequest(`${FEEDS_ENDPOINT}?category=for_you&page=1`, {
    forceNetwork: true,
  });
}
