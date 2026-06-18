// src/screens/broadcast/channels/components/AgeGateScreen.tsx
//
// Full-screen age-restriction overlay. Shown before age-restricted content plays.

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

type AgeRestriction = '13+' | '18+';

type Props = {
  ageRestriction: AgeRestriction;
  onConfirm: () => void;
  onBack: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgeGateScreen({ ageRestriction, onConfirm, onBack }: Props) {
  const { palette } = useKISTheme();
  const { bodyFontSize, labelFontSize, minTouchTarget } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.overlay, { backgroundColor: palette.royalInk, paddingTop: 32 + insets.top, paddingBottom: 32 + insets.bottom }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>🛡️</Text>

        <Text style={[styles.title, { color: palette.ivory, fontSize: bodyFontSize + 7 }]}>
          Age-Restricted Content
        </Text>

        <Text style={[styles.description, { color: palette.subtext, fontSize: bodyFontSize }]}>
          This content is intended for viewers aged {ageRestriction}.{'\n'}
          Confirm your age to continue.
        </Text>

        {/* Primary confirm button */}
        <Pressable
          onPress={onConfirm}
          style={[styles.confirmBtn, { backgroundColor: palette.gold, minHeight: Math.max(50, minTouchTarget) }]}
        >
          <Text style={[styles.confirmText, { color: palette.onPrimary, fontSize: bodyFontSize + 1 }]}>
            I am {ageRestriction} years old
          </Text>
        </Pressable>

        {/* Go back */}
        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { minHeight: minTouchTarget, justifyContent: 'center' }]}
        >
          <Text style={[styles.backText, { color: palette.subtext, fontSize: labelFontSize }]}>
            Go Back
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  icon: {
    fontSize: 56,
    marginBottom: 20,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  confirmBtn: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmText: {
    fontWeight: '800',
  },
  backBtn: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  backText: {
    fontWeight: '600',
  },
});
