import React from 'react';
import { View } from 'react-native';
import EditableText from './EditableText';
import type { SectionRenderProps } from './types';

export default function ContactSection({ data, palette, typography, spacing, onFieldChange }: SectionRenderProps) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <EditableText
        value={String(data?.title || 'Contact')}
        style={{ ...typography.h3, color: palette.text }}
        onChangeText={onFieldChange ? (v) => onFieldChange('title', v) : undefined}
      />
      <View style={{ marginTop: spacing.sm, borderRadius: spacing.sm, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md, gap: spacing.xs }}>
        <EditableText
          value={String(data?.phone || 'Phone')}
          style={{ ...typography.body, color: palette.text }}
          onChangeText={onFieldChange ? (v) => onFieldChange('phone', v) : undefined}
        />
        <EditableText
          value={String(data?.email || 'Email')}
          style={{ ...typography.body, color: palette.text }}
          onChangeText={onFieldChange ? (v) => onFieldChange('email', v) : undefined}
        />
        <EditableText
          value={String(data?.address || 'Address')}
          style={{ ...typography.body, color: palette.subtext }}
          onChangeText={onFieldChange ? (v) => onFieldChange('address', v) : undefined}
        />
      </View>
    </View>
  );
}
