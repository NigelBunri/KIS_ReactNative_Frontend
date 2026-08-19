import React from 'react';
import { Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

export default function FaqsSection({ data, palette, typography, spacing }: SectionRenderProps) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.h3, color: palette.text }}>{data?.title || 'FAQs'}</Text>
      {items.map((item: any, i: number) => (
        <View key={item.id || i} style={{ marginTop: spacing.sm, borderRadius: spacing.sm, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md }}>
          <Text style={{ ...typography.label, color: palette.text }}>{item.question}</Text>
          <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>{item.answer}</Text>
        </View>
      ))}
    </View>
  );
}
