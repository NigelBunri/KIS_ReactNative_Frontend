import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import { Buffer } from 'buffer';
import { clearCacheByKey } from '@/network/cache';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const AUTH_SESSION_KEY = 'kis.auth.signed_in_session.v1';

type PersistedAuthSession = {
  signedIn: true;
  expiresAt: number | null;
  updatedAt: number;
};

const jwtExpiresAt = (token?: string | null): number | null => {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return typeof decoded?.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

const persistSignedInSession = async (
  refreshToken?: string | null,
  accessToken?: string | null,
) => {
  const expiresAt = jwtExpiresAt(refreshToken) ?? jwtExpiresAt(accessToken);
  const session: PersistedAuthSession = {
    signedIn: true,
    expiresAt,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
};

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
  if (accessToken || refreshToken) {
    await persistSignedInSession(refreshToken, accessToken);
  }
};

export const getPersistedAuthSession = async (): Promise<{
  signedIn: boolean;
  expired: boolean;
  expiresAt: number | null;
}> => {
  try {
    const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return { signedIn: false, expired: false, expiresAt: null };
    const session = JSON.parse(raw) as Partial<PersistedAuthSession>;
    const expiresAt =
      typeof session.expiresAt === 'number' ? session.expiresAt : null;
    const expired = expiresAt != null && expiresAt <= Date.now();
    return {
      signedIn: session.signedIn === true && !expired,
      expired,
      expiresAt,
    };
  } catch {
    return { signedIn: false, expired: false, expiresAt: null };
  }
};

export const clearAuthTokens = async (): Promise<void> => {
  await Promise.all([
    writeSecure(ACCESS_TOKEN_KEY, null),
    writeSecure(REFRESH_TOKEN_KEY, null),
    AsyncStorage.multiRemove([
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      AUTH_SESSION_KEY,
    ]),
  ]);
};

export const clearAuthSession = async (): Promise<void> => {
  await Promise.all([
    clearAuthTokens(),
    clearCacheByKey('AUTH_CACHE', 'USER_KEY'),
  ]);
};
