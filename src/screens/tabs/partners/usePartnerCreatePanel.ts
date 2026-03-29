import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { PartnerCreateKind } from '@/components/partners/PartnerCreatePanel';

export const usePartnerCreatePanel = (width: number) => {
  const [kind, setKind] = useState<PartnerCreateKind>(null);
  const panelWidth = useMemo(() => width, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!kind) {
      panelTranslateX.setValue(panelWidth);
    }
  }, [panelWidth, kind, panelTranslateX]);

  const open = (next: PartnerCreateKind) => {
    if (!next) return;
    setKind(next);
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
      setKind(null);
    });
  };

  return {
    panelWidth,
    panelTranslateX,
    kind,
    isOpen: Boolean(kind),
    open,
    close,
  };
};
