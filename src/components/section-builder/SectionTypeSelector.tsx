import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { SectionType } from './types';
import { SECTION_TYPE_META } from './sectionTypeMeta';

type Props = {
  value: SectionType | null;
  onChange: (value: SectionType) => void;
  palette: any;
  typography: any;
  spacing: any;
};

const PreviewThumbnail = ({ type, palette, spacing }: { type: SectionType; palette: any; spacing: any }) => {
  const baseStyle = {
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: palette.divider,
    backgroundColor: palette.surface,
    overflow: 'hidden' as const,
  };

  if (type === 'hero_banner') {
    return (
      <View style={[baseStyle, { height: 74, padding: spacing.xs, justifyContent: 'space-between' }]}>
        <View style={{ height: 28, borderRadius: spacing.xs, backgroundColor: palette.accentPrimary + '66' }} />
        <View style={{ width: '65%', height: 7, borderRadius: 8, backgroundColor: palette.text + '66' }} />
      </View>
    );
  }

  if (type === 'about') {
    return (
      <View style={[baseStyle, { height: 74, flexDirection: 'row' }]}>
        <View style={{ flex: 1, backgroundColor: palette.accentPrimary + '44' }} />
        <View style={{ flex: 1.4, padding: spacing.xs, justifyContent: 'space-evenly' }}>
          <View style={{ height: 7, borderRadius: 8, backgroundColor: palette.text + '66' }} />
          <View style={{ height: 7, borderRadius: 8, backgroundColor: palette.text + '33' }} />
          <View style={{ width: '60%', height: 7, borderRadius: 8, backgroundColor: palette.text + '33' }} />
        </View>
      </View>
    );
  }

  if (type === 'image_gallery_grid') {
    return (
      <View style={[baseStyle, { height: 74, padding: spacing.xs, gap: spacing.xs }]}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <View style={{ flex: 1, height: 26, borderRadius: spacing.xs, backgroundColor: palette.accentPrimary + '33' }} />
          <View style={{ flex: 1, height: 26, borderRadius: spacing.xs, backgroundColor: palette.accentPrimary + '55' }} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <View style={{ flex: 1, height: 26, borderRadius: spacing.xs, backgroundColor: palette.accentPrimary + '55' }} />
          <View style={{ flex: 1, height: 26, borderRadius: spacing.xs, backgroundColor: palette.accentPrimary + '33' }} />
        </View>
      </View>
    );
  }

  if (type === 'statistics') {
    return (
      <View style={[baseStyle, { height: 74, padding: spacing.xs, flexDirection: 'row', gap: spacing.xs }]}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={{ flex: 1, borderRadius: spacing.xs, backgroundColor: palette.accentPrimary + '33', padding: 4, justifyContent: 'space-between' }}>
            <View style={{ height: 5, borderRadius: 8, backgroundColor: palette.text + '55' }} />
            <View style={{ height: 10, borderRadius: 8, backgroundColor: palette.text + '99' }} />
          </View>
        ))}
      </View>
    );
  }

  if (type === 'testimonials') {
    return (
      <View style={[baseStyle, { height: 74, padding: spacing.xs, gap: spacing.xs }]}>
        {[0, 1].map((item) => (
          <View key={item} style={{ flex: 1, borderRadius: spacing.xs, backgroundColor: palette.accentPrimary + '22', padding: spacing.xs }}>
            <View style={{ height: 5, borderRadius: 8, backgroundColor: palette.text + '55', marginBottom: 3 }} />
            <View style={{ width: '70%', height: 5, borderRadius: 8, backgroundColor: palette.text + '33' }} />
          </View>
        ))}
      </View>
    );
  }

  if (type === 'programs_services') {
    return (
      <View style={[baseStyle, { height: 74, padding: spacing.xs, flexDirection: 'row', gap: spacing.xs }]}>
        {[0, 1].map((item) => (
          <View key={item} style={{ flex: 1, borderRadius: spacing.xs, borderWidth: 1, borderColor: palette.divider, padding: spacing.xs }}>
            <View style={{ height: 7, borderRadius: 8, backgroundColor: palette.text + '66', marginBottom: spacing.xs }} />
            <View style={{ height: 6, borderRadius: 8, backgroundColor: palette.text + '33' }} />
          </View>
        ))}
      </View>
    );
  }

  if (type === 'call_to_action') {
    return (
      <View style={[baseStyle, { height: 74, padding: spacing.xs, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ width: '65%', height: 8, borderRadius: 8, backgroundColor: palette.text + '88', marginBottom: spacing.xs }} />
        <View style={{ width: '45%', paddingVertical: 5, borderRadius: 999, backgroundColor: palette.accentPrimary }} />
      </View>
    );
  }

  return (
    <View style={[baseStyle, { height: 74, padding: spacing.xs, justifyContent: 'space-evenly' }]}>
      <View style={{ width: '70%', height: 6, borderRadius: 8, backgroundColor: palette.text + '66' }} />
      <View style={{ width: '60%', height: 6, borderRadius: 8, backgroundColor: palette.text + '55' }} />
      <View style={{ width: '90%', height: 6, borderRadius: 8, backgroundColor: palette.text + '33' }} />
    </View>
  );
};

export default function SectionTypeSelector({ value, onChange, palette, typography, spacing }: Props) {
  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      {SECTION_TYPE_META.map((item) => {
        const selected = value === item.type;
        return (
          <TouchableOpacity
            key={item.type}
            onPress={() => onChange(item.type)}
            style={{
              borderWidth: 1,
              borderColor: selected ? palette.accentPrimary : palette.divider,
              borderRadius: spacing.md,
              backgroundColor: palette.card,
              padding: spacing.sm,
              gap: spacing.sm,
            }}
          >
            <PreviewThumbnail type={item.type} palette={palette} spacing={spacing} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: selected ? palette.accentPrimary : palette.divider,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected ? (
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: palette.accentPrimary }} />
                ) : null}
              </View>
              <Text style={{ ...typography.label, color: palette.text }}>( ) Select This Type</Text>
            </View>
            <Text style={{ ...typography.h3, color: palette.text }}>{item.title}</Text>
            <Text style={{ ...typography.body, color: palette.subtext }}>{item.description}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
