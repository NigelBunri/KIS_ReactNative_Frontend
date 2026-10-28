// src/services/bookReadAloudPreferenceStore.ts
//
// Device-local settings for the KIS Books "Listen" (text-to-speech)
// feature — same rationale as bibleReadAloudPreferenceStore.ts: voice and
// speed are device/OS-specific TTS engine settings, not meaningful to
// sync server-side or across devices.
import AsyncStorage from '@react-native-async-storage/async-storage';

const READ_ALOUD_PREFERENCE_KEY = 'kis.books.readAloud.preferences.v1';

export type BookReadAloudPreference = {
  voiceId?: string | null;
  /** Human-facing speed multiplier — 1 = normal. Mapped to the TTS engine's rate scale at speak time. */
  speed?: number;
  /** Minutes to listen for before auto-stopping (sleep timer), or null/undefined for unlimited. */
  sleepTimerMinutes?: number | null;
};

const DEFAULT_PREFERENCE: BookReadAloudPreference = {
  voiceId: null,
  speed: 1,
  sleepTimerMinutes: null,
};

export const readBookReadAloudPreference = async (): Promise<BookReadAloudPreference> => {
  try {
    const raw = await AsyncStorage.getItem(READ_ALOUD_PREFERENCE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCE };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_PREFERENCE, ...parsed } : { ...DEFAULT_PREFERENCE };
  } catch {
    return { ...DEFAULT_PREFERENCE };
  }
};

export const writeBookReadAloudPreference = async (
  updates: BookReadAloudPreference,
): Promise<BookReadAloudPreference> => {
  const existing = await readBookReadAloudPreference();
  const next = { ...existing, ...updates };
  await AsyncStorage.setItem(READ_ALOUD_PREFERENCE_KEY, JSON.stringify(next));
  return next;
};
