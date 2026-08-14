// Regression tests for QuickLockService's local-cache half of Quick Lock
// multi-device sync. The server-authoritative half (has_pin on
// /api/v1/users/me/ and the login response) is covered on the backend by
// apps.accounts.test_quicklock_pin_multi_device_sync — these tests cover
// what the frontend does with that value: cache it for offline fallback,
// and wipe every local trace on logout so the next account on this device
// doesn't inherit (or get challenged by) a stale PIN/timeout.
jest.mock('@/network/post', () => ({ postRequest: jest.fn(() => Promise.resolve({ success: true, data: {} })) }));
jest.mock('@/network/delete', () => ({ deleteRequest: jest.fn(() => Promise.resolve({ success: true, data: {} })) }));
jest.mock('@/network', () => ({
  __esModule: true,
  default: {
    auth: {
      quicklockPin: 'https://example.test/api/v1/auth/quicklock-pin/',
      quicklockPinVerify: 'https://example.test/api/v1/auth/quicklock-pin/verify/',
    },
  },
}));

import EncryptedStorage from 'react-native-encrypted-storage';
import {
  setPIN,
  clearPIN,
  isPINEnabled,
  getCachedHasPin,
  setCachedHasPin,
  clearLocalQuickLockState,
  getLockTimeout,
  setLockTimeout,
  persistLastActiveAt,
} from '@/services/QuickLockService';

const resetStore = () => (EncryptedStorage as any).__resetMockStore();

describe('QuickLockService — local cache of the server-authoritative has_pin fact', () => {
  beforeEach(resetStore);

  it('getCachedHasPin defaults to false when nothing has been cached yet', async () => {
    await expect(getCachedHasPin()).resolves.toBe(false);
  });

  it('setPIN marks the local has_pin cache true immediately, without waiting on the network', async () => {
    await setPIN('123456');
    await expect(getCachedHasPin()).resolves.toBe(true);
    await expect(isPINEnabled()).resolves.toBe(true);
  });

  it('clearPIN marks the local has_pin cache false', async () => {
    await setPIN('123456');
    await clearPIN();
    await expect(getCachedHasPin()).resolves.toBe(false);
    await expect(isPINEnabled()).resolves.toBe(false);
  });

  it('setCachedHasPin/getCachedHasPin round-trip independently of the PIN itself', async () => {
    await setCachedHasPin(true);
    await expect(getCachedHasPin()).resolves.toBe(true);
    await setCachedHasPin(false);
    await expect(getCachedHasPin()).resolves.toBe(false);
  });
});

describe('QuickLockService — logout must not leak Quick Lock state across accounts', () => {
  beforeEach(resetStore);

  it('clearLocalQuickLockState wipes the PIN, cached has_pin flag, timeout, and activity timestamp', async () => {
    await setPIN('654321');
    await setLockTimeout(30);
    await persistLastActiveAt();

    await clearLocalQuickLockState();

    await expect(isPINEnabled()).resolves.toBe(false);
    await expect(getCachedHasPin()).resolves.toBe(false);
    // getLockTimeout falls back to the 5-minute default once the key is gone.
    await expect(getLockTimeout()).resolves.toBe(5);
  });

  it('a PIN set for one account is gone after logout — the next account starts clean', async () => {
    // Account A sets a PIN on this device.
    await setPIN('111111');
    await expect(isPINEnabled()).resolves.toBe(true);

    // Logout wipes local Quick Lock state (see useProfileController.logout).
    await clearLocalQuickLockState();

    // Account B signs in on the same device — nothing carries over.
    await expect(isPINEnabled()).resolves.toBe(false);
    await expect(getCachedHasPin()).resolves.toBe(false);
  });
});
