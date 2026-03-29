import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

const readSecure = async (key: string): Promise<string | null> => {
  try {
    return await EncryptedStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeSecure = async (key: string, value: string | null): Promise<void> => {
  try {
    if (!value) {
      await EncryptedStorage.removeItem(key);
      return;
    }
    await EncryptedStorage.setItem(key, value);
  } catch {
    // Best effort: callers remain functional even if secure store is unavailable.
  }
};

const migrateLegacyToken = async (key: string): Promise<string | null> => {
  const legacy = await AsyncStorage.getItem(key);
  if (!legacy) return null;
  await writeSecure(key, legacy);
  await AsyncStorage.removeItem(key);
  return legacy;
};

const getToken = async (key: string): Promise<string | null> => {
  const secure = await readSecure(key);
  if (secure) return secure;
  return migrateLegacyToken(key);
};

export const getAccessToken = async (): Promise<string | null> => getToken(ACCESS_TOKEN_KEY);

export const getRefreshToken = async (): Promise<string | null> => getToken(REFRESH_TOKEN_KEY);

export const setAuthTokens = async (tokens: {
  accessToken?: string | null;
  refreshToken?: string | null;
}): Promise<void> => {
  const { accessToken, refreshToken } = tokens;
  if (accessToken !== undefined) {
    await writeSecure(ACCESS_TOKEN_KEY, accessToken ?? null);
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  if (refreshToken !== undefined) {
    await writeSecure(REFRESH_TOKEN_KEY, refreshToken ?? null);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const clearAuthTokens = async (): Promise<void> => {
  await Promise.all([
    writeSecure(ACCESS_TOKEN_KEY, null),
    writeSecure(REFRESH_TOKEN_KEY, null),
    AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]),
  ]);
};
