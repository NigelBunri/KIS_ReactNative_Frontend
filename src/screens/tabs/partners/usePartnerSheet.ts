import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

export const usePartnerSheet = (height: number) => {
  const [isPartnerSheetOpen, setIsPartnerSheetOpen] = useState(false);
  const sheetHeight = useMemo(() => Math.min(height * 0.7, 520), [height]);
  const sheetOffsetAnim = useRef(new Animated.Value(sheetHeight)).current;
  const sheetOffsetRef = useRef(sheetHeight);

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
  }, [sheetHeight, isPartnerSheetOpen, sheetOffsetAnim]);

  const overlayOpacity = sheetOffsetAnim.interpolate({
    inputRange: [0, sheetHeight],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const animatePartnerSheet = (open: boolean) => {
    setIsPartnerSheetOpen(open);
    Animated.timing(sheetOffsetAnim, {
      toValue: open ? 0 : sheetHeight,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  return {
    isPartnerSheetOpen,
    sheetHeight,
    sheetOffsetAnim,
    overlayOpacity,
    sheetPanHandlers: {},
    animatePartnerSheet,
  };
};
