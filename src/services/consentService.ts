import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys must match ComplianceSettingsScreen.tsx
const KEY_ANALYTICS = 'kis_compliance_analytics_enabled';
const KEY_PERSONALIZATION = 'kis_compliance_personalization_enabled';
const KEY_OFFLINE = 'kis_compliance_offline_data_enabled';

// In-memory cache so callers don't hit AsyncStorage on every event
let analyticsEnabled = true;
let personalizationEnabled = true;
let offlineDataEnabled = true;
let loaded = false;

export async function loadConsentPreferences(): Promise<void> {
  try {
    const [a, p, o] = await AsyncStorage.multiGet([KEY_ANALYTICS, KEY_PERSONALIZATION, KEY_OFFLINE]);
    analyticsEnabled = a[1] !== 'false';
    personalizationEnabled = p[1] !== 'false';
    offlineDataEnabled = o[1] !== 'false';
    loaded = true;
  } catch {
    // defaults to permissive if storage fails
  }
}

export function isAnalyticsEnabled(): boolean {
  return analyticsEnabled;
}

export function isPersonalizationEnabled(): boolean {
  return personalizationEnabled;
}

export function isOfflineDataEnabled(): boolean {
  return offlineDataEnabled;
}

export function updateConsentCache(update: { analytics?: boolean; personalization?: boolean; offlineData?: boolean }): void {
  if (update.analytics !== undefined) analyticsEnabled = update.analytics;
  if (update.personalization !== undefined) personalizationEnabled = update.personalization;
  if (update.offlineData !== undefined) offlineDataEnabled = update.offlineData;
  loaded = true;
}
