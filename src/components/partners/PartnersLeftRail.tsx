// src/screens/tabs/PartnersLeftRail.tsx
import React from 'react';
import { Animated, FlatList, Image, Pressable, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { LEFT_RAIL_WIDTH, Partner } from './partnersTypes';
import { KISIcon } from '@/constants/kisIcons';

type Props = {
  partners: Partner[];
  selectedPartnerId: string;
  onSelectPartner: (id: string) => void;
  onAddPartnerPress: () => void;
};

export default function PartnersLeftRail({
  partners,
  selectedPartnerId,
  onSelectPartner,
  onAddPartnerPress,
}: Props) {
  const { palette, isDark } = useKISTheme();
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

  return (
    <Animated.View
      style={[
        styles.leftRail,
        {
          width: LEFT_RAIL_WIDTH,
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
            backgroundColor: palette.primaryStrong,
            borderColor: 'rgba(255,255,255,0.28)',
            shadowColor: palette.primaryStrong,
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <KISIcon name="add" size={24} color={palette.onPrimary ?? '#fff'} />
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
                  backgroundColor: isActive
                    ? palette.primarySoft
                    : isDark
                    ? 'rgba(255,255,255,0.08)'
                    : palette.surface,
                  borderColor: isActive
                    ? palette.primaryStrong
                    : palette.borderMuted,
                  shadowColor: isActive
                    ? palette.primaryStrong
                    : palette.shadow ?? '#000',
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.92 : isActive ? 1.06 : 1 }],
                },
              ]}
            >
              {isActive ? (
                <View
                  style={[
                    styles.partnerAvatarActiveRail,
                    { backgroundColor: palette.primaryStrong },
                  ]}
                />
              ) : null}
              <LinearGradient
                colors={
                  isActive
                    ? [palette.primaryStrong, palette.secondary ?? '#6C4AF2']
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
                        ? palette.onPrimary ?? '#fff'
                        : palette.text,
                      fontSize: 14,
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
