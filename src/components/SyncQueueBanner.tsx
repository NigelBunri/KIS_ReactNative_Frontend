import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeTopInset } from '@/hooks/useSafeTopInset';
import { KISIcon } from '@/constants/kisIcons';
import { useKISTheme } from '@/theme/useTheme';

import {
  OFFLINE_ACTION_QUEUE_UPDATED_EVENT,
  flushOfflineActionQueue,
} from '@/services/offlineActionQueue';

type QueueState = { pending: number; failed: number; total: number };

// Long enough to read, short enough to not linger — the underlying queue
// state isn't lost when this auto-hides, it just stops being shown; the
// next queue-updated event (or a pull-to-refresh style resurfacing) brings
// it back if items are still stuck.
const AUTO_HIDE_MS = 4500;
const EMPTY_QUEUE_CLEAR_DELAY_MS = 2000;

export default function SyncQueueBanner() {
  const { palette } = useKISTheme();
  const topInset = useSafeTopInset();
  const [state, setState] = useState<QueueState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      OFFLINE_ACTION_QUEUE_UPDATED_EVENT,
      (payload: QueueState) => {
        if (clearTimer.current) {
          clearTimeout(clearTimer.current);
          clearTimer.current = null;
        }
        if (payload.total === 0) {
          // Queue emptied — hide after a brief "all done" beat.
          clearHideTimer();
          clearTimer.current = setTimeout(() => setState(null), EMPTY_QUEUE_CLEAR_DELAY_MS);
          setState(payload);
          setDismissed(false);
          return;
        }
        setState(payload);
        setDismissed(false);
      },
    );
    return () => {
      sub.remove();
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearHideTimer();
    };
  }, [clearHideTimer]);

  const isVisible = !!state && state.total > 0 && !dismissed;

  // Auto-hide after AUTO_HIDE_MS — but never while an actual retry request
  // is in flight, and never for the brief "all synced" success beat (that
  // already has its own shorter, fixed-length timer above).
  useEffect(() => {
    clearHideTimer();
    if (!isVisible || retrying || (state && state.total === 0)) return;
    hideTimer.current = setTimeout(() => setDismissed(true), AUTO_HIDE_MS);
    return clearHideTimer;
  }, [isVisible, retrying, state, clearHideTimer]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: isVisible ? 0 : -80,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: isVisible ? 1 : 0,
        duration: isVisible ? 200 : 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isVisible, translateY, opacity]);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    clearHideTimer();
    setRetrying(true);
    try {
      await flushOfflineActionQueue();
    } finally {
      setRetrying(false);
    }
  }, [retrying, clearHideTimer]);

  const handleDismiss = useCallback(() => {
    clearHideTimer();
    setDismissed(true);
  }, [clearHideTimer]);

  if (!state) return null;

  const hasFailed = state.failed > 0;
  const accentColor = hasFailed ? (palette.warningStrong ?? '#B45309') : (palette.primaryStrong ?? '#1D4ED8');
  const title = retrying
    ? 'Retrying…'
    : hasFailed
      ? `${state.failed} item${state.failed > 1 ? 's' : ''} failed to sync`
      : state.total === 0
        ? 'All caught up'
        : `Syncing ${state.pending} item${state.pending > 1 ? 's' : ''}…`;
  const subtitle = hasFailed && !retrying ? 'Tap to retry' : undefined;

  return (
    <Animated.View
      pointerEvents={isVisible ? 'box-none' : 'none'}
      style={[
        styles.wrapper,
        { top: (topInset > 0 ? topInset : 12) + 4 },
        { transform: [{ translateY }], opacity },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      <Pressable
        onPress={hasFailed ? handleRetry : undefined}
        disabled={!hasFailed || retrying}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: palette.surfaceElevated ?? palette.card ?? '#1F2430',
            borderColor: `${accentColor}55`,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: `${accentColor}22` }]}>
          {retrying ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <KISIcon
              name={hasFailed ? 'warning' : state.total === 0 ? 'refresh' : 'refresh'}
              size={16}
              color={accentColor}
            />
          )}
        </View>
        <View style={styles.textColumn}>
          <Text style={[styles.title, { color: palette.text ?? '#F5F6FA' }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: accentColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={handleDismiss} hitSlop={10} style={styles.dismissButton}>
          <KISIcon name="close" size={14} color={palette.subtext ?? '#9AA0AE'} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9998,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  dismissButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
