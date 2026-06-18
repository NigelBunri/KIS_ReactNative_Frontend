// src/screens/broadcast/channels/components/TheaterModeOverlay.tsx
//
// Theater and ambient mode toggle controls for the video player controls bar.
// Persists preferences to AsyncStorage so they survive app restarts.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

const STORAGE_KEY = 'KIS_VIDEO_PREFS';

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  isTheaterMode?: boolean;
  onToggle?: (value: boolean) => void;
  isAmbientMode?: boolean;
  onAmbientToggle?: (value: boolean) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TheaterModeOverlay({
  isTheaterMode: controlledTheater,
  onToggle,
  isAmbientMode: controlledAmbient,
  onAmbientToggle,
}: Props) {
  const { palette } = useKISTheme();
  const [theaterMode, setTheaterMode] = useState(controlledTheater ?? false);
  const [ambientMode, setAmbientMode] = useState(controlledAmbient ?? false);

  // Load persisted prefs on mount (only if not fully controlled)
  useEffect(() => {
    if (controlledTheater !== undefined || controlledAmbient !== undefined) return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
        const prefs = JSON.parse(raw);
        if (typeof prefs.theater === 'boolean') setTheaterMode(prefs.theater);
        if (typeof prefs.ambient === 'boolean') setAmbientMode(prefs.ambient);
      })
      .catch(() => {});
  }, []);

  // Keep local state in sync when controlled from outside
  useEffect(() => { if (controlledTheater !== undefined) setTheaterMode(controlledTheater); }, [controlledTheater]);
  useEffect(() => { if (controlledAmbient !== undefined) setAmbientMode(controlledAmbient); }, [controlledAmbient]);

  const persist = useCallback((theater: boolean, ambient: boolean) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ theater, ambient })).catch(() => {});
  }, []);

  const handleTheaterToggle = useCallback(() => {
    const next = !theaterMode;
    setTheaterMode(next);
    onToggle?.(next);
    persist(next, ambientMode);
  }, [ambientMode, onToggle, persist, theaterMode]);

  const handleAmbientToggle = useCallback(() => {
    const next = !ambientMode;
    setAmbientMode(next);
    onAmbientToggle?.(next);
    persist(theaterMode, next);
  }, [ambientMode, onAmbientToggle, persist, theaterMode]);

  return (
    <View style={[styles.container, { backgroundColor: palette.royalInk }]}>
      {/* Theater mode button */}
      <Pressable
        onPress={handleTheaterToggle}
        style={[
          styles.button,
          { borderColor: theaterMode ? palette.primaryStrong : palette.royalInk },
          theaterMode && styles.buttonActive,
        ]}
        hitSlop={8}
        accessibilityLabel={theaterMode ? 'Exit theater mode' : 'Enter theater mode'}
        accessibilityRole="button"
      >
        <KISIcon
          name="expand"
          size={20}
          color={palette.surface}
        />
        {theaterMode && (
          <View style={[styles.badge, { backgroundColor: palette.primaryStrong }]}>
            <Text style={[styles.badgeText, { color: palette.ivory }]}>Theater</Text>
          </View>
        )}
      </Pressable>

      {/* Ambient mode button */}
      <Pressable
        onPress={handleAmbientToggle}
        style={[
          styles.button,
          { borderColor: ambientMode ? palette.primaryStrong : palette.royalInk },
          ambientMode && styles.buttonActive,
        ]}
        hitSlop={8}
        accessibilityLabel={ambientMode ? 'Disable ambient mode' : 'Enable ambient mode'}
        accessibilityRole="button"
      >
        <KISIcon
          name="star"
          size={20}
          color={ambientMode ? palette.primaryStrong : palette.surface}
        />
      </Pressable>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonActive: {
    borderWidth: 1.5,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
