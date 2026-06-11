import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '@/network/config';

const AUTH_ENVIRONMENT_KEY = 'kis.auth.environment.v1';

const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '');

/**
 * Record which Django origin the app is using without clearing the user's
 * persisted session. Local/remote switching is common during development, and
 * an environment change alone is not an explicit logout.
 */
export const ensureAuthEnvironment = async (): Promise<boolean> => {
  const currentEnvironment = normalizeOrigin(API_BASE_URL);
  const previousEnvironment = await AsyncStorage.getItem(AUTH_ENVIRONMENT_KEY);
  const changed = Boolean(
    previousEnvironment &&
      normalizeOrigin(previousEnvironment) !== currentEnvironment,
  );

  if (changed) {
    console.warn(
      `[auth] Backend changed to ${currentEnvironment}; preserving the existing signed-in session.`,
    );
  }

  await AsyncStorage.setItem(AUTH_ENVIRONMENT_KEY, currentEnvironment);
  return changed;
};
