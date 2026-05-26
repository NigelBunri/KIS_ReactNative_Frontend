// src/push/InAppNotificationToast.tsx
// Slide-down banner for foreground push notifications.

import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKISTheme } from '@/theme/useTheme';
import { routeNotification } from './notificationRouter';

export interface InAppNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface InAppNotificationToastHandle {
  show: (payload: InAppNotificationPayload, navigation?: any) => void;
}

const BANNER_HEIGHT = 80;
const AUTO_DISMISS_MS = 4000;
const SWIPE_THRESHOLD = -30;

const InAppNotificationToast = forwardRef<InAppNotificationToastHandle>(
  (_props, ref) => {
    const { palette } = useKISTheme();
    const insets = useSafeAreaInsets();

    const translateY = useRef(new Animated.Value(-BANNER_HEIGHT - 40)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const payloadRef = useRef<InAppNotificationPayload | null>(null);
    const navigationRef = useRef<any>(null);
    const visibleRef = useRef(false);

    const [displayPayload, setDisplayPayload] =
      React.useState<InAppNotificationPayload | null>(null);

    const dismiss = useCallback(() => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
      Animated.timing(translateY, {
        toValue: -BANNER_HEIGHT - 40,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        visibleRef.current = false;
        opacityAnim.setValue(0);
      });
    }, [translateY, opacityAnim]);

    const show = useCallback(
      (payload: InAppNotificationPayload, navigation?: any) => {
        payloadRef.current = payload;
        navigationRef.current = navigation ?? null;
        setDisplayPayload(payload);

        if (dismissTimer.current) {
          clearTimeout(dismissTimer.current);
        }

        // Reset position before animating in.
        translateY.setValue(-BANNER_HEIGHT - 40);
        opacityAnim.setValue(1);
        visibleRef.current = true;

        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }).start();

        dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
      },
      [translateY, opacityAnim, dismiss],
    );

    useImperativeHandle(ref, () => ({ show }), [show]);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => visibleRef.current,
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          visibleRef.current && gestureState.dy < 0,
        onPanResponderMove: (_evt, gestureState) => {
          if (gestureState.dy < 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dy < SWIPE_THRESHOLD) {
            dismiss();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              tension: 80,
              friction: 10,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    ).current;

    const handlePress = useCallback(() => {
      dismiss();
      const nav = navigationRef.current;
      const payload = payloadRef.current;
      if (nav && payload?.data) {
        routeNotification(payload.data, nav);
      }
    }, [dismiss]);

    if (!displayPayload) return null;

    const topOffset = insets.top > 0 ? insets.top : 12;

    return (
      <Animated.View
        style={[
          styles.container,
          { top: topOffset, opacity: opacityAnim, transform: [{ translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={handlePress}
          style={[styles.card, { backgroundColor: palette.royalInk }]}
        >
          <View style={styles.textContainer}>
            {!!displayPayload.title && (
              <Text
                style={[styles.title, { color: palette.ivory }]}
                numberOfLines={1}
              >
                {displayPayload.title}
              </Text>
            )}
            {!!displayPayload.body && (
              <Text
                style={[styles.body, { color: palette.ivory }]}
                numberOfLines={2}
              >
                {displayPayload.body}
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  },
);

InAppNotificationToast.displayName = 'InAppNotificationToast';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    minHeight: BANNER_HEIGHT,
    justifyContent: 'center',
  },
  textContainer: {
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  body: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    opacity: 0.88,
  },
});

export default InAppNotificationToast;

// Singleton ref used by notifications.ts to show toasts without prop drilling.
export const InAppNotificationToastRef =
  React.createRef<InAppNotificationToastHandle>();
