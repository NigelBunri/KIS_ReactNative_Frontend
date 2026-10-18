import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type KISThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'kis_theme_mode';
const VALID_MODES: KISThemeMode[] = ['system', 'light', 'dark'];

// useKISTheme() already resolves `tone` correctly from themeMode for
// everything rendered in JS (palette.bg etc.) - but the actual native
// window/root view behind all of that (iOS's UIWindow.backgroundColor,
// set to the dynamic `.systemBackground` in AppDelegate.swift; Android's
// Theme.AppCompat.DayNight window background) only ever followed the
// DEVICE's own light/dark setting, with no link to this in-app preference
// at all. That native layer is the "very background everything sits on"
// users reported staying on the device's theme after explicitly choosing
// the opposite one in-app - it was never wired up, on either platform.
// Appearance.setColorScheme() is RN's own built-in API for exactly this:
// on iOS it sets `overrideUserInterfaceStyle` on every window (resolving
// every dynamic system color, not just the background), and on Android it
// calls AppCompatDelegate.setDefaultNightMode() (switching the window's
// actual day/night resources) - both with no native code of our own
// needed. 'system' maps to 'unspecified', which resets both platforms to
// following the device setting again.
function applyNativeColorScheme(mode: KISThemeMode) {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

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

  // Single chokepoint for the native-level sync, covering both the restore
  // above (the persisted choice reapplies on every cold start, not just
  // the session it was picked in) and every live change below.
  useEffect(() => {
    applyNativeColorScheme(themeMode);
  }, [themeMode]);

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
