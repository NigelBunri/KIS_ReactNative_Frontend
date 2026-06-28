import { useCallback } from 'react';
import { StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { KISTone } from './constants';

/**
 * Push the right StatusBar barStyle while this screen is focused, pop it on blur.
 * Uses the navigation-aware push/pop API so multiple screens don't fight each other.
 *
 * @param override  Force a specific style ('light-content' | 'dark-content').
 *                  When omitted, derives automatically from the current tone.
 */
export function useStatusBarStyle(tone: KISTone, override?: 'light-content' | 'dark-content') {
  const barStyle = override ?? (tone === 'dark' ? 'light-content' : 'dark-content');

  useFocusEffect(
    useCallback(() => {
      const entry = StatusBar.pushStackEntry({ barStyle, animated: true });
      return () => StatusBar.popStackEntry(entry);
    }, [barStyle]),
  );
}
