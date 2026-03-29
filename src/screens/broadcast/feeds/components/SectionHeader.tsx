import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  subtitle?: string;
  rightLabel?: string;
  onRightPress?: () => void;
};

export default function SectionHeader({ title, subtitle, rightLabel, onRightPress }: Props) {
  const { palette } = useKISTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightLabel ? (
        <Pressable
          onPress={onRightPress}
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.surface,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: palette.subtext, fontWeight: '900', fontSize: 12 }}>{rightLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
