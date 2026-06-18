import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setActiveFontScale } from '@/languages/runtimePatch';
import { KIS_TOKENS } from './constants';

export type KISAgeMode = 'child' | 'youth' | 'adult' | 'older_adult';

const STORAGE_KEY = 'kis_age_mode';
const VALID_MODES: KISAgeMode[] = ['child', 'youth', 'adult', 'older_adult'];

const toAgeModeKey = (mode: KISAgeMode) =>
  (mode === 'older_adult' ? 'olderAdult' : mode) as keyof typeof KIS_TOKENS.accessibility.ageModes;

const getFontScale = (mode: KISAgeMode): number =>
  KIS_TOKENS.accessibility.ageModes[toAgeModeKey(mode)]?.fontScale ?? 1;

type AgeModeContextValue = {
  ageMode: KISAgeMode;
  ageVersion: number;
  setAgeMode: (mode: KISAgeMode) => void;
};

export const AgeModeContext = createContext<AgeModeContextValue>({
  ageMode: 'adult',
  ageVersion: 0,
  setAgeMode: () => {},
});

export function AgeModeProvider({ children }: { children: React.ReactNode }) {
  const [ageMode, setAgeModeState] = useState<KISAgeMode>('adult');
  const [ageVersion, setAgeVersion] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && VALID_MODES.includes(stored as KISAgeMode)) {
          const mode = stored as KISAgeMode;
          setAgeModeState(mode);
          setActiveFontScale(getFontScale(mode));
        }
      })
      .catch(() => {});
  }, []);

  const setAgeMode = useCallback((mode: KISAgeMode) => {
    setAgeModeState((currentMode) => {
      if (currentMode === mode) return currentMode;
      setAgeVersion((version) => version + 1);
      return mode;
    });
    setActiveFontScale(getFontScale(mode));
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  }, []);

  return (
    <AgeModeContext.Provider value={{ ageMode, ageVersion, setAgeMode }}>
      {children}
    </AgeModeContext.Provider>
  );
}

export const useAgeMode = () => useContext(AgeModeContext);
export const useAgeModeVersion = () => useContext(AgeModeContext).ageVersion;
