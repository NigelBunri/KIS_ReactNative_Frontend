// src/services/bibleReadAloudPreferenceStore.ts
//
// Device-local settings for the Bible "Read aloud" (text-to-speech) feature —
// voice, speaking speed, and the max-duration auto-stop. Purely a device
// preference (like reader font size used to be before it moved server-side),
// no backend sync: TTS voice ids are device/OS specific and wouldn't
// transfer meaningfully to another device anyway.
import AsyncStorage from '@react-native-async-storage/async-storage';

const READ_ALOUD_PREFERENCE_KEY = 'kis.bible.readAloud.preferences.v1';

export type BibleReadAloudPreference = {
  voiceId?: string | null;
  /** Human-facing speed multiplier — 1 = normal. Mapped to the TTS engine's rate scale at speak time. */
  speed?: number;
  /** Minutes to read for before auto-stopping, or null/undefined for unlimited (reads through to the end of the Bible). */
  maxDurationMinutes?: number | null;
};

const DEFAULT_PREFERENCE: BibleReadAloudPreference = {
  voiceId: null,
  speed: 1,
  maxDurationMinutes: null,
};

export const readBibleReadAloudPreference = async (): Promise<BibleReadAloudPreference> => {
  try {
    const raw = await AsyncStorage.getItem(READ_ALOUD_PREFERENCE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCE };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_PREFERENCE, ...parsed } : { ...DEFAULT_PREFERENCE };
  } catch {
    return { ...DEFAULT_PREFERENCE };
  }
};

export const writeBibleReadAloudPreference = async (
  updates: BibleReadAloudPreference,
): Promise<BibleReadAloudPreference> => {
  const existing = await readBibleReadAloudPreference();
  const next = { ...existing, ...updates };
  await AsyncStorage.setItem(READ_ALOUD_PREFERENCE_KEY, JSON.stringify(next));
  return next;
};
