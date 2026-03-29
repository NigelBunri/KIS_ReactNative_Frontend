import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'education_v2_disabled';

const readAvailability = async (): Promise<boolean> => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored !== '1';
};

const writeAvailability = async (enabled: boolean) => {
  if (enabled) {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
  }
};

export default function useEducationAvailability() {
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const value = await readAvailability();
      setAvailable(value);
    } catch (err) {
      console.log('[education] availability check failed', err);
      setAvailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  const markUnavailable = useCallback(async () => {
    await writeAvailability(false);
    setAvailable(false);
  }, []);

  const markAvailable = useCallback(async () => {
    await writeAvailability(true);
    setAvailable(true);
  }, []);

  return {
    available,
    loading,
    refresh,
    markUnavailable,
    markAvailable,
  };
}
