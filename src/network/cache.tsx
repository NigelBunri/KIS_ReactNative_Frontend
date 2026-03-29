// network/cache/cache.ts
import RNFS from 'react-native-fs';
import EncryptedStorage from 'react-native-encrypted-storage';
import { CacheTypes, CacheKeys } from './cacheKeys';

const getBaseDirectoryPath = () => `${RNFS.DocumentDirectoryPath}/com.kis`;
const normalizeCacheType = (type: string) => {
  const trimmed = String(type || '').trim();
  if (!trimmed) return CacheTypes.DEFAULT;
  return trimmed.replace(/[\\\/]+/g, '_').toLowerCase();
};
const getSubDirectoryPath = (type: string) =>
  `${getBaseDirectoryPath()}/${normalizeCacheType(type)}`;

const stripTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const ensureDirectoryExists = async (dirPath: string) => {
  const normalizedPath = stripTrailingSlash(dirPath);
  const exists = await RNFS.exists(normalizedPath);
  if (!exists) {
    await RNFS.mkdir(normalizedPath);
  }
};

let cacheRootReady = false;
const ensureCacheRootExists = async () => {
  if (cacheRootReady) return;
  await ensureDirectoryExists(getBaseDirectoryPath());
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

export const getCache = async (type: string, key: string) => {
  try {
    const file = `${getSubDirectoryPath(type)}/${key}.json`;
    return await readJson(file);
  } catch (error) {
    console.warn(`[cache] getCache failed for ${type}/${key}:`, error);
    return null;
  }
};

export const setCache = async (type: string, key: string, data: any) => {
  try {
    await ensureCacheRootExists();
    const dir = getSubDirectoryPath(type);
    const file = `${dir}/${key}.json`;

    await ensureDirectoryExists(dir);

    const oldValue = await getCache(type, key);

    // --- Case 1: paginated responses { meta, results: [] } ---
    if (isPaginated(oldValue) || isPaginated(data)) {
      const { meta: oldMeta, results: oldResults } = toPaginatedShape(oldValue);
      const { meta: newMeta, results: newResults } = toPaginatedShape(data);

      const map = new Map<any, any>();

      const addToMap = (item: any) => {
        if (item == null) return;
        const id = typeof item === 'object' && item.id != null ? item.id : Symbol();
        map.set(id, item);
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
          const id = item.id != null ? item.id : Symbol();
          map.set(id, item);
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

export const clearCacheByKey = async (type: string, key: string) => {
  try {
    const file = `${getSubDirectoryPath(type)}/${key}.json`;
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
