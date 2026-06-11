// Handles silent JWT refresh when the access token expires.
// Called by getRequest/postRequest on a 401 response (once per flight).

import { API_BASE_URL } from '@/network/config';
import { getCache, setCache } from '@/network/cache';
import { Buffer } from 'buffer';
import {
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  clearAuthSession,
} from './authStorage';

const REFRESH_URL = `${API_BASE_URL}/api/v1/auth/jwt/refresh/`;

let _refreshPromise: Promise<string | null> | null = null;

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

export async function refreshAccessToken(
  rejectedAccessToken?: string | null,
): Promise<string | null> {
  const currentAccessToken = await getAccessToken();
  if (
    rejectedAccessToken &&
    currentAccessToken &&
    currentAccessToken !== rejectedAccessToken
  ) {
    return currentAccessToken;
  }

  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = _doRefresh(rejectedAccessToken).finally(() => {
    _refreshPromise = null;
  });
  return _refreshPromise;
}

export async function getAccessTokenForRequest(): Promise<string | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const expiresAt = jwtExpiresAt(accessToken);
  if (expiresAt == null || expiresAt > Date.now() + 30_000) {
    return accessToken;
  }

  return refreshAccessToken(accessToken);
}

async function _doRefresh(
  rejectedAccessToken?: string | null,
): Promise<string | null> {
  const currentAccessToken = await getAccessToken();
  if (
    rejectedAccessToken &&
    currentAccessToken &&
    currentAccessToken !== rejectedAccessToken
  ) {
    return currentAccessToken;
  }

  const cachedAuth = await getCache('AUTH_CACHE', 'USER_KEY').catch(() => null);
  const refreshToken =
    (await getRefreshToken()) ||
    cachedAuth?.refresh ||
    cachedAuth?.refresh_token ||
    null;
  if (!refreshToken) return null;

  try {
    const response = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        await clearAuthSession();
      }
      return null;
    }

    const data = await response.json().catch(() => null);
    const newAccess = data?.access ?? data?.access_token ?? null;

    if (!newAccess) {
      await clearAuthSession();
      return null;
    }

    await setAuthTokens({
      accessToken: newAccess,
      refreshToken: data?.refresh ?? data?.refresh_token ?? refreshToken,
    });
    if (cachedAuth && typeof cachedAuth === 'object') {
      await setCache('AUTH_CACHE', 'USER_KEY', {
        ...cachedAuth,
        access: newAccess,
        access_token: newAccess,
        refresh: data?.refresh ?? data?.refresh_token ?? cachedAuth.refresh,
        refresh_token: data?.refresh ?? data?.refresh_token ?? cachedAuth.refresh_token,
      });
    }

    return newAccess;
  } catch {
    return null;
  }
}
