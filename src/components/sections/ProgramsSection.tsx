import React from 'react';
import { Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

export default function ProgramsSection({ data, palette, typography, spacing }: SectionRenderProps) {
  const cards = Array.isArray(data?.cards) ? data.cards : [];
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.h3, color: palette.text }}>{data?.title || 'Programs & Services'}</Text>
      <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
        {cards.map((card: any) => (
          <View key={card.id || card.name} style={{ borderRadius: spacing.sm, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md }}>
            <Text style={{ ...typography.label, color: palette.text }}>{card.name}</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>{card.description}</Text>
          </View>
        ))}
        {cards.length === 0 ? <Text style={{ ...typography.body, color: palette.subtext }}>No services added.</Text> : null}
      </View>
    </View>
  );
}
