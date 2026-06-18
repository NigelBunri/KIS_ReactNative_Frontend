// src/components/OfflineBanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useKISTheme } from '@/theme/useTheme';

const BACK_ONLINE_VISIBLE_MS = 2000;

export default function OfflineBanner() {
  const { palette } = useKISTheme();
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const translateY = useRef(new Animated.Value(-60)).current;
  const backOnlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHadOfflineRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      if (!connected) {
        hasHadOfflineRef.current = true;
        setIsOffline(true);
        setShowBackOnline(false);
        if (backOnlineTimer.current) {
          clearTimeout(backOnlineTimer.current);
          backOnlineTimer.current = null;
        }
      } else if (hasHadOfflineRef.current) {
        // Was offline before — now back online
        setIsOffline(false);
        setShowBackOnline(true);
        backOnlineTimer.current = setTimeout(() => {
          setShowBackOnline(false);
        }, BACK_ONLINE_VISIBLE_MS);
      }
    });

    return () => {
      unsubscribe();
      if (backOnlineTimer.current) clearTimeout(backOnlineTimer.current);
    };
  }, []);

  const isVisible = isOffline || showBackOnline;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isVisible ? 0 : -60,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [isVisible, translateY]);

  if (!isVisible) return null;

  const backgroundColor = showBackOnline ? palette.success : palette.danger;
  const message = showBackOnline ? 'Back online' : 'No internet connection';

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top > 0 ? insets.top : 8, backgroundColor },
        { transform: [{ translateY }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <View style={styles.inner}>
        <Text style={[styles.text, { color: palette.ivory }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingBottom: 8,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
