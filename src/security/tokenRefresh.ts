// Handles silent JWT refresh when the access token expires.
// Called by getRequest/postRequest on a 401 response (once per flight).

import { API_BASE_URL } from '@/network/config';
import { getRefreshToken, setAuthTokens, clearAuthTokens } from './authStorage';

const REFRESH_URL = `${API_BASE_URL}/api/v1/auth/jwt/refresh/`;

let _refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts.
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = _doRefresh().finally(() => {
    _refreshPromise = null;
  });
  return _refreshPromise;
}

async function _doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      await clearAuthTokens();
      return null;
    }

    const data = await response.json().catch(() => null);
    const newAccess = data?.access ?? data?.access_token ?? null;

    if (!newAccess) {
      await clearAuthTokens();
      return null;
    }

    await setAuthTokens({
      accessToken: newAccess,
      refreshToken: data?.refresh ?? undefined,
    });

    return newAccess;
  } catch {
    await clearAuthTokens();
    return null;
  }
}
