import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const { palette, tone, isDark } = useKISTheme();
  const metallicGoldGradient = tone === 'dark'
    ? ['#3B271E', '#6F4515', '#B9852E', '#56321F']
    : ['#5A372D', '#8A5A12', '#D9A875', '#7A4B3E'];
  const initials =
    partner?.initials || partner?.name?.slice(0, 2).toUpperCase();
  const titleColor = isDark ? palette.ivory : palette.text;
  const mutedColor = isDark ? palette.goldSoft : palette.subtext;
  const strongLabelColor = isDark ? palette.ivory : palette.goldDeep;
  const roleTextColor = isDark ? palette.ivory : palette.goldDeep;
  const rolePillBg = isDark ? 'rgba(255,251,242,0.10)' : palette.surface;
  const activePillBg = isDark ? 'rgba(217,168,117,0.16)' : palette.primarySoft;

  return (
    <>
      <Text
        style={[styles.partnerHeaderKicker, { color: strongLabelColor }]}
      >
        Partner workspace
      </Text>
      <View style={styles.partnerHeaderRow}>
        <LinearGradient
          colors={isDark ? ['#5A372D', '#8A5A12', '#D9A875'] : [palette.primarySoft, palette.surface, palette.primarySoft]}
          style={[
            styles.partnerHeroAvatar,
            { borderColor: isDark ? palette.goldLight : palette.borderMuted },
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
                color: isDark ? palette.royalInk : palette.goldDeep,
                fontSize: 18,
                fontWeight: '900',
              }}
            >
              {initials}
            </Text>
          )}
        </LinearGradient>
        <View style={styles.partnerHeaderIdentity}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[styles.partnerName, { color: titleColor, flexShrink: 1 }]}
              numberOfLines={1}
            >
              {partner?.name}
            </Text>
            {partner?.verification_summary?.verified && (
              <View style={{
                backgroundColor: isDark ? 'rgba(217,168,117,0.22)' : '#FFF8EC',
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderWidth: 1,
                borderColor: isDark ? palette.goldSoft : palette.goldDeep,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
              }}>
                <KISIcon name="checkmark-circle" size={11} color={isDark ? palette.goldSoft : palette.goldDeep} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? palette.goldSoft : palette.goldDeep }}>
                  Verified
                </Text>
              </View>
            )}
          </View>
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
              borderColor: palette.goldLight,
              backgroundColor: palette.goldDeep,
              shadowColor: palette.goldDeep,
              overflow: 'hidden',
              shadowOpacity: 0.18,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <LinearGradient
            colors={metallicGoldGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View pointerEvents="none" style={localStyles.goldSheen} />
          <Text
            style={{
              color: palette.ivory ?? '#fff',
              fontSize: 12,
              fontWeight: '800',
            }}
          >
            Settings
          </Text>
          <KISIcon
            name="settings"
            size={14}
            color={palette.ivory ?? '#fff'}
          />
        </Pressable>
      </View>
      <View style={[styles.partnerHeaderMetaRow, { marginBottom: 16 }]}>
        <View
          style={[
            styles.partnerHeaderPill,
            {
              borderColor: palette.borderMuted,
              backgroundColor: rolePillBg,
            },
          ]}
        >
          <Text
            style={[
              styles.partnerHeaderPillText,
              { color: roleTextColor },
            ]}
          >
            Role: {(() => {
              const r = partner?.member_role || partner?.role || '';
              if (!r) return 'Member';
              const map: Record<string, string> = { owner: 'Owner', admin: 'Admin', moderator: 'Moderator', member: 'Member', readonly: 'Read Only' };
              return map[r.toLowerCase()] ?? r.charAt(0).toUpperCase() + r.slice(1);
            })()}
          </Text>
        </View>
        <View
          style={[
            styles.partnerHeaderPill,
            {
              borderColor: palette.borderMuted,
              backgroundColor: activePillBg,
            },
          ]}
        >
          <Text style={[styles.partnerHeaderPillText, { color: isDark ? palette.ivory : palette.text }]}>
            Active partner
          </Text>
        </View>
      </View>
    </>
  );
}

const localStyles = StyleSheet.create({
  goldSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.16)',
    transform: [{ translateX: -14 }, { rotate: '-18deg' }, { scaleX: 0.42 }],
  },
});
