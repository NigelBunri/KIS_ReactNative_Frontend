import React from 'react';
import { View, Text } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import { HealthThemeColors } from '@/theme/health';

type StatTileProps = {
  palette: HealthThemeColors;
  label: string;
  value: string | number;
  color: string;
  icon?: string;
};

/**
 * Shared icon/label/value stat tile, unifying Solo's StatCard (icon +
 * color badge) and CCC's StatCard (accent color only, no icon) into one
 * component used by both screens' snapshot rows.
 */
export default function StatTile({ palette, label, value, color, icon }: StatTileProps) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 100,
        backgroundColor: palette.surface,
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: color + '33',
      }}
    >
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: color + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <KISIcon name={icon as any} size={16} color={color} />
        </View>
      ) : null}
      <Text style={{ color: palette.text, fontWeight: '800', fontSize: 22 }}>{value}</Text>
      <Text
        style={{ color: palette.subtext, fontWeight: '600', fontSize: 11, textAlign: 'center' }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}
