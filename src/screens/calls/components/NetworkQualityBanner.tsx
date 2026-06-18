// src/screens/calls/components/NetworkQualityBanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NetworkQuality } from '@/services/calls/callTypes';
import { useKISTheme } from '@/theme/useTheme';

type Props = { quality: NetworkQuality };

export default function NetworkQualityBanner({ quality }: Props) {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const show = quality === 1 || quality === 2;

  // Keep the banner mounted while fading out so the animation can complete.
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

  const msg = quality === 1 ? '⚠️ Very poor connection' : '📶 Weak signal';
  const bg = quality === 1 ? `${palette.danger}E6` : `${palette.gold}E6`;
  // On danger (red) use white text; on gold use royalInk for sufficient contrast.
  const textColor = quality === 1 ? palette.onPrimary : palette.royalInk;

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
