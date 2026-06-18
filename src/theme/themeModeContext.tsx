import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type KISThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'kis_theme_mode';
const VALID_MODES: KISThemeMode[] = ['system', 'light', 'dark'];

type ThemeModeContextValue = {
  themeMode: KISThemeMode;
  setThemeMode: (mode: KISThemeMode) => void;
};

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  themeMode: 'system',
  setThemeMode: () => {},
});

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<KISThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && VALID_MODES.includes(stored as KISThemeMode)) {
          setThemeModeState(stored as KISThemeMode);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeMode = useCallback((mode: KISThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  }, []);

  return (
    <ThemeModeContext.Provider value={{ themeMode, setThemeMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeModeContext);
