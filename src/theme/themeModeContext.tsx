import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

  // Memoized for the same reason as AccentThemeProvider (see
  // accentThemeContext.tsx) - GoldenSectionContext.tsx documents a past
  // production crash from an unmemoized context value at this same depth
  // of the provider tree; this applies that fix here too.
  const value = useMemo(() => ({ themeMode, setThemeMode }), [themeMode, setThemeMode]);

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeModeContext);
