import React from 'react';
import { View } from 'react-native';
import EditableText from './EditableText';
import type { SectionRenderProps } from './types';

export default function CTASection({ data, palette, typography, spacing, onFieldChange }: SectionRenderProps) {
  return (
    <View style={{ marginTop: spacing.md, borderRadius: spacing.md, backgroundColor: palette.accentPrimary + '14', borderWidth: 1, borderColor: palette.accentPrimary + '55', padding: spacing.md }}>
      <EditableText
        value={String(data?.title || 'Call to action')}
        style={{ ...typography.h3, color: palette.text }}
        onChangeText={onFieldChange ? (v) => onFieldChange('title', v) : undefined}
      />
      <EditableText
        value={String(data?.description || '')}
        style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}
        multiline
        placeholder="Description"
        onChangeText={onFieldChange ? (v) => onFieldChange('description', v) : undefined}
      />
      <View style={{ marginTop: spacing.sm, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: palette.accentPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
        <EditableText
          value={String(data?.buttonText || 'Learn more')}
          style={{ ...typography.label, color: palette.onPrimary }}
          onChangeText={onFieldChange ? (v) => onFieldChange('buttonText', v) : undefined}
        />
      </View>
    </View>
  );
}
