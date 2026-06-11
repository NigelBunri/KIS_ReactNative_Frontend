// src/screens/broadcast/channels/components/TheaterModeOverlay.tsx
//
// Theater and ambient mode toggle controls for the video player controls bar.
// Purely controlled — no network calls.

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  isTheaterMode: boolean;
  onToggle: () => void;
  isAmbientMode: boolean;
  onAmbientToggle: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TheaterModeOverlay({
  isTheaterMode,
  onToggle,
  isAmbientMode,
  onAmbientToggle,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <View style={[styles.container, { backgroundColor: palette.royalInk }]}>
      {/* Theater mode button */}
      <Pressable
        onPress={onToggle}
        style={[
          styles.button,
          isTheaterMode && styles.buttonActive,
          isTheaterMode && { borderColor: palette.primaryStrong },
        ]}
        accessibilityLabel={isTheaterMode ? 'Exit theater mode' : 'Enter theater mode'}
        accessibilityRole="button"
      >
        <KISIcon
          name="expand"
          size={20}
          color={palette.surface}
        />
        {isTheaterMode && (
          <View style={[styles.badge, { backgroundColor: palette.primaryStrong }]}>
            <Text style={styles.badgeText}>Theater</Text>
          </View>
        )}
      </Pressable>

      {/* Ambient mode button */}
      <Pressable
        onPress={onAmbientToggle}
        style={[
          styles.button,
          isAmbientMode && styles.buttonActive,
          isAmbientMode && { borderColor: palette.primaryStrong },
        ]}
        accessibilityLabel={isAmbientMode ? 'Disable ambient mode' : 'Enable ambient mode'}
        accessibilityRole="button"
      >
        <KISIcon
          name="star"
          size={20}
          color={isAmbientMode ? palette.primaryStrong : palette.surface}
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
    borderColor: 'transparent',
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
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
