import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

export type PartnerFeatureMeta = {
  key: string;
  title: string;
  description?: string;
};

export const usePartnerFeaturePanel = (width: number) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<PartnerFeatureMeta | null>(null);
  const panelWidth = useMemo(() => width, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!isOpen) {
      panelTranslateX.setValue(panelWidth);
    }
  }, [panelWidth, isOpen, panelTranslateX]);

  const open = (nextFeature: PartnerFeatureMeta) => {
    setFeature(nextFeature);
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
    }).start(() => {
      setIsOpen(false);
      setFeature(null);
    });
  };

  return {
    panelWidth,
    panelTranslateX,
    isOpen,
    feature,
    open,
    close,
  };
};
