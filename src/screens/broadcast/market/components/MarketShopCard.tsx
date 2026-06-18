import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';

const fallbackCover = require('@/assets/logo-light.png');

type Props = {
  name: string;
  description?: string;
  coverUrl?: string | null;
  verified?: boolean;
  trustLabel?: string;
  trustBadges?: string[];
  memberCount?: number;
  onPress?: () => void;
  ctaLabel?: string;
  isMember?: boolean;
  onCTA?: () => void;
};

export default function MarketShopCard({
  name,
  description,
  coverUrl,
  verified,
  trustLabel,
  trustBadges,
  memberCount,
  onPress,
  ctaLabel = 'Join shop',
  isMember = false,
  onCTA,
}: Props) {
  const { palette } = useKISTheme();


  const badgesToShow = trustBadges?.slice(0, 3) ?? [];

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1.5,
        borderColor: palette.divider,
        backgroundColor: palette.surface,
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      <View style={{ height: 90 }}>
        {coverUrl ? (
          <PermanentRemoteImage
            uri={coverUrl}
            domain="Market"
            stableKey={`market_name_${name}_${coverUrl}`}
            containerStyle={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Image source={fallbackCover} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        )}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.25)', // intentional image scrim
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 10,
            left: 12,
            right: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text
            style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 15, flex: 1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}
            numberOfLines={1}
          >
            {name}
          </Text>
          {(verified || trustLabel) && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: verified ? (palette.success) : (palette.primary),
                borderRadius: 8,
                paddingHorizontal: 7,
                paddingVertical: 3,
              }}
            >
              <KISIcon name="check" size={10} color={palette.onPrimary} />
              <Text style={{ color: palette.onPrimary, fontWeight: '900', fontSize: 10 }}>
                {trustLabel ?? 'Verified'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ padding: 10, gap: 6 }}>
        {description && (
          <Text style={{ color: palette.subtext, fontWeight: '600', fontSize: 12 }} numberOfLines={2}>
            {description}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {memberCount !== undefined && memberCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <KISIcon name="people" size={12} color={palette.subtext} />
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 11 }}>
                {memberCount >= 1000 ? `${(memberCount / 1000).toFixed(1)}k` : memberCount} members
              </Text>
            </View>
          )}
          {badgesToShow.map((badge) => (
            <View
              key={badge}
              style={{
                backgroundColor: palette.primarySoft,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: palette.primaryStrong, fontWeight: '800', fontSize: 10 }}>
                {badge}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={onCTA}
          style={{
            marginTop: 2,
            borderWidth: 1.5,
            borderColor: isMember ? palette.divider : palette.primary,
            backgroundColor: isMember ? palette.card : palette.primarySoft,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: isMember ? palette.subtext : palette.primaryStrong,
              fontWeight: '900',
              fontSize: 13,
            }}
          >
            {isMember ? 'View shop' : ctaLabel}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
