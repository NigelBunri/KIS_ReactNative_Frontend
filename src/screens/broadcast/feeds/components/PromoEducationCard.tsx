import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';

type Props = {
  title: string;
  subtitle: string;
  footerLeft?: string;
  ctaLabel?: string;
  onPress?: () => void;
  backgroundColor?: string;
};

const fallbackBanner = require('@/assets/logo-light.png');

export default function PromoEducationCard({
  title,
  subtitle,
  footerLeft,
  ctaLabel = 'Enroll',
  onPress,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: palette.divider,
        borderRadius: 22,
        backgroundColor: palette.card,
        overflow: 'hidden',
      }}
    >
      <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, gap: 10 }}>
        <Text style={{ color: palette.subtext, fontWeight: '900' }}>{title}</Text>

        <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 18, overflow: 'hidden' }}>
          <Image source={fallbackBanner} style={{ width: '100%', height: 120 }} resizeMode="cover" />
        </View>

        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{subtitle}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }} numberOfLines={2}>
            {footerLeft ?? ''}
          </Text>
          <Pressable onPress={onPress} style={{ minWidth: 120 }}>
            <KISButton title={ctaLabel} onPress={onPress ?? (() => {})} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
