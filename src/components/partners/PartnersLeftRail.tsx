// src/screens/tabs/PartnersLeftRail.tsx
import React from 'react';
import { Animated, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { LEFT_RAIL_WIDTH, Partner } from './partnersTypes';
import { KISIcon } from '@/constants/kisIcons';
import { useResponsiveLayout } from '@/theme/responsive';
import { PartnerLeftRailSkeleton } from './PartnersSkeleton';

type Props = {
  partners: Partner[];
  selectedPartnerId: string;
  onSelectPartner: (id: string) => void;
  onAddPartnerPress: () => void;
  loading?: boolean;
};

export default function PartnersLeftRail({
  partners,
  selectedPartnerId,
  onSelectPartner,
  onAddPartnerPress,
  loading = false,
}: Props) {
  const { palette, isDark, tone } = useKISTheme();
  const responsive = useResponsiveLayout();
  const compact = responsive.isWatch || responsive.isCompactPhone;
  const railWidth = responsive.isWatch ? 52 : responsive.isCompactPhone ? 60 : LEFT_RAIL_WIDTH;
  const avatarSize = responsive.isWatch ? 38 : responsive.isCompactPhone ? 42 : 48;
  const metallicGoldGradient = tone === 'dark'
    ? ['#3B271E', '#6F4515', '#B9852E', '#56321F']
    : ['#5A372D', '#8A5A12', '#D9A875', '#7A4B3E'];
  const selectedPartner =
    partners.find(p => p.id === selectedPartnerId) ?? partners[0];
  const entrance = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      tension: 70,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  if (loading && partners.length === 0) {
    return <PartnerLeftRailSkeleton />;
  }

  return (
    <Animated.View
      style={[
        styles.leftRail,
        {
          width: railWidth,
          backgroundColor: isDark ? 'rgba(10,9,14,0.92)' : '#FFFFFF',
          borderRightColor: palette.divider,
          opacity: entrance,
          transform: [
            {
              translateX: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [-18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onAddPartnerPress}
        style={({ pressed }) => [
          styles.addPartnerButton,
          {
            backgroundColor: palette.goldDeep,
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            borderColor: palette.goldLight,
            shadowColor: palette.goldDeep,
            overflow: 'hidden',
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
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
        <KISIcon name="add" size={compact ? 20 : 24} color={palette.ivory} />
      </Pressable>

      <FlatList
        data={partners}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.partnerList}
        renderItem={({ item }) => {
          const isActive = item.id === selectedPartner?.id;
          const initials =
            item.initials || item.name?.slice(0, 2).toUpperCase();
          return (
            <Pressable
              onPress={() => onSelectPartner(item.id)}
              style={({ pressed }) => [
                styles.partnerAvatarWrap,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                  marginBottom: compact ? 9 : 12,
                  backgroundColor: isActive
                    ? palette.goldDeep
                    : isDark
                    ? 'rgba(255,255,255,0.08)'
                    : palette.surface,
                  borderColor: isActive
                    ? palette.goldLight
                    : palette.borderMuted,
                  shadowColor: isActive
                    ? palette.goldDeep
                    : palette.shadow ?? '#000',
                  overflow: 'hidden',
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.92 : isActive ? 1.06 : 1 }],
                },
              ]}
            >
              {isActive ? (
                <View
                  style={[
                    styles.partnerAvatarActiveRail,
                    { backgroundColor: palette.goldLight },
                  ]}
                />
              ) : null}
              <LinearGradient
                colors={
                  isActive
                    ? metallicGoldGradient
                    : isDark
                    ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)']
                    : ['#FFFFFF', palette.surface]
                }
                style={styles.partnerAvatarInner}
              >
                {item.avatar_url ? (
                  <Image
                    source={{ uri: item.avatar_url }}
                    style={styles.partnerAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={{
                      color: isActive
                        ? palette.ivory
                        : palette.text,
                      fontSize: compact ? 12 : 14,
                      fontWeight: '900',
                    }}
                  >
                    {initials}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            No partners yet
          </Text>
        }
      />
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  goldSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.14)',
    transform: [{ translateX: -18 }, { rotate: '-18deg' }, { scaleX: 0.42 }],
  },
});
