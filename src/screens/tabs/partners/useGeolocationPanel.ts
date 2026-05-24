import { useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

export const useGeolocationPanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelWidth = useMemo(() => {
    if (width < 600) return width;
    return Math.min(820, Math.max(560, Math.round(width * 0.76)));
  }, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  const open = () => {
    setIsOpen(true);
    requestAnimationFrame(() => {
      panelTranslateX.setValue(panelWidth);
      Animated.timing(panelTranslateX, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    });
  };

  const close = () => {
    Animated.timing(panelTranslateX, {
      toValue: panelWidth,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  };

  return { panelWidth, panelTranslateX, isOpen, open, close };
};
