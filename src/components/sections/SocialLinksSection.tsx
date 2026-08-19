import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import EditableText from './EditableText';
import type { SectionRenderProps } from './types';

export default function SocialLinksSection({ data, palette, typography, spacing, onFieldChange }: SectionRenderProps) {
  const links = Array.isArray(data?.links) ? data.links : [];
  if (!links.length && !onFieldChange) return null;
  return (
    <View style={{ marginTop: spacing.md }}>
      <EditableText
        value={String(data?.title || 'Follow Us')}
        style={{ ...typography.h3, color: palette.text }}
        onChangeText={onFieldChange ? (v) => onFieldChange('title', v) : undefined}
      />
      {links.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
          {links.map((link: any, i: number) => (
            <TouchableOpacity
              key={link.id || i}
              style={{ borderRadius: 999, borderWidth: 1, borderColor: palette.divider, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
            >
              <Text style={{ ...typography.label, color: palette.accentPrimary }}>{link.platform}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}
