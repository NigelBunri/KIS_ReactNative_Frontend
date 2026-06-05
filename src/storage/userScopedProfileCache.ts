import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCache, getUserData } from '@/network/cache';

export const PROFILE_CACHE_KEY = 'kis_profile_cache_v1';

export const profileCacheKeyForUser = (userId?: string | number | null) => {
  const clean = userId != null ? String(userId).trim() : '';
  return clean ? `${PROFILE_CACHE_KEY}:${clean}` : null;
};

export const extractProfileUserId = (payload?: any): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const user = payload.user ?? payload.profile?.user ?? payload.profile ?? null;
  const candidates = [
    user?.id,
    user?.user_id,
    payload.user_id,
    payload.userId,
    payload.account?.user_id,
    payload.profile?.user_id,
    payload.profile?.userId,
    payload.data?.user?.id,
    payload.data?.user_id,
  ];
  const found = candidates.find(value => {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    return text.length > 0 && text !== 'null' && text !== 'undefined';
  });
  return found != null ? String(found).trim() : null;
};

const pickAuthRecord = (value: any) =>
  Array.isArray(value) ? value.find(Boolean) ?? null : value;

export const getCurrentAuthUserId = async (): Promise<string | null> => {
  const authCache = pickAuthRecord(await getCache('AUTH_CACHE', 'USER_KEY').catch(() => null));
  const cachedUserData = await getUserData().catch(() => null);
  return (
    extractProfileUserId(authCache) ??
    extractProfileUserId(cachedUserData?.user) ??
    extractProfileUserId(cachedUserData) ??
    null
  );
};

export const readScopedProfileCache = async (
  knownUserId?: string | number | null,
): Promise<string | null> => {
  const userId = knownUserId != null ? String(knownUserId).trim() : await getCurrentAuthUserId();
  if (!userId) return null;

  const scopedKey = profileCacheKeyForUser(userId);
  const scoped = scopedKey ? await AsyncStorage.getItem(scopedKey) : null;
  if (scoped) return scoped;

  const legacy = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
  if (!legacy) return null;

  try {
    const legacyUserId = extractProfileUserId(JSON.parse(legacy));
    return legacyUserId && String(legacyUserId) === String(userId) ? legacy : null;
  } catch {
    return null;
  }
};

export const writeScopedProfileCache = async (
  payload: any,
  fallbackUserId?: string | number | null,
) => {
  const userId = extractProfileUserId(payload) ?? (fallbackUserId != null ? String(fallbackUserId).trim() : null);
  const scopedKey = profileCacheKeyForUser(userId);
  if (!scopedKey) return;
  await AsyncStorage.setItem(scopedKey, JSON.stringify(payload));
};

export const clearScopedProfileCache = async (knownUserId?: string | number | null) => {
  const userId = knownUserId != null ? String(knownUserId).trim() : await getCurrentAuthUserId();
  const scopedKey = profileCacheKeyForUser(userId);
  const keys = [PROFILE_CACHE_KEY, scopedKey].filter(Boolean) as string[];
  if (keys.length) {
    await AsyncStorage.multiRemove(keys);
  }
};
