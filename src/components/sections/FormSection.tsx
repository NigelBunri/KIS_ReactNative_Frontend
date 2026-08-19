import React from 'react';
import { Text, View } from 'react-native';
import EditableText from './EditableText';
import type { SectionRenderProps } from './types';

// Read-only preview — real submission only happens on the public website
// (components/website-builder/SectionRenderer.tsx's FormSection there is
// the actual functional <form>), not inside this editor.
export default function FormSection({ data, palette, typography, spacing, onFieldChange }: SectionRenderProps) {
  const fields = Array.isArray(data?.fields) ? data.fields : [];
  return (
    <View style={{ marginTop: spacing.md }}>
      <EditableText
        value={String(data?.title || 'Contact Us')}
        style={{ ...typography.h3, color: palette.text }}
        onChangeText={onFieldChange ? (v) => onFieldChange('title', v) : undefined}
      />
      <View style={{ marginTop: spacing.sm, borderRadius: spacing.sm, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, padding: spacing.md, gap: spacing.sm }}>
        {fields.length === 0 ? (
          <Text style={{ ...typography.body, color: palette.subtext }}>No fields yet — add some above.</Text>
        ) : (
          fields.map((field: any, i: number) => (
            <View key={field.id || i}>
              <Text style={{ ...typography.label, color: palette.text }}>
                {field.label}{field.required ? ' *' : ''}
              </Text>
              <View
                style={{
                  marginTop: 4,
                  borderRadius: spacing.xs,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  backgroundColor: palette.bg,
                  height: field.type === 'textarea' ? 64 : 36,
                }}
              />
            </View>
          ))
        )}
        <View
          style={{
            marginTop: spacing.xs,
            alignSelf: 'flex-start',
            borderRadius: 999,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.md,
            backgroundColor: palette.accentPrimary,
          }}
        >
          <EditableText
            value={String(data?.submitLabel || 'Submit')}
            style={{ ...typography.label, color: '#FFFFFF' }}
            onChangeText={onFieldChange ? (v) => onFieldChange('submitLabel', v) : undefined}
          />
        </View>
      </View>
    </View>
  );
}
