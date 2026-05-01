import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import { Partner } from '@/components/partners/partnersTypes';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  partner: Partner;
  onPress: () => void;
};

export default function PartnerHeaderSection({ partner, onPress }: Props) {
  const { palette } = useKISTheme();
  const initials =
    partner?.initials || partner?.name?.slice(0, 2).toUpperCase();
  const titleColor = palette.text;
  const mutedColor = palette.subtext;

  return (
    <>
      <Text
        style={[styles.partnerHeaderKicker, { color: palette.primaryStrong }]}
      >
        Partner workspace
      </Text>
      <View style={styles.partnerHeaderRow}>
        <LinearGradient
          colors={[palette.primarySoft, palette.surface, palette.primarySoft]}
          style={[
            styles.partnerHeroAvatar,
            { borderColor: palette.borderMuted },
          ]}
        >
          {partner?.avatar_url ? (
            <Image
              source={{ uri: partner.avatar_url }}
              style={styles.partnerAvatarImage}
              resizeMode="cover"
            />
          ) : (
            <Text
              style={{
                color: palette.primaryStrong,
                fontSize: 18,
                fontWeight: '900',
              }}
            >
              {initials}
            </Text>
          )}
        </LinearGradient>
        <View style={styles.partnerHeaderIdentity}>
          <Text
            style={[styles.partnerName, { color: titleColor }]}
            numberOfLines={1}
          >
            {partner?.name}
          </Text>
          <Text
            style={[styles.partnerTagline, { color: mutedColor }]}
            numberOfLines={2}
          >
            {partner?.tagline}
          </Text>
        </View>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: palette.primaryStrong,
              backgroundColor: palette.primaryStrong,
              shadowColor: palette.primaryStrong,
              shadowOpacity: 0.18,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <Text
            style={{
              color: palette.onPrimary ?? '#fff',
              fontSize: 12,
              fontWeight: '800',
            }}
          >
            Settings
          </Text>
          <KISIcon
            name="settings"
            size={14}
            color={palette.onPrimary ?? '#fff'}
          />
        </Pressable>
      </View>
      <View style={[styles.partnerHeaderMetaRow, { marginBottom: 16 }]}>
        <View
          style={[
            styles.partnerHeaderPill,
            {
              borderColor: palette.borderMuted,
              backgroundColor: palette.surface,
            },
          ]}
        >
          <Text
            style={[
              styles.partnerHeaderPillText,
              { color: palette.primaryStrong },
            ]}
          >
            Role: {partner?.member_role || partner?.role || 'Member'}
          </Text>
        </View>
        <View
          style={[
            styles.partnerHeaderPill,
            {
              borderColor: palette.borderMuted,
              backgroundColor: palette.primarySoft,
            },
          ]}
        >
          <Text style={[styles.partnerHeaderPillText, { color: palette.text }]}>
            Active partner
          </Text>
        </View>
      </View>
    </>
  );
}
