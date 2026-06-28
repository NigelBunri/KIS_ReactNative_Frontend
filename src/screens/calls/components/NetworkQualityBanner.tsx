// src/screens/calls/components/NetworkQualityBanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NetworkQuality } from '@/services/calls/callTypes';
import { useKISTheme } from '@/theme/useTheme';

type Props = { quality: NetworkQuality; isAudioOnly?: boolean };

export default function NetworkQualityBanner({ quality, isAudioOnly = false }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const show = quality === 1 || quality === 2 || isAudioOnly;

  const [mounted, setMounted] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
    }
    Animated.timing(opacity, {
      toValue: show ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !show) setMounted(false);
    });
  }, [show]);

  if (!mounted) return null;

  let msg: string;
  let bg: string;
  let textColor: string;

  if (isAudioOnly) {
    msg = '📵 Switched to audio-only (very poor connection)';
    bg = `${palette.danger}E6`;
    textColor = palette.onPrimary ?? '#fff';
  } else if (quality === 1) {
    msg = '⚠️ Very poor connection';
    bg = `${palette.danger}E6`;
    textColor = palette.onPrimary ?? '#fff';
  } else {
    msg = '📶 Weak signal';
    bg = `${palette.gold}E6`;
    textColor = palette.royalInk;
  }

  return (
    <Animated.View style={[styles.banner, { backgroundColor: bg, opacity, paddingTop: insets.top + 8 }]}>
      <Text style={[styles.text, { color: textColor }]}>{msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    alignItems: 'center',
    zIndex: 100,
  },
  text: { fontWeight: '700', fontSize: 13 },
});
