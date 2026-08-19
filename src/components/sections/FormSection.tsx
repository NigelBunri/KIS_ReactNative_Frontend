import React from 'react';
import { Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

// Read-only preview — real submission only happens on the public website
// (components/website-builder/SectionRenderer.tsx's FormSection there is
// the actual functional <form>), not inside this editor.
export default function FormSection({ data, palette, typography, spacing }: SectionRenderProps) {
  const fields = Array.isArray(data?.fields) ? data.fields : [];
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.h3, color: palette.text }}>{data?.title || 'Contact Us'}</Text>
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
          <Text style={{ ...typography.label, color: '#FFFFFF' }}>{data?.submitLabel || 'Submit'}</Text>
        </View>
      </View>
    </View>
  );
}
