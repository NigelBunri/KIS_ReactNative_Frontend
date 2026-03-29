import AsyncStorage from '@react-native-async-storage/async-storage';

const ESSENTIAL_KEYS = new Set([
  'access_token',
  'refresh_token',
  'user_phone',
  'device_id',
  'push_token',
  'fcm_token',
  'apns_token',
  'KIS_SPLASH_SHOWN',
  'education_v2_disabled',
  'kis.contacts.cache.v1',
  'kis.contacts.cache.meta.v1',
  'kis.broadcast.ui.prefs.v1',
]);

const ALLOWED_PREFIXES = ['KIS_CHAT_PREFERENCES', 'KIS_CHAT_MESSAGES_BY_ROOM_V2'];

const isAllowedKey = (key: string) => {
  if (ESSENTIAL_KEYS.has(key)) {
    return true;
  }
  return ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));
};

export const cleanIrrelevantStorage = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    if (!keys.length) return;
    const toRemove = keys.filter((key) => !isAllowedKey(key));
    if (!toRemove.length) return;
    await AsyncStorage.multiRemove(toRemove);
  } catch {
    // Best effort cleanup; ignore failures so boot continues.
  }
};
