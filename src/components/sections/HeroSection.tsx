import React, { useMemo, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { resolveBackendAssetUrl } from '@/network';
import EditableText from './EditableText';
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

export default function HeroSection({ data, palette, typography, spacing, onPressCta, onFieldChange }: HeroSectionProps) {
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
          {onFieldChange ? (
            <EditableText
              value={title}
              style={{ ...typography.h2, color: palette.onPrimary }}
              onChangeText={(v) => onFieldChange('title', v)}
            />
          ) : titleExpanded ? (
            <Text style={{ ...typography.h2, color: palette.onPrimary }}>{title}</Text>
          ) : (
            <Text style={{ ...typography.h2, color: palette.onPrimary }}>{titlePreview.text}</Text>
          )}
          {!onFieldChange && titlePreview.truncated ? (
            <TouchableOpacity onPress={() => setTitleExpanded((prev) => !prev)} style={{ marginTop: 2 }}>
              <Text style={{ ...typography.caption, color: palette.onPrimary }}>{titleExpanded ? 'less' : '.. and more'}</Text>
            </TouchableOpacity>
          ) : null}

          {onFieldChange ? (
            <EditableText
              value={subtitle}
              style={{ ...typography.body, color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs }}
              multiline
              placeholder="Subtitle"
              onChangeText={(v) => onFieldChange('subtitle', v)}
            />
          ) : subtitleExpanded ? (
            <Text style={{ ...typography.body, color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs }}>{subtitle}</Text>
          ) : (
            <Text style={{ ...typography.body, color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs }}>
              {subtitlePreview.text}
            </Text>
          )}
          {!onFieldChange && subtitlePreview.truncated ? (
            <TouchableOpacity onPress={() => setSubtitleExpanded((prev) => !prev)} style={{ marginTop: 2 }}>
              <Text style={{ ...typography.caption, color: palette.onPrimary }}>{subtitleExpanded ? 'less' : '.. and more'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            activeOpacity={onPressCta ? 0.85 : 1}
            onPress={onFieldChange ? undefined : onPressCta}
            style={{
              marginTop: spacing.sm,
              marginBottom: spacing.xs,
              alignSelf: 'flex-start',
              borderRadius: 999,
              backgroundColor: palette.ivory,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.5)',
            }}
          >
            <EditableText
              value={String(data?.ctaText || 'Book Now')}
              style={{ ...typography.label, color: palette.royalInk }}
              onChangeText={onFieldChange ? (v) => onFieldChange('ctaText', v) : undefined}
            />
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
