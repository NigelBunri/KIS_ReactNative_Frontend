import { getOfflineCache, setOfflineCache } from '@/network/cache';

export const OFFLINE_STRUCTURED_CACHE_TYPE = 'OFFLINE_STRUCTURED_CACHE';
export const DEFAULT_STRUCTURED_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

export type OfflineCacheMeta = {
  fromCache: boolean;
  cachedAt?: string | null;
  stale?: boolean;
};

export type OfflineStructuredCacheHit<T> = {
  data: T;
  meta: OfflineCacheMeta;
};

const cleanPart = (part: unknown) =>
  String(part ?? 'none')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);

export const offlineStructuredCacheKey = (...parts: unknown[]) =>
  parts.map(cleanPart).filter(Boolean).join(':') || 'default';

export const readOfflineStructuredCache = async <T>(
  key: string,
): Promise<OfflineStructuredCacheHit<T> | null> => {
  const cached = await getOfflineCache(OFFLINE_STRUCTURED_CACHE_TYPE, key, {
    allowExpired: true,
  });
  if (!cached) return null;
  return {
    data: cached.value as T,
    meta: {
      fromCache: true,
      cachedAt: cached.cachedAt ?? null,
      stale: !!cached.stale,
    },
  };
};

export const writeOfflineStructuredCache = async <T>(
  key: string,
  data: T,
  ttlSeconds: number = DEFAULT_STRUCTURED_CACHE_TTL_SECONDS,
) => {
  await setOfflineCache(OFFLINE_STRUCTURED_CACHE_TYPE, key, data, ttlSeconds);
};

export const freshOfflineMeta: OfflineCacheMeta = {
  fromCache: false,
  cachedAt: null,
  stale: false,
};
