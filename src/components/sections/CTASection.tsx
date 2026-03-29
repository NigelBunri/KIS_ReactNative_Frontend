import React from 'react';
import { Text, View } from 'react-native';
import type { SectionRenderProps } from './types';

export default function CTASection({ data, palette, typography, spacing }: SectionRenderProps) {
  return (
    <View style={{ marginTop: spacing.md, borderRadius: spacing.md, backgroundColor: palette.accentPrimary + '14', borderWidth: 1, borderColor: palette.accentPrimary + '55', padding: spacing.md }}>
      <Text style={{ ...typography.h3, color: palette.text }}>{data?.title || 'Call to action'}</Text>
      <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>{data?.description || ''}</Text>
      <View style={{ marginTop: spacing.sm, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: palette.accentPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
        <Text style={{ ...typography.label, color: '#fff' }}>{data?.buttonText || 'Learn more'}</Text>
      </View>
    </View>
  );
}
