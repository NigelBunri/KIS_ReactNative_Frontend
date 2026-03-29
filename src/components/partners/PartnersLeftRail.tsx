// src/screens/tabs/PartnersLeftRail.tsx
import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import styles from './partnersStyles';
import { useKISTheme } from '../../theme/useTheme';
import { LEFT_RAIL_WIDTH, Partner } from './partnersTypes';

type Props = {
  partners: Partner[];
  selectedPartnerId: string;
  onSelectPartner: (id: string) => void;
  onAddPartnerPress: () => void;
  onLogout: () => void;
};

export default function PartnersLeftRail({
  partners,
  selectedPartnerId,
  onSelectPartner,
  onAddPartnerPress,
  onLogout,
}: Props) {
  const { palette } = useKISTheme();
  const selectedPartner = partners.find((p) => p.id === selectedPartnerId) ?? partners[0];

  return (
    <View
      style={[
        styles.leftRail,
        {
          width: LEFT_RAIL_WIDTH,
          backgroundColor: palette.chrome,
          borderRightColor: palette.divider,
        },
      ]}
    >
      <Pressable
        onPress={onAddPartnerPress}
        style={({ pressed }) => [
          styles.addPartnerButton,
          {
            backgroundColor: palette.primarySoft,
            borderColor: palette.borderMuted,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: palette.primaryStrong,
            fontSize: 28,
            lineHeight: 28,
            fontWeight: '900',
          }}
        >
          +
        </Text>
      </Pressable>

      <FlatList
        data={partners}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.partnerList}
        renderItem={({ item }) => {
          const isActive = item.id === selectedPartner?.id;
          const initials = item.initials || item.name?.slice(0, 2).toUpperCase();
          return (
            <Pressable
              onPress={() => onSelectPartner(item.id)}
              style={({ pressed }) => [
                styles.partnerAvatarWrap,
                {
                  backgroundColor: isActive ? palette.primarySoft : palette.avatarBg,
                  borderColor: isActive ? palette.primaryStrong : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: isActive ? palette.primaryStrong : palette.onAvatar,
                  fontSize: 14,
                  fontWeight: '700',
                }}
              >
                {initials}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            No partners yet
          </Text>
        }
      />

      <Pressable onPress={onLogout} style={styles.logoutButton}>
        <Text style={{ color: palette.subtext, fontSize: 18 }}>⏏</Text>
      </Pressable>
    </View>
  );
}
