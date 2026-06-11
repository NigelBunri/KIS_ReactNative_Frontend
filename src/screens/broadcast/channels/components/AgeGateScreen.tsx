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
import { useKISTheme } from '@/theme/useTheme';

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

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.icon}>🛡️</Text>

        <Text style={[styles.title, { color: '#fff' }]}>
          Age-Restricted Content
        </Text>

        <Text style={[styles.description, { color: 'rgba(255,255,255,0.75)' }]}>
          This content is intended for viewers aged {ageRestriction}.{'\n'}
          Confirm your age to continue.
        </Text>

        {/* Primary confirm button */}
        <Pressable
          onPress={onConfirm}
          style={[styles.confirmBtn, { backgroundColor: palette.gold }]}
        >
          <Text style={styles.confirmText}>
            I am {ageRestriction} years old
          </Text>
        </Pressable>

        {/* Go back */}
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: 'rgba(255,255,255,0.55)' }]}>
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
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
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
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  confirmBtn: {
    width: '100%',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
