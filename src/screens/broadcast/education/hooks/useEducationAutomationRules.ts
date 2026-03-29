import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'education_automation_rules';
const DEFAULT_RULES = {
  auto_enroll: false,
  auto_reminders: true,
  credit_gating: false,
};

export default function useEducationAutomationRules() {
  const [rules, setRules] = useState<Record<string, boolean>>(DEFAULT_RULES);

  const load = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRules({ ...DEFAULT_RULES, ...parsed });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRule = useCallback(async (key: string, value: boolean) => {
    setRules((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { rules, toggleRule };
}
