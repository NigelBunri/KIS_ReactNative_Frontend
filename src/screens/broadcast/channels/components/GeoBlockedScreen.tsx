// src/screens/broadcast/channels/components/GeoBlockedScreen.tsx
//
// Full-screen overlay shown when a content item is geo-restricted in the
// viewer's country.

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  onBack: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GeoBlockedScreen({ onBack }: Props) {
  const { palette } = useKISTheme();
  const { bodyFontSize, minTouchTarget } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: palette.royalInk, paddingTop: 32 + insets.top, paddingBottom: 32 + insets.bottom }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>🌍</Text>

        <Text style={[styles.title, { color: palette.ivory, fontSize: bodyFontSize + 6 }]}>
          Not Available in Your Region
        </Text>

        <Text style={[styles.subtitle, { color: palette.subtext, fontSize: bodyFontSize }]}>
          This content isn't available in your country.
        </Text>

        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { borderColor: palette.border, minHeight: Math.max(50, minTouchTarget) }]}
        >
          <Text style={[styles.backText, { color: palette.ivory, fontSize: bodyFontSize }]}>Go Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  icon: {
    fontSize: 60,
    marginBottom: 20,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontWeight: '700',
  },
});
