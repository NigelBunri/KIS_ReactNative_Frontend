import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type KISAgeMode = 'child' | 'youth' | 'adult' | 'older_adult';

const STORAGE_KEY = 'kis_age_mode';
const VALID_MODES: KISAgeMode[] = ['child', 'youth', 'adult', 'older_adult'];

type AgeModeContextValue = {
  ageMode: KISAgeMode;
  setAgeMode: (mode: KISAgeMode) => void;
};

export const AgeModeContext = createContext<AgeModeContextValue>({
  ageMode: 'adult',
  setAgeMode: () => {},
});

export function AgeModeProvider({ children }: { children: React.ReactNode }) {
  const [ageMode, setAgeModeState] = useState<KISAgeMode>('adult');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && VALID_MODES.includes(stored as KISAgeMode)) {
          setAgeModeState(stored as KISAgeMode);
        }
      })
      .catch(() => {});
  }, []);

  const setAgeMode = useCallback((mode: KISAgeMode) => {
    setAgeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  }, []);

  return (
    <AgeModeContext.Provider value={{ ageMode, setAgeMode }}>
      {children}
    </AgeModeContext.Provider>
  );
}

export const useAgeMode = () => useContext(AgeModeContext);
