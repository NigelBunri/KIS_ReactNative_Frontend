// src/components/common/NetworkStatusPill.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';

const BACK_ONLINE_VISIBLE_MS = 2200;

type Status = 'offline' | 'backOnline' | 'hidden';

/**
 * Compact connectivity status button rendered inside the shared Golden
 * Section (see App.tsx's GoldenSection host) so it appears consistently
 * across every gold-header main page instead of as a separate full-width
 * banner. Red while offline, green briefly on reconnect, then hides itself.
 */
export default function NetworkStatusPill() {
  const insets = useSafeAreaInsets();
  const { palette } = useKISTheme();
  const [status, setStatus] = useState<Status>('hidden');
  const hasHadOfflineRef = useRef(false);
  const backOnlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      if (!connected) {
        hasHadOfflineRef.current = true;
        if (backOnlineTimer.current) {
          clearTimeout(backOnlineTimer.current);
          backOnlineTimer.current = null;
        }
        setStatus('offline');
      } else if (hasHadOfflineRef.current) {
        hasHadOfflineRef.current = false;
        setStatus('backOnline');
        backOnlineTimer.current = setTimeout(() => setStatus('hidden'), BACK_ONLINE_VISIBLE_MS);
      }
    });

    return () => {
      unsubscribe();
      if (backOnlineTimer.current) clearTimeout(backOnlineTimer.current);
    };
  }, []);

  const visible = status !== 'hidden';
  const isOffline = status === 'offline';

  const appear = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(appear, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 65,
    }).start();
  }, [visible, appear]);

  useEffect(() => {
    if (!isOffline) {
      pulse.stopAnimation(() => pulse.setValue(1));
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isOffline, pulse]);

  const tint = isOffline ? palette.danger : palette.success;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: insets.top + 6,
          opacity: appear,
          transform: [{ scale: appear }],
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={isOffline ? 'No internet connection' : 'Back online'}
    >
      <View style={[styles.pill, { borderColor: tint }]}>
        <Animated.View style={[styles.dot, { backgroundColor: tint, opacity: isOffline ? pulse : 1 }]} />
        <Ionicons name={isOffline ? 'cloud-offline-outline' : 'wifi'} size={12} color={tint} />
        <Text style={[styles.label, { color: tint }]}>
          {isOffline ? 'Offline' : 'Back online'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(23,17,31,0.62)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
