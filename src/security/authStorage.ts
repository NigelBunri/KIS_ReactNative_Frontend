import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import { DeviceEventEmitter } from 'react-native';
import { Buffer } from 'buffer';
import { clearCacheByKey } from '@/network/cache';

export const AUTH_SESSION_EXPIRED_EVENT = 'auth.session.expired';

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

// In-memory mirror of the access token, kept in sync everywhere the real
// (EncryptedStorage-backed) value changes below - see getAccessTokenCached's
// doc for why this exists. `undefined` means "not read from storage yet
// this app session"; `null` means "read, and there genuinely isn't one".
let cachedAccessToken: string | null | undefined;

const getToken = async (key: string): Promise<string | null> => {
  const secure = await readSecure(key);
  if (secure) return secure;
  return migrateLegacyToken(key);
};

export const getAccessToken = async (): Promise<string | null> => {
  const token = await getToken(ACCESS_TOKEN_KEY);
  cachedAccessToken = token;
  return token;
};

export const getRefreshToken = async (): Promise<string | null> => getToken(REFRESH_TOKEN_KEY);

// Synchronous best-effort read of the access token, for callers that would
// otherwise pay for the async EncryptedStorage round-trip in a way that's
// actively harmful, not just slightly slower - specifically
// network/index.tsx's useMediaHeaders(). A video player's `source` prop
// (uri + headers together) is one object; when its headers arrive a beat
// after mount because that first getAccessToken() call hadn't resolved yet,
// the object's identity changes and react-native-video treats that as "load
// a different video", tearing down and re-initializing the native player
// mid-load. That's a real, measurable extra network round-trip plus a full
// player restart on every single video open - not the async gap itself,
// which is normally invisible, but this specific side effect of it.
// Returns null (not "no token") when nothing has warmed the cache yet this
// session; callers should treat that as "unknown, fall back to the async
// path" rather than "definitely signed out" - by the time a user reaches
// any auth-gated screen, something has already called getAccessToken() and
// warmed this.
export const getAccessTokenCached = (): string | null => cachedAccessToken ?? null;

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
  if (accessToken !== undefined) {
    cachedAccessToken = accessToken ?? null;
  }
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
  cachedAccessToken = null;
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
  DeviceEventEmitter.emit(AUTH_SESSION_EXPIRED_EVENT);
};

// Backend messages from DeviceBoundJWTAuthentication (apps/accounts/jwt_auth.py)
// for a token whose device_id claim can never match this device again — most
// commonly because the stored device_id was regenerated (e.g. AsyncStorage was
// cleared, or the app was reinstalled) while a still-valid refresh token tied
// to the *old* device_id survived in the Keychain. Refreshing the access token
// can't fix this: the new access token inherits the same stale device_id claim
// from the refresh token, so the retry fails the exact same way forever. The
// only fix is a clean re-login, which mints a token pair bound to the current
// device_id.
const UNRECOVERABLE_DEVICE_AUTH_DETAILS = new Set([
  'Device mismatch',
  'Missing X-Device-Id',
  'Device-bound token required',
  'Device session revoked',
]);

export const isUnrecoverableDeviceAuthError = (detail?: unknown): boolean =>
  typeof detail === 'string' && UNRECOVERABLE_DEVICE_AUTH_DETAILS.has(detail);
