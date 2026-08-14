// src/services/QuickLockService.ts
// PIN-based Quick Lock using react-native-encrypted-storage, backed by Django
import EncryptedStorage from 'react-native-encrypted-storage';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';

const KEY_PIN = 'kis_quick_lock_pin';
const KEY_TIMEOUT = 'kis_quick_lock_timeout_minutes';
// Cached mirror of the server-authoritative "does this account have a PIN"
// fact (see UserSerializer.has_pin), used only as an offline fallback when
// /users/me/ can't be reached — never treated as a competing source of truth.
const KEY_HAS_PIN_CACHE = 'kis_quick_lock_has_pin_cache';

const DEFAULT_TIMEOUT_MINUTES = 5;

/**
 * @deprecated Local-only and does not reflect a PIN created on another
 * device. Use the server-authoritative `hasPin` from AuthContext
 * (hydrated from `has_pin` on /users/me/ and the login response) instead.
 * Retained for the offline-verify fallback inside validatePIN.
 */
export async function isPINEnabled(): Promise<boolean> {
  try {
    const stored = await EncryptedStorage.getItem(KEY_PIN);
    return typeof stored === 'string' && stored.length === 6;
  } catch {
    return false;
  }
}

export async function getCachedHasPin(): Promise<boolean> {
  try {
    return (await EncryptedStorage.getItem(KEY_HAS_PIN_CACHE)) === '1';
  } catch {
    return false;
  }
}

export async function setCachedHasPin(hasPin: boolean): Promise<void> {
  try {
    await EncryptedStorage.setItem(KEY_HAS_PIN_CACHE, hasPin ? '1' : '0');
  } catch {
    // Best-effort; ignore errors
  }
}

export async function setPIN(pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be exactly 6 digits.');
  }
  // Store locally for offline unlock
  await EncryptedStorage.setItem(KEY_PIN, pin);
  await setCachedHasPin(true);
  // Back up to server (best-effort; local copy is the authoritative unlock key)
  postRequest(ROUTES.auth.quicklockPin, { pin }).catch(() => null);
}

export async function validatePIN(pin: string): Promise<boolean> {
  try {
    // Primary: check local encrypted storage (works offline)
    const stored = await EncryptedStorage.getItem(KEY_PIN);
    if (stored !== null) {
      return stored === pin;
    }
    // Fallback: verify against backend when no local copy exists
    const res = await postRequest(ROUTES.auth.quicklockPinVerify, { pin });
    return Boolean(res?.data?.valid);
  } catch {
    return false;
  }
}

export async function clearPIN(): Promise<void> {
  try {
    await EncryptedStorage.removeItem(KEY_PIN);
  } catch {
    // Ignore removal errors
  }
  await setCachedHasPin(false);
  // Clear from backend (best-effort)
  deleteRequest(ROUTES.auth.quicklockPin).catch(() => null);
}

/**
 * Wipes all device-local Quick Lock state (PIN, cached has-pin flag, lock
 * timeout, last-active timestamp) without touching the backend record.
 * Must run on logout — otherwise the next account to sign in on this
 * device inherits the previous account's local PIN/timeout and could be
 * unlocked with, or challenged by, someone else's PIN.
 */
export async function clearLocalQuickLockState(): Promise<void> {
  try {
    await EncryptedStorage.removeItem(KEY_PIN);
    await EncryptedStorage.removeItem(KEY_TIMEOUT);
    await EncryptedStorage.removeItem(KEY_HAS_PIN_CACHE);
    await EncryptedStorage.removeItem(KEY_LAST_ACTIVE);
  } catch {
    // Best-effort; ignore errors
  }
}

export async function getLockTimeout(): Promise<number> {
  try {
    const stored = await EncryptedStorage.getItem(KEY_TIMEOUT);
    if (stored === null) return DEFAULT_TIMEOUT_MINUTES;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : DEFAULT_TIMEOUT_MINUTES;
  } catch {
    return DEFAULT_TIMEOUT_MINUTES;
  }
}

export async function setLockTimeout(minutes: number): Promise<void> {
  await EncryptedStorage.setItem(KEY_TIMEOUT, String(minutes));
}

const KEY_LAST_ACTIVE = 'kis_last_active_at';

export async function persistLastActiveAt(): Promise<void> {
  try {
    await EncryptedStorage.setItem(KEY_LAST_ACTIVE, String(Date.now()));
  } catch {
    // Best-effort; ignore errors
  }
}

export async function getPersistedLastActiveAt(): Promise<number> {
  try {
    const stored = await EncryptedStorage.getItem(KEY_LAST_ACTIVE);
    if (stored === null) return Date.now();
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : Date.now();
  } catch {
    return Date.now();
  }
}

/**
 * @deprecated Synchronous shouldLock cannot reliably check PIN state.
 * Use shouldLockAsync instead.
 */
export function shouldLock(_lastActiveAt: number): never {
  throw new Error('Use shouldLockAsync instead of shouldLock');
}

export async function shouldLockAsync(lastActiveAt: number): Promise<boolean> {
  const timeoutMinutes = await getLockTimeout();
  if (timeoutMinutes <= 0) return false; // "Never" option
  const elapsed = Date.now() - lastActiveAt;
  return elapsed >= timeoutMinutes * 60 * 1000;
}
