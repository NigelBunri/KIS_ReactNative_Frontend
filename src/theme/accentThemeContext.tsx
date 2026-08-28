// src/theme/accentThemeContext.tsx
//
// Which of the 8 brand accent colors (Gold + 7 others, see appColorThemes.ts)
// the app renders with. Mirrors themeModeContext.tsx's shape/persistence
// pattern exactly, but is a separate context/storage key since accent color
// and light/dark/system mode are independent choices — a user picks a color,
// then still separately chooses whether it renders light, dark, or follows
// the system, via the existing ThemeModeContext.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_COLOR_THEMES, DEFAULT_THEME_ID } from '@/constants/appColorThemes';

const STORAGE_KEY = 'kis_accent_id';
const VALID_IDS = APP_COLOR_THEMES.map((t) => t.id);

type AccentThemeContextValue = {
  accentId: string;
  setAccentId: (id: string) => void;
};

export const AccentThemeContext = createContext<AccentThemeContextValue>({
  accentId: DEFAULT_THEME_ID,
  setAccentId: () => {},
});

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  const [accentId, setAccentIdState] = useState<string>(DEFAULT_THEME_ID);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && VALID_IDS.includes(stored)) {
          setAccentIdState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setAccentId = useCallback((id: string) => {
    if (!VALID_IDS.includes(id)) return;
    setAccentIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  return (
    <AccentThemeContext.Provider value={{ accentId, setAccentId }}>
      {children}
    </AccentThemeContext.Provider>
  );
}

export const useAccentTheme = () => useContext(AccentThemeContext);
