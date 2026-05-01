import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

export const usePartnerSheet = (height: number) => {
  const [isPartnerSheetOpen, setIsPartnerSheetOpen] = useState(false);
  const sheetHeight = useMemo(() => Math.max(420, height - 176), [height]);
  const sheetOffsetAnim = useRef(new Animated.Value(sheetHeight)).current;
  const sheetOffsetRef = useRef(sheetHeight);
  const dragStartOffsetRef = useRef(sheetHeight);
  const isOpenRef = useRef(false);

  useEffect(() => {
    const id = sheetOffsetAnim.addListener(({ value }) => {
      sheetOffsetRef.current = value;
    });
    return () => {
      sheetOffsetAnim.removeListener(id);
    };
  }, [sheetOffsetAnim]);

  useEffect(() => {
    const target = isPartnerSheetOpen ? 0 : sheetHeight;
    sheetOffsetAnim.setValue(target);
    sheetOffsetRef.current = target;
    isOpenRef.current = isPartnerSheetOpen;
  }, [sheetHeight, isPartnerSheetOpen, sheetOffsetAnim]);

  const overlayOpacity = sheetOffsetAnim.interpolate({
    inputRange: [0, sheetHeight],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const animatePartnerSheet = (open: boolean, velocity = 0) => {
    isOpenRef.current = open;
    setIsPartnerSheetOpen(open);
    Animated.spring(sheetOffsetAnim, {
      toValue: open ? 0 : sheetHeight,
      velocity: Math.abs(velocity),
      tension: 72,
      friction: 13,
      useNativeDriver: true,
    }).start(() => {
      sheetOffsetAnim.setValue(open ? 0 : sheetHeight);
      sheetOffsetRef.current = open ? 0 : sheetHeight;
      isOpenRef.current = open;
      setIsPartnerSheetOpen(open);
    });
  };

  const sheetPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      isOpenRef.current &&
      gestureState.dy > 8 &&
      Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
    onPanResponderGrant: () => {
      sheetOffsetAnim.stopAnimation((value: number) => {
        dragStartOffsetRef.current =
          typeof value === 'number'
            ? Math.max(0, Math.min(sheetHeight, value))
            : sheetOffsetRef.current;
        sheetOffsetRef.current = dragStartOffsetRef.current;
      });
    },
    onPanResponderMove: (_, gestureState) => {
      const nextOffset = Math.max(
        0,
        Math.min(sheetHeight, dragStartOffsetRef.current + gestureState.dy),
      );
      sheetOffsetAnim.setValue(nextOffset);
      sheetOffsetRef.current = nextOffset;
    },
    onPanResponderRelease: (_, gestureState) => {
      const shouldClose = gestureState.dy > 90 || gestureState.vy > 0.65;
      animatePartnerSheet(!shouldClose, gestureState.vy);
    },
    onPanResponderTerminate: () => {
      animatePartnerSheet(isOpenRef.current, 0);
    },
  });

  return {
    isPartnerSheetOpen,
    sheetHeight,
    sheetOffsetAnim,
    overlayOpacity,
    sheetPanHandlers: sheetPanResponder.panHandlers,
    animatePartnerSheet,
  };
};
