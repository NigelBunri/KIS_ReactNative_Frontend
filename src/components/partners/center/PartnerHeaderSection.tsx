import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import styles from '@/components/partners/partnersStyles';
import { Partner } from '@/components/partners/partnersTypes';

type Props = {
  partner: Partner;
  onPress: () => void;
};

export default function PartnerHeaderSection({ partner, onPress }: Props) {
  const { palette } = useKISTheme();

  return (
    <View style={styles.partnerHeader}>
      <View style={styles.partnerHeaderRow}>
        <Text style={[styles.partnerName, { color: palette.text }]} numberOfLines={1}>
          {partner?.name}
        </Text>
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
              borderWidth: 2,
              borderColor: palette.primary,
              backgroundColor: palette.primary,
              shadowColor: palette.primary,
              shadowOpacity: 0.2,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={{ color: palette.onPrimary ?? '#fff', fontSize: 12, fontWeight: '700' }}>
            Settings
          </Text>
          <Text style={{ color: palette.onPrimary ?? '#fff', fontSize: 14 }}>⚙</Text>
        </Pressable>
      </View>
      <Text style={[styles.partnerTagline, { color: palette.subtext }]} numberOfLines={2}>
        {partner?.tagline}
      </Text>
    </View>
  );
}
