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
  // User-chosen preferences — deliberately persisted by their own
  // providers (ThemeModeProvider, AccentThemeProvider, LanguageProvider,
  // AgeModeProvider) via read-on-mount/write-on-change. This allowlist
  // predated those keys, so every cold launch silently wiped the user's
  // theme, accent color, language, and age-mode choice back to default —
  // it looked like persistence was never implemented at all, when it was
  // actually implemented correctly and then erased a moment later.
  'kis_theme_mode',
  'kis_accent_id',
  'kis_language',
  'kis_age_mode',
  'KIS_VIDEO_PREFS',
  // User-owned data, not re-fetchable cache — losing these on every
  // relaunch is a real functional loss (an emptied cart, disappeared
  // playlist), not just a stale-cache trim.
  '@kis:shops-cart',
  '@kis:playlists-v1',
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
