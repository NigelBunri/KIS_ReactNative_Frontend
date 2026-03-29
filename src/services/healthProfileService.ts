import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HEALTH_PROFILE_CACHE_KEY = 'kis_health_profile_cache_v1';
let healthProfileReadBlockedUntil = 0;
let healthProfileWriteBlockedUntil = 0;
const logHealthProfile = (...args: any[]) => {
  console.log('[healthProfileService]', ...args);
};

const parseThrottleDelayMs = (message: unknown): number | null => {
  const text = String(message ?? '');
  const match = text.match(/available in\s+(\d+)\s+seconds?/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds * 1000;
};

const resolveHealthProfile = (responseData: any) => {
  const profiles = responseData?.profiles ?? {};
  if (Array.isArray(profiles)) {
    const matched =
      profiles.find((item: any) => item?.profile_type === 'health_profile') ??
      profiles.find((item: any) => item?.type === 'health_profile') ??
      profiles.find((item: any) => item?.key === 'health_profile') ??
      null;
    if (matched) return matched;
  }
  return (
    profiles?.health ??
    profiles?.health_profile ??
    profiles?.healthProfile ??
    responseData?.profile ??
    responseData?.result?.profile ??
    responseData?.result?.health ??
    responseData?.result?.health_profile ??
    responseData?.result?.healthProfile ??
    responseData?.health ??
    responseData?.health_profile ??
    responseData?.healthProfile ??
    null
  );
};

const normalizeHealthProfileForCache = (profile: any) => {
  if (!profile || typeof profile !== 'object') return null;
  const institutions = resolveInstitutions(profile);
  return { ...profile, institutions };
};

const resolveInstitutions = (profile: any): any[] => {
  // Prefer backend authoritative slices before generic institutions to avoid stale
  // copied payload entries overriding current member-role state.
  const candidates = [
    profile?.owned_institutions,
    profile?.ownedInstitutions,
    profile?.member_institutions,
    profile?.memberInstitutions,
    profile?.institutions,
    profile?.payload?.institutions,
    profile?.payload?.owned_institutions,
    profile?.payload?.member_institutions,
    profile?.data?.institutions,
    profile?.updates?.institutions,
    profile?.payload?.updates?.institutions,
    profile?.meta?.institutions,
  ];
  const merged: any[] = [];
  const seen = new Set<string>();
  for (const value of candidates) {
    if (!Array.isArray(value)) continue;
    for (const institution of value) {
      if (!institution || typeof institution !== 'object') continue;
      const id = String((institution as any)?.id || '').trim();
      const name = String((institution as any)?.name || '').trim().toLowerCase();
      const key = id ? `id:${id}` : name ? `name:${name}` : '';
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      merged.push(institution);
    }
  }
  return merged;
};

const resolveHasOwnerProfile = (profile: any): boolean => {
  if (!profile || typeof profile !== 'object') return false;
  if (typeof profile?.has_owner_profile === 'boolean') return profile.has_owner_profile;
  if (typeof profile?.hasOwnerProfile === 'boolean') return profile.hasOwnerProfile;
  const accessMode = String(profile?.viewer_access_mode || profile?.viewerAccessMode || '').trim().toLowerCase();
  if (accessMode === 'member') return false;
  return true;
};

const readCachedHealthProfile = async () => {
  try {
    const raw = await AsyncStorage.getItem(HEALTH_PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const institutions = resolveInstitutions(parsed);
    return { ...parsed, institutions };
  } catch {
    return null;
  }
};

const writeCachedHealthProfile = async (profile: any) => {
  try {
    await AsyncStorage.setItem(HEALTH_PROFILE_CACHE_KEY, JSON.stringify(profile ?? {}));
  } catch {}
};

export const fetchHealthProfileState = async (options?: { forceNetwork?: boolean }) => {
  const cached = await readCachedHealthProfile();
  logHealthProfile('fetchHealthProfileState:start', {
    forceNetwork: !!options?.forceNetwork,
    hasCached: !!cached,
    cachedInstitutions: Array.isArray(cached?.institutions) ? cached.institutions.length : 0,
    blockedUntil: healthProfileReadBlockedUntil,
    now: Date.now(),
  });
  if (Date.now() < healthProfileReadBlockedUntil) {
    logHealthProfile('fetchHealthProfileState:blocked:returning-cache');
    return {
      profile: cached,
      exists: resolveHasOwnerProfile(cached),
    };
  }
  const res = await getRequest(ROUTES.broadcasts.createProfile, {
    forceNetwork: !!options?.forceNetwork,
  });
  if (!res?.success) {
    logHealthProfile('fetchHealthProfileState:request-failed', {
      status: res?.status,
      message: res?.message,
    });
    if (Number(res?.status) === 429) {
      const delayMs = parseThrottleDelayMs(res?.message);
      healthProfileReadBlockedUntil =
        Date.now() + (delayMs && delayMs > 0 ? delayMs : 2 * 60 * 1000);
      logHealthProfile('fetchHealthProfileState:rate-limited', {
        delayMs: delayMs ?? 2 * 60 * 1000,
        blockedUntil: healthProfileReadBlockedUntil,
      });
    }
    return {
      profile: cached,
      exists: resolveHasOwnerProfile(cached),
    };
  }
  const normalized = normalizeHealthProfileForCache(resolveHealthProfile(res?.data));
  const institutions = Array.isArray(normalized?.institutions) ? normalized.institutions : [];
  logHealthProfile('fetchHealthProfileState:request-success', {
    hasProfile: !!normalized,
    institutions: institutions.length,
    profileKeys: normalized && typeof normalized === 'object' ? Object.keys(normalized).slice(0, 20) : [],
  });
  if (normalized) {
    await writeCachedHealthProfile(normalized);
    logHealthProfile('fetchHealthProfileState:cache-updated', {
      institutions: normalized?.institutions?.length ?? 0,
    });
  }
  return {
    profile: normalized ?? cached,
    exists: resolveHasOwnerProfile(normalized ?? cached),
  };
};

export const fetchHealthProfile = async () => {
  const result = await fetchHealthProfileState();
  return result.profile;
};

export const createHealthProfile = async (institutions: any[], profileName = 'Health Profile') => {
  logHealthProfile('createHealthProfile:start', {
    institutions: Array.isArray(institutions) ? institutions.length : 0,
    profileName,
    writeBlockedUntil: healthProfileWriteBlockedUntil,
    now: Date.now(),
  });
  if (Date.now() < healthProfileWriteBlockedUntil) {
    logHealthProfile('createHealthProfile:blocked-fallback-to-update');
    return updateHealthInstitutions(institutions);
  }
  const res = await postRequest(ROUTES.broadcasts.createProfile, {
    profile_type: 'health_profile',
    payload: {
      profile_name: profileName,
      institutions,
    },
  });
  if (res?.success) {
    const normalized = normalizeHealthProfileForCache(resolveHealthProfile(res?.data));
    logHealthProfile('createHealthProfile:success');
    if (normalized) {
      await writeCachedHealthProfile(normalized);
    } else {
      await writeCachedHealthProfile({
        profile_type: 'health_profile',
        payload: { profile_name: profileName, institutions },
        institutions,
      });
    }
    return res;
  }
  if (Number(res?.status) === 429) {
    logHealthProfile('createHealthProfile:rate-limited', {
      status: res?.status,
      message: res?.message,
    });
    const delayMs = parseThrottleDelayMs(res?.message);
    healthProfileWriteBlockedUntil =
      Date.now() + (delayMs && delayMs > 0 ? delayMs : 2 * 60 * 1000);
    // Fallback to profile manage endpoint; backend accepts institutions updates there.
    return updateHealthInstitutions(institutions);
  }
  return res;
};

export const updateHealthInstitutions = async (institutions: any[]) => {
  logHealthProfile('updateHealthInstitutions:start', {
    institutions: Array.isArray(institutions) ? institutions.length : 0,
  });
  const res = await postRequest(ROUTES.broadcasts.profileManage, {
    profile_type: 'health_profile',
    updates: {
      institutions,
    },
  });
  if (Number(res?.status) === 429) {
    logHealthProfile('updateHealthInstitutions:rate-limited', {
      status: res?.status,
      message: res?.message,
    });
    const delayMs = parseThrottleDelayMs(res?.message);
    healthProfileWriteBlockedUntil =
      Date.now() + (delayMs && delayMs > 0 ? delayMs : 2 * 60 * 1000);
  }
  if (res?.success) {
    const normalized = normalizeHealthProfileForCache(resolveHealthProfile(res?.data));
    logHealthProfile('updateHealthInstitutions:success');
    const cached = await readCachedHealthProfile();
    if (normalized) {
      await writeCachedHealthProfile({
        ...(cached ?? {}),
        ...normalized,
      });
    } else {
      await writeCachedHealthProfile({
        ...(cached ?? { profile_type: 'health_profile' }),
        institutions,
        payload: {
          ...(cached?.payload ?? {}),
          institutions,
        },
        updates: {
          ...(cached?.updates ?? {}),
          institutions,
        },
      });
    }
  }
  if (!res?.success) {
    logHealthProfile('updateHealthInstitutions:failed-caching-locally', {
      status: res?.status,
      message: res?.message,
    });
    const cached = await readCachedHealthProfile();
    await writeCachedHealthProfile({
      ...(cached ?? { profile_type: 'health_profile' }),
      institutions,
      payload: {
        ...(cached?.payload ?? {}),
        institutions,
      },
      updates: {
        ...(cached?.updates ?? {}),
        institutions,
      },
    });
  }
  return res;
};
