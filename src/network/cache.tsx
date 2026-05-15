// network/cache/cache.ts
import RNFS from 'react-native-fs';
import EncryptedStorage from 'react-native-encrypted-storage';
import { CacheTypes, CacheKeys } from './cacheKeys';

const getBaseDirectoryPath = (type?: string) => {
  const normalizedType = normalizeCacheType(type || CacheTypes.DEFAULT);
  if (normalizedType === 'chat_cache') {
    const cacheRoot = RNFS.CachesDirectoryPath || RNFS.DocumentDirectoryPath;
    return `${cacheRoot}/kis_cache`;
  }
  return `${RNFS.DocumentDirectoryPath}/com.kis`;
};

const safePathSegment = (value: string, fallback: string) => {
  const trimmed = String(value || '').trim();
  const safe = trimmed
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || fallback;
};

const normalizeCacheType = (type: string) =>
  safePathSegment(type || CacheTypes.DEFAULT, CacheTypes.DEFAULT).toLowerCase();

const normalizeCacheKey = (key: string) => safePathSegment(key || 'cache', 'cache');

const getSubDirectoryPath = (type: string) =>
  `${getBaseDirectoryPath(type)}/${normalizeCacheType(type)}`;

const getCacheFilePath = (type: string, key: string) =>
  `${getSubDirectoryPath(type)}/${normalizeCacheKey(key)}.json`;

const stripTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const ensureDirectoryExists = async (dirPath: string) => {
  const normalizedPath = stripTrailingSlash(dirPath);
  const exists = await RNFS.exists(normalizedPath);
  if (exists) return;
  try {
    await RNFS.mkdir(normalizedPath);
  } catch (error) {
    const existsAfterError = await RNFS.exists(normalizedPath).catch(() => false);
    if (!existsAfterError) throw error;
  }
};

let cacheRootReady = false;
const ensureCacheRootExists = async () => {
  if (cacheRootReady) return;
  await ensureDirectoryExists(getBaseDirectoryPath(CacheTypes.DEFAULT));
  cacheRootReady = true;
};

const readJson = async (path: string) => {
  try {
    const exists = await RNFS.exists(path);
    if (!exists) return null;
    const content = await RNFS.readFile(path, 'utf8');
    try {
      return JSON.parse(content);
    } catch (error) {
      console.warn(`[cache] Invalid JSON at ${path}:`, error);
      return null;
    }
  } catch (error) {
    console.warn(`[cache] Failed to read ${path}:`, error);
    return null;
  }
};

const writeJson = async (path: string, data: any) => {
  try {
    await RNFS.writeFile(path, JSON.stringify(data), 'utf8');
  } catch (error) {
    console.warn(`[cache] Failed to write ${path}:`, error);
    throw error;
  }
};

const isPaginated = (value: any) =>
  value &&
  typeof value === 'object' &&
  'meta' in value &&
  Array.isArray(value.results);

type OfflineCacheEnvelope = {
  value: any;
  cachedAt: string;
  expiresAt?: string | null;
};

const isOfflineCacheEnvelope = (value: any): value is OfflineCacheEnvelope =>
  value &&
  typeof value === 'object' &&
  value.__kisOfflineCache === true &&
  'value' in value;

const toPaginatedShape = (value: any): { meta?: any; results: any[] } => {
  if (!value) {
    return { meta: undefined, results: [] };
  }

  // Already in paginated form
  if (isPaginated(value)) {
    return { meta: value.meta, results: value.results || [] };
  }

  // Array of items
  if (Array.isArray(value)) {
    return { meta: undefined, results: value };
  }

  // Single item
  return { meta: undefined, results: [value] };
};

const cacheItemIdentity = (item: any) => {
  if (!item || typeof item !== 'object') return Symbol();
  const candidates = [
    item.id,
    item.conversationId,
    item.conversation_id,
    item.uuid,
    item.pk,
    item.clientId,
  ];
  const found = candidates.find((value) => {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    return text.length > 0 && text !== 'null' && text !== 'undefined';
  });
  return found != null ? String(found) : Symbol();
};

export const getCache = async (type: string, key: string) => {
  try {
    const file = getCacheFilePath(type, key);
    const payload = await readJson(file);
    return isOfflineCacheEnvelope(payload) ? payload.value : payload;
  } catch (error) {
    console.warn(`[cache] getCache failed for ${type}/${key}:`, error);
    return null;
  }
};

export const getCacheEnvelope = async (type: string, key: string): Promise<OfflineCacheEnvelope | null> => {
  try {
    const file = getCacheFilePath(type, key);
    const payload = await readJson(file);
    if (isOfflineCacheEnvelope(payload)) return payload;
    if (payload == null) return null;
    return { value: payload, cachedAt: '', expiresAt: null };
  } catch (error) {
    console.warn(`[cache] getCacheEnvelope failed for ${type}/${key}:`, error);
    return null;
  }
};

