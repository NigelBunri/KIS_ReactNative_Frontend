import React from 'react';
import { Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

// Editor-only static preview — the real rotating strip only animates on
// the published website (components/website-builder/PublicPromoBar.tsx).
export default function PromoBarSection({ data, palette, typography, spacing }: SectionRenderProps) {
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  if (!messages.length) {
    return (
      <View style={{ marginTop: spacing.md, borderRadius: spacing.md, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md }}>
        <Text style={{ ...typography.body, color: palette.subtext }}>No promo messages added yet.</Text>
      </View>
    );
  }
  return (
    <View style={{ marginTop: spacing.md, borderRadius: spacing.sm, backgroundColor: palette.text, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, alignItems: 'center' }}>
      <Text style={{ ...typography.caption, color: palette.surface, fontWeight: '700' }}>{messages[0].text}</Text>
      {messages.length > 1 ? (
        <Text style={{ ...typography.caption, color: palette.surface, opacity: 0.7, marginTop: 2 }}>
          +{messages.length - 1} more message{messages.length - 1 === 1 ? '' : 's'}, rotating
        </Text>
      ) : null}
    </View>
  );
}
