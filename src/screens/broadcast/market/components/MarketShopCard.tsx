import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

const fallbackCover = require('@/assets/logo-light.png');

type Props = {
  name: string;
  description?: string;
  coverUrl?: string | null;
  verified?: boolean;
  onPress?: () => void;
  ctaLabel?: string;
  onCTA?: () => void;
};

export default function MarketShopCard({
  name,
  description,
  coverUrl,
  verified,
  onPress,
  ctaLabel = 'Join shop',
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
      <View style={{ height: 100 }}>
        <Image source={imgSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>

      <View style={{ padding: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: palette.text, fontWeight: '900', flex: 1 }} numberOfLines={1}>
            {name}
          </Text>
          {verified ? (
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: palette.primaryStrong,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KISIcon name="check" size={12} color="#fff" />
            </View>
          ) : null}
        </View>

        {description ? (
          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }} numberOfLines={2}>
            {description}
          </Text>
        ) : null}

        <Pressable
          onPress={onCTA}
          style={{
            marginTop: 2,
            borderWidth: 2,
            borderColor: palette.primary,
            backgroundColor: palette.primarySoft,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
