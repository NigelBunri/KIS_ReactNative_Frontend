import React from 'react';
import { FlatList, Image, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import { PartnerAdmin } from '@/components/partners/partnersTypes';

type Props = {
  admins: PartnerAdmin[];
};

export default function PartnerAdminsStrip({ admins }: Props) {
  const { palette } = useKISTheme();

  if (!admins?.length) return null;

  return (
    <View style={styles.adminsSection}>
      <Text style={[styles.adminsLabel, { color: palette.subtext }]}>
        Executive admins
      </Text>
      <FlatList
        data={admins}
        keyExtractor={a => a.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.adminsList}
        renderItem={({ item }) => (
          <View
            style={[
              styles.adminCard,
              {
                backgroundColor: palette.surfaceElevated ?? palette.surface,
                borderColor: palette.divider ?? palette.borderMuted,
                shadowColor: palette.shadow ?? '#000',
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              },
            ]}
          >
            <LinearGradient
              colors={[
                palette.primarySoft,
                palette.surface,
                palette.secondary ?? palette.primarySoft,
              ]}
              style={[
                styles.adminAvatar,
                {
                  backgroundColor: palette.avatarBg,
                  borderColor: palette.borderMuted,
                  overflow: 'hidden',
                },
              ]}
            >
              {item.avatarUrl ? (
                <Image
                  source={{ uri: item.avatarUrl }}
                  style={styles.partnerAvatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{
                    color: palette.text,
                    fontSize: 13,
                    fontWeight: '900',
                  }}
                >
                  {item.initials}
                </Text>
              )}
            </LinearGradient>
            <Text
              numberOfLines={1}
              style={{
                color: palette.text,
                fontSize: 11,
                fontWeight: '600',
                marginTop: 2,
              }}
            >
              {item.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: palette.subtext,
                fontSize: 10,
                marginTop: 1,
              }}
            >
              {item.position}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