export const setCache = async (type: string, key: string, data: any) => {
  try {
    await ensureCacheRootExists();
    const dir = getSubDirectoryPath(type);
    const file = getCacheFilePath(type, key);

    await ensureDirectoryExists(getBaseDirectoryPath(type));
    await ensureDirectoryExists(dir);

    const oldValue = await getCache(type, key);

    // --- Case 1: paginated responses { meta, results: [] } ---
    if (isPaginated(oldValue) || isPaginated(data)) {
      const { meta: oldMeta, results: oldResults } = toPaginatedShape(oldValue);
      const { meta: newMeta, results: newResults } = toPaginatedShape(data);

      const map = new Map<any, any>();

      const addToMap = (item: any) => {
        if (item == null) return;
        map.set(cacheItemIdentity(item), item);
      };

      oldResults.forEach(addToMap);
      newResults.forEach(addToMap);

      const results = Array.from(map.values());

      const meta = {
        ...(oldMeta || {}),
        ...(newMeta || {}),
        count: results.length,
      };

      await writeJson(file, { meta, results });
      return;
    }

    // --- Case 2: generic arrays of items (no meta/results wrapper) ---
    if (Array.isArray(oldValue) || Array.isArray(data)) {
      const oldArr = Array.isArray(oldValue)
        ? oldValue
        : oldValue != null
        ? [oldValue]
        : [];
      const newArr = Array.isArray(data) ? data : data != null ? [data] : [];

      const map = new Map<any, any>();

      const addToMap = (item: any) => {
        if (item == null) return;
        if (typeof item === 'object') {
          map.set(cacheItemIdentity(item), item);
        } else {
          // primitive value
          map.set(Symbol(), item);
        }
      };

      oldArr.forEach(addToMap);
      newArr.forEach(addToMap);

      const result = Array.from(map.values());
      await writeJson(file, result);
      return;
    }

    // --- Case 3: simple object or primitive – just overwrite ---
    await writeJson(file, data);
  } catch (error) {
    console.warn(`[cache] setCache failed for ${type}/${key}:`, error);
  }
};

export const setOfflineCache = async (
  type: string,
  key: string,
  data: any,
  ttlSeconds?: number,
) => {
  try {
    await ensureCacheRootExists();
    const dir = getSubDirectoryPath(type);
    const file = getCacheFilePath(type, key);
    await ensureDirectoryExists(getBaseDirectoryPath(type));
    await ensureDirectoryExists(dir);
    const now = new Date();
    const envelope = {
      __kisOfflineCache: true,
      value: data,
      cachedAt: now.toISOString(),
      expiresAt: ttlSeconds ? new Date(now.getTime() + ttlSeconds * 1000).toISOString() : null,
    };
    await writeJson(file, envelope);
  } catch (error) {
    console.warn(`[cache] setOfflineCache failed for ${type}/${key}:`, error);
  }
};

export const getOfflineCache = async (
  type: string,
  key: string,
  options: { allowExpired?: boolean } = {},
) => {
  const envelope = await getCacheEnvelope(type, key);
  if (!envelope) return null;
  if (!options.allowExpired && envelope.expiresAt) {
    const expiresAt = Date.parse(envelope.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      return null;
    }
  }
  return {
    value: envelope.value,
    cachedAt: envelope.cachedAt,
    expiresAt: envelope.expiresAt || null,
    stale: envelope.expiresAt ? Date.parse(envelope.expiresAt) < Date.now() : false,
  };
};

export const clearCacheByKey = async (type: string, key: string) => {
  try {
    const file = getCacheFilePath(type, key);
    const exists = await RNFS.exists(file);
    if (exists) {
      await RNFS.unlink(file);
    }
  } catch (error) {
    console.warn(`[cache] clearCacheByKey failed for ${type}/${key}:`, error);
  }
};

export const clearCacheByType = async (type: string) => {
  try {
    const dir = getSubDirectoryPath(type);
    const exists = await RNFS.exists(dir);
    if (exists) {
      await RNFS.unlink(dir);
    }
  } catch (error) {
    console.warn(`[cache] clearCacheByType failed for ${type}:`, error);
  }
};

export const getUserData = async () => ({
  user: await getCache(CacheTypes.USER_CACHE, CacheKeys.USER_PROFILE),
  token: await getCache(CacheTypes.AUTH_CACHE, CacheKeys.USER_TOKEN),
});

export const setUserData = async (user: any, token: any) => {
  await setCache(CacheTypes.USER_CACHE, CacheKeys.USER_PROFILE, user);
  await setCache(CacheTypes.AUTH_CACHE, CacheKeys.USER_TOKEN, token);
};

export const clearUserData = async () => {
  await clearCacheByType(CacheTypes.USER_CACHE);
  await clearCacheByType(CacheTypes.AUTH_CACHE);
};

// Secure private key storage
export const savePrivateKey = async (key: string, value: string) => {
  await EncryptedStorage.setItem(key, value);
};

export const getPrivateKey = async (key: string) => {
  return EncryptedStorage.getItem(key);
};

export const deletePrivateKey = async (key: string) => {
  await EncryptedStorage.removeItem(key);
};
