import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

const fallbackCover = require('@/assets/logo-light.png');

type Props = {
  title: string;
  subtitle?: string;
  priceLabel?: string;
  coverUrl?: string | null;
  badgeText?: string;
  ctaLabel?: string;
  onPress?: () => void;
  onCTA?: () => void;
};

export default function MarketProductCard({
  title,
  subtitle,
  priceLabel,
  coverUrl,
  badgeText,
  ctaLabel = 'Subscribe',
  onPress,
  onCTA,
}: Props) {
  const { palette } = useKISTheme();

  const imgSource = useMemo(() => {
    if (coverUrl) return { uri: coverUrl };
    return fallbackCover;
  }, [coverUrl]);

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        backgroundColor: palette.surface,
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
      <View style={{ height: 120 }}>
        <Image source={imgSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        {badgeText ? (
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              borderWidth: 2,
              borderColor: palette.primary,
              backgroundColor: palette.primarySoft,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 11 }}>
              {badgeText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: 12, gap: 6 }}>
        <Text style={{ color: palette.text, fontWeight: '900' }} numberOfLines={1}>
          {title}
        </Text>

        {subtitle ? (
          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ color: palette.subtext, fontWeight: '900' }}>{priceLabel ?? ''}</Text>

          <Pressable
            onPress={onCTA}
            style={{
              borderWidth: 2,
              borderColor: palette.primary,
              backgroundColor: palette.primarySoft,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{ctaLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
