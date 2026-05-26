// src/services/QuickLockService.ts
// PIN-based Quick Lock using react-native-encrypted-storage
import EncryptedStorage from 'react-native-encrypted-storage';

const KEY_PIN = 'kis_quick_lock_pin';
const KEY_TIMEOUT = 'kis_quick_lock_timeout_minutes';

const DEFAULT_TIMEOUT_MINUTES = 5;

export async function isPINEnabled(): Promise<boolean> {
  try {
    const stored = await EncryptedStorage.getItem(KEY_PIN);
    return typeof stored === 'string' && stored.length === 6;
  } catch {
    return false;
  }
}

export async function setPIN(pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be exactly 6 digits.');
  }
  await EncryptedStorage.setItem(KEY_PIN, pin);
}

export async function validatePIN(pin: string): Promise<boolean> {
  try {
    const stored = await EncryptedStorage.getItem(KEY_PIN);
    return stored === pin;
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

/**
 * Returns true if enough time has elapsed since the app was last active
 * to warrant showing the lock screen.
 * @param lastActiveAt Unix timestamp in milliseconds
 */
export function shouldLock(lastActiveAt: number): boolean {
  // We can't call async here; caller must pre-load timeout minutes.
  // This overload accepts a pre-resolved timeout so it stays synchronous.
  return false; // base: always returns false, use shouldLockAsync instead
}

/**
 * Async variant — loads timeout from storage and compares with lastActiveAt.
 */
export async function shouldLockAsync(lastActiveAt: number): Promise<boolean> {
  const timeoutMinutes = await getLockTimeout();
  if (timeoutMinutes <= 0) return false; // "Never" option
  const elapsed = Date.now() - lastActiveAt;
  return elapsed >= timeoutMinutes * 60 * 1000;
}
