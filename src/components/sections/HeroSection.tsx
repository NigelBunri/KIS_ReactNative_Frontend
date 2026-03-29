import React, { useMemo, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { resolveBackendAssetUrl } from '@/network';
import type { SectionRenderProps } from './types';

const TITLE_PREVIEW_LIMIT = 70;
const SUBTITLE_PREVIEW_LIMIT = 150;

const truncateWithMore = (value: string, limit: number) => {
  const text = String(value || '').trim();
  if (text.length <= limit) return { text, truncated: false };
  return {
    text: `${text.slice(0, limit).trim()}..`,
    truncated: true,
  };
};

type HeroSectionProps = SectionRenderProps & {
  onPressCta?: () => void;
};

export default function HeroSection({ data, palette, typography, spacing, onPressCta }: HeroSectionProps) {
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [subtitleExpanded, setSubtitleExpanded] = useState(false);
  const uri = data?.backgroundImageUrl ? resolveBackendAssetUrl(data.backgroundImageUrl) || data.backgroundImageUrl : '';
  const title = String(data?.title || 'Hero title');
  const subtitle = String(data?.subtitle || '');
  const titlePreview = useMemo(() => truncateWithMore(title, TITLE_PREVIEW_LIMIT), [title]);
  const subtitlePreview = useMemo(() => truncateWithMore(subtitle, SUBTITLE_PREVIEW_LIMIT), [subtitle]);

  return (
    <View style={{ width: '100%', alignSelf: 'stretch'}}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: 290 }} resizeMode="cover" /> : <View style={{ height: 220, backgroundColor: palette.surface }} />}
      <LinearGradient
        colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.65)']}
        style={{
          position: 'absolute',
          justifyContent: 'flex-end',
          width: '100%',
          height: '100%',
          top: 0,
        }}
      >
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 230 }}
          contentContainerStyle={{ padding: spacing.xs }}
        >
          {titleExpanded ? (
            <Text style={{ ...typography.h2, color: '#fff' }}>{title}</Text>
          ) : (
            <Text style={{ ...typography.h2, color: '#fff' }}>{titlePreview.text}</Text>
          )}
          {titlePreview.truncated ? (
            <TouchableOpacity onPress={() => setTitleExpanded((prev) => !prev)} style={{ marginTop: 2 }}>
              <Text style={{ ...typography.caption, color: '#fff' }}>{titleExpanded ? 'less' : '.. and more'}</Text>
            </TouchableOpacity>
          ) : null}

          {subtitleExpanded ? (
            <Text style={{ ...typography.body, color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs }}>{subtitle}</Text>
          ) : (
            <Text style={{ ...typography.body, color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs }}>
              {subtitlePreview.text}
            </Text>
          )}
          {subtitlePreview.truncated ? (
            <TouchableOpacity onPress={() => setSubtitleExpanded((prev) => !prev)} style={{ marginTop: 2 }}>
              <Text style={{ ...typography.caption, color: '#fff' }}>{subtitleExpanded ? 'less' : '.. and more'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            activeOpacity={onPressCta ? 0.85 : 1}
            onPress={onPressCta}
            style={{
              marginTop: spacing.sm,
              marginBottom: spacing.xs,
              alignSelf: 'flex-start',
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.5)',
            }}
          >
            <Text style={{ ...typography.label, color: '#111827' }}>{data?.ctaText || 'Book Now'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
