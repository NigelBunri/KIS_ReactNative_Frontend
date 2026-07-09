import React, { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';

import {
  OFFLINE_ACTION_QUEUE_UPDATED_EVENT,
  flushOfflineActionQueue,
} from '@/services/offlineActionQueue';

type QueueState = { pending: number; failed: number; total: number };

const CLEAR_DELAY_MS = 3000;

export default function SyncQueueBanner() {
  const topInset = useSafeTopInset();
  const [state, setState] = useState<QueueState | null>(null);
  const translateY = useRef(new Animated.Value(-60)).current;
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      OFFLINE_ACTION_QUEUE_UPDATED_EVENT,
      (payload: QueueState) => {
        if (clearTimer.current) {
          clearTimeout(clearTimer.current);
          clearTimer.current = null;
        }
        if (payload.total === 0) {
          // Queue emptied — hide after a brief delay
          clearTimer.current = setTimeout(() => setState(null), CLEAR_DELAY_MS);
        } else {
          setState(payload);
        }
      },
    );
    return () => {
      sub.remove();
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const isVisible = !!state && state.total > 0;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isVisible ? 0 : -60,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [isVisible, translateY]);

  if (!state) return null;

  const hasFailed = state.failed > 0;
  const backgroundColor = hasFailed ? '#B45309' : '#1D4ED8';
  const message = hasFailed
    ? `${state.failed} item${state.failed > 1 ? 's' : ''} failed to sync — tap to retry`
    : `Syncing ${state.pending} item${state.pending > 1 ? 's' : ''}…`;

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: topInset > 0 ? topInset : 8, backgroundColor },
        { transform: [{ translateY }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <Pressable
        onPress={hasFailed ? () => void flushOfflineActionQueue() : undefined}
        style={styles.inner}
      >
        <Text style={styles.text}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    paddingBottom: 8,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
