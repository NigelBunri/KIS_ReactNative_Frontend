// src/screens/calls/components/NetworkQualityBanner.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { NetworkQuality } from '@/services/calls/callTypes';

type Props = { quality: NetworkQuality };

export default function NetworkQualityBanner({ quality }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const show = quality === 1 || quality === 2;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: show ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [show]);

  if (!show) return null;

  const msg = quality === 1 ? '⚠️ Very poor connection' : '📶 Weak signal';
  const bg = quality === 1 ? 'rgba(220,38,38,0.9)' : 'rgba(245,158,11,0.9)';

  return (
    <Animated.View style={[styles.banner, { backgroundColor: bg, opacity }]}>
      <Text style={styles.text}>{msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    alignItems: 'center',
    zIndex: 100,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
