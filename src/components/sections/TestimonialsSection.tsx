import React from 'react';
import { Text, View } from 'react-native';
import EditableText from './EditableText';
import type { SectionRenderProps } from './types';

export default function TestimonialsSection({ data, palette, typography, spacing, onFieldChange }: SectionRenderProps) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return (
    <View style={{ marginTop: spacing.md }}>
      <EditableText
        value={String(data?.title || 'Testimonials')}
        style={{ ...typography.h3, color: palette.text }}
        onChangeText={onFieldChange ? (v) => onFieldChange('title', v) : undefined}
      />
      <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
        {items.map((item: any) => (
          <View key={item.id || `${item.quote}-${item.author}`} style={{ borderRadius: spacing.sm, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md }}>
            <Text style={{ ...typography.body, color: palette.text }}>&quot;{item.quote}&quot;</Text>
            <Text style={{ ...typography.label, color: palette.subtext, marginTop: spacing.xs }}>{item.author}{item.role ? ` · ${item.role}` : ''}</Text>
          </View>
        ))}
        {items.length === 0 ? <Text style={{ ...typography.body, color: palette.subtext }}>No testimonials added.</Text> : null}
      </View>
    </View>
  );
}
