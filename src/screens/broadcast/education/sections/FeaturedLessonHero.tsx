import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  badgeLeft?: string;
  badgeRight?: string;
  onPress?: () => void;
};

const fallbackCover = require('@/assets/logo-light.png');

export default function FeaturedLessonHero({
  title,
  subtitle,
  coverUrl,
  badgeLeft = 'Live Sessions Start Soon',
  badgeRight = 'Enroll',
  onPress,
}: Props) {
  const { palette } = useKISTheme();

  const imgSource = useMemo(() => {
    if (coverUrl) return { uri: coverUrl };
    return fallbackCover;
  }, [coverUrl]);

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        backgroundColor: palette.card,
        borderRadius: 22,
        overflow: 'hidden',
      }}
    >
      <View style={{ height: 140 }}>
        <Image source={imgSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>

      <View style={{ padding: 12, gap: 8 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }} numberOfLines={1}>
          {title}
        </Text>

        {subtitle ? (
          <Text style={{ color: palette.subtext, fontWeight: '700' }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <KISIcon name="radio" size={14} color={palette.primaryStrong} />
            <Text style={{ color: palette.subtext, fontWeight: '900', fontSize: 12 }}>{badgeLeft}</Text>
          </View>

          <Pressable
            onPress={onPress}
            style={{
              borderWidth: 2,
              borderColor: palette.primary,
              backgroundColor: palette.primarySoft,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{badgeRight}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
