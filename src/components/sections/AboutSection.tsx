import React from 'react';
import { Image, View } from 'react-native';
import { resolveBackendAssetUrl } from '@/network';
import EditableText from './EditableText';
import type { SectionRenderProps } from './types';

export default function AboutSection({ data, palette, typography, spacing, onFieldChange }: SectionRenderProps) {
  const uri = data?.imageUrl ? resolveBackendAssetUrl(data.imageUrl) || data.imageUrl : '';
  const imageBlock = uri ? <Image source={{ uri }} style={{ width: '100%', height: 140, borderRadius: spacing.sm }} resizeMode="cover" /> : <View style={{ width: '100%', height: 140, borderRadius: spacing.sm, backgroundColor: palette.surface }} />;
  const textBlock = (
    <View style={{ flex: 1 }}>
      <EditableText
        value={String(data?.title || 'About')}
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
    </View>
  );
  const imageLeft = data?.layout !== 'image_right';
  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>{imageLeft ? imageBlock : textBlock}</View>
        <View style={{ flex: 1 }}>{imageLeft ? textBlock : imageBlock}</View>
      </View>
    </View>
  );
}
