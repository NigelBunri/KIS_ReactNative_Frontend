import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

import { getCurrentAuthUserId } from '@/storage/userScopedProfileCache';

const BIBLE_PREFERENCES_KEY = 'kis.bible.preferences.v1';

const scopedPreferenceKey = async () => {
  const userId = await getCurrentAuthUserId().catch(() => null);
  return userId ? `${BIBLE_PREFERENCES_KEY}:${userId}` : BIBLE_PREFERENCES_KEY;
};

export const BIBLE_PREFERENCES_UPDATED_EVENT = 'biblePreferences.updated';

export type LocalBiblePreference = {
  id?: string;
  default_translation?: string | number | null;
  default_translation_code?: string | null;
  font_size?: number;
  audio_speed?: string | number;
  enable_audio_sync?: boolean;
  enable_parallel_view?: boolean;
  enable_daily_reminders?: boolean;
  enable_offline_cache?: boolean;
  sync_status?: 'synced' | 'local_pending';
  updated_at?: string;
};

const nowIso = () => new Date().toISOString();

export const readLocalBiblePreference = async (): Promise<LocalBiblePreference | null> => {
  const raw = await AsyncStorage.getItem(await scopedPreferenceKey());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const writeLocalBiblePreference = async (preference: LocalBiblePreference) => {
  const next = { ...preference, updated_at: nowIso() };
  await AsyncStorage.setItem(await scopedPreferenceKey(), JSON.stringify(next));
  DeviceEventEmitter.emit(BIBLE_PREFERENCES_UPDATED_EVENT, next);
  return next;
};

export const mergeAndWriteLocalBiblePreference = async (
  updates: LocalBiblePreference,
  syncStatus: LocalBiblePreference['sync_status'] = 'local_pending',
) => {
  const existing = await readLocalBiblePreference();
  return writeLocalBiblePreference({
    ...(existing || {}),
    ...updates,
    sync_status: syncStatus,
  });
};
