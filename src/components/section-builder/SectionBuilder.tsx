import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { DynamicLandingSection, SectionType } from './types';
import { createSection } from './types';

export type SectionBuilderProps = {
  value?: DynamicLandingSection[];
  onChange?: (sections: DynamicLandingSection[]) => void;
  renderSection?: (section: DynamicLandingSection, index: number) => React.ReactNode;
};

export default function SectionBuilder({ value, onChange, renderSection }: SectionBuilderProps) {
  const [internalSections, setInternalSections] = useState<DynamicLandingSection[]>(value ?? []);

  const sections = useMemo(() => (value ? value : internalSections), [value, internalSections]);

  const commit = (next: DynamicLandingSection[]) => {
    if (!value) setInternalSections(next);
    onChange?.(next);
  };

  const addSection = (type: SectionType) => {
    const next = [...sections, createSection(type)];
    commit(next);
  };

  const updateSection = (id: string, updater: (current: DynamicLandingSection) => DynamicLandingSection) => {
    const next = sections.map((section) => (section.id === id ? updater(section) : section));
    commit(next);
  };

  const removeSection = (id: string) => {
    const next = sections.filter((section) => section.id !== id);
    commit(next);
  };

  void addSection;
  void updateSection;
  void removeSection;

  return <View>{sections.map((section, index) => renderSection?.(section, index) ?? null)}</View>;
}
