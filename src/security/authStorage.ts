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

const writeSecure = async (key: string, value: string | null): Promise<boolean> => {
  try {
    if (!value) {
      await EncryptedStorage.removeItem(key);
      return true;
    }
    await EncryptedStorage.setItem(key, value);
    return true;
  } catch {
    // Some local/dev builds do not have a usable encrypted store.
    // Return false so callers keep the AsyncStorage fallback instead of losing auth.
    return false;
  }
};

const migrateLegacyToken = async (key: string): Promise<string | null> => {
  const legacy = await AsyncStorage.getItem(key);
  if (!legacy) return null;
  const secureWritten = await writeSecure(key, legacy);
  if (secureWritten) {
    await AsyncStorage.removeItem(key);
  }
  return legacy;
};

const getToken = async (key: string): Promise<string | null> => {
  const secure = await readSecure(key);
  if (secure) return secure;
  return migrateLegacyToken(key);
};

export const getAccessToken = async (): Promise<string | null> => getToken(ACCESS_TOKEN_KEY);

export const getRefreshToken = async (): Promise<string | null> => getToken(REFRESH_TOKEN_KEY);

const persistToken = async (key: string, value: string | null | undefined): Promise<void> => {
  if (value === undefined) return;
  if (!value) {
    await writeSecure(key, null);
    await AsyncStorage.removeItem(key);
    return;
  }

  const secureWritten = await writeSecure(key, value);
  if (secureWritten) {
    await AsyncStorage.removeItem(key);
  } else {
    await AsyncStorage.setItem(key, value);
  }
};

export const setAuthTokens = async (tokens: {
  accessToken?: string | null;
  refreshToken?: string | null;
}): Promise<void> => {
  const { accessToken, refreshToken } = tokens;
  await persistToken(ACCESS_TOKEN_KEY, accessToken);
  await persistToken(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearAuthTokens = async (): Promise<void> => {
  await Promise.all([
    writeSecure(ACCESS_TOKEN_KEY, null),
    writeSecure(REFRESH_TOKEN_KEY, null),
    AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]),
  ]);
};
