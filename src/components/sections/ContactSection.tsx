import React from 'react';
import { Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

export default function ContactSection({ data, palette, typography, spacing }: SectionRenderProps) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.h3, color: palette.text }}>{data?.title || 'Contact'}</Text>
      <View style={{ marginTop: spacing.sm, borderRadius: spacing.sm, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md, gap: spacing.xs }}>
        <Text style={{ ...typography.body, color: palette.text }}>{data?.phone || 'Phone'}</Text>
        <Text style={{ ...typography.body, color: palette.text }}>{data?.email || 'Email'}</Text>
        <Text style={{ ...typography.body, color: palette.subtext }}>{data?.address || 'Address'}</Text>
      </View>
    </View>
  );
}
