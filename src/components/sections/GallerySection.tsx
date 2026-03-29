import React from 'react';
import { Image, Text, View } from 'react-native';
import { resolveBackendAssetUrl } from '@/network';
import type { SectionRenderProps } from './types';

export default function GallerySection({ data, palette, typography, spacing }: SectionRenderProps) {
  const images = Array.isArray(data?.images) ? data.images : [];
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.h3, color: palette.text }}>{data?.title || 'Gallery'}</Text>
      <View style={{ marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {images.length === 0 ? <Text style={{ ...typography.body, color: palette.subtext }}>No images selected.</Text> : null}
        {images.map((raw: string, index: number) => {
          const uri = resolveBackendAssetUrl(raw) || raw;
          return (
            <Image
              key={`${uri}-${index}`}
              source={{ uri }}
              style={{ width: data?.gridStyle === 'masonry' && index % 2 === 0 ? '48%' : '48%', height: data?.gridStyle === 'masonry' && index % 2 === 0 ? 160 : 120, borderRadius: spacing.sm, backgroundColor: palette.surface }}
              resizeMode="cover"
            />
          );
        })}
      </View>
    </View>
  );
}
