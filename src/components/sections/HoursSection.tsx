import React from 'react';
import { Text, View } from 'react-native';
import EditableText from './EditableText';
import type { SectionRenderProps } from './types';

export default function HoursSection({ data, palette, typography, spacing, onFieldChange }: SectionRenderProps) {
  const days = Array.isArray(data?.days) ? data.days : [];
  if (!days.length && !onFieldChange) return null;
  return (
    <View style={{ marginTop: spacing.md }}>
      <EditableText
        value={String(data?.title || 'Hours')}
        style={{ ...typography.h3, color: palette.text }}
        onChangeText={onFieldChange ? (v) => onFieldChange('title', v) : undefined}
      />
      {days.length ? (
        <View style={{ marginTop: spacing.sm, borderRadius: spacing.sm, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md, gap: spacing.xs }}>
          {days.map((d: any, i: number) => (
            <View key={d.id || i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...typography.body, color: palette.text }}>{d.day}</Text>
              <Text style={{ ...typography.body, color: palette.subtext }}>{d.hours}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
