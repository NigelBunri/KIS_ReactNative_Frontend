import { useMemo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

type PullDownToCloseOptions = {
  enabled?: boolean;
  onClose: () => void;
  closeDistance?: number;
  closeVelocity?: number;
};

export default function usePullDownToClose({
  enabled = true,
  onClose,
  closeDistance = 92,
  closeVelocity = 0.9,
}: PullDownToCloseOptions) {
  const dragY = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (!enabled) return false;
          const isDownward = gesture.dy > 8;
          const isMostlyVertical = gesture.dy > Math.abs(gesture.dx) * 1.25;
          return isDownward && isMostlyVertical;
        },
        onPanResponderMove: (_, gesture) => {
          dragY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > closeDistance || gesture.vy > closeVelocity) {
            onClose();
            setTimeout(() => dragY.setValue(0), 320);
            return;
          }
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 220,
            mass: 0.8,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 220,
            mass: 0.8,
          }).start();
        },
      }),
    [closeDistance, closeVelocity, dragY, enabled, onClose],
  );

  return {
    dragY,
    panHandlers: panResponder.panHandlers,
  };
}
