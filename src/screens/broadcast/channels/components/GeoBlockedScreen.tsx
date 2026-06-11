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
import { useKISTheme } from '@/theme/useTheme';

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  onBack: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GeoBlockedScreen({ onBack }: Props) {
  const { palette } = useKISTheme();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🌍</Text>

        <Text style={[styles.title, { color: '#fff' }]}>
          Not Available in Your Region
        </Text>

        <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.65)' }]}>
          This content isn't available in your country.
        </Text>

        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { borderColor: palette.border }]}
        >
          <Text style={[styles.backText, { color: '#fff' }]}>Go Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
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
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 13,
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
