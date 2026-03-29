import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { PartnerSettingsSection } from '@/components/partners/settings/partnerSettingsData';

export const usePartnerSettingsPanel = (
  width: number,
  sections: PartnerSettingsSection[],
) => {
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<PartnerSettingsSection | null>(null);
  const panelWidth = useMemo(() => width, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!activeSectionKey) {
      panelTranslateX.setValue(panelWidth);
    }
  }, [panelWidth, activeSectionKey, panelTranslateX]);

  const openSection = (sectionKey: string) => {
    setActiveSectionKey(sectionKey);
    const section = sections.find((s) => s.key === sectionKey) ?? null;
    if (section) {
      setActiveSection(section);
    }
    requestAnimationFrame(() => {
      panelTranslateX.setValue(panelWidth);
      Animated.timing(panelTranslateX, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    });
  };

  const closePanel = () => {
    Animated.timing(panelTranslateX, {
      toValue: panelWidth,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setActiveSectionKey(null);
      setActiveSection(null);
    });
  };

  useEffect(() => {
    if (!activeSectionKey) {
      setActiveSection(null);
      return;
    }
    const section = sections.find((s) => s.key === activeSectionKey) ?? null;
    if (section) {
      setActiveSection(section);
    }
  }, [activeSectionKey, sections]);

  return {
    panelWidth,
    panelTranslateX,
    activeSectionKey,
    activeSection,
    openSection,
    closePanel,
    isOpen: Boolean(activeSectionKey),
  };
};
